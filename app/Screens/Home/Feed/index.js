import React, {
  useEffect,
  useState,
  useCallback,
  useContext,
  useRef,
} from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
  BACKEND_REVIEW_URL,
  BACKEND_REVIEW_LIKE_URL,
  BACKEND_USER_FOLLOW_URL,
  IS_DEVELOPMENT,
  BACKEND_PROFILE_PICTURE_DOWNLOADER_URL,
} from "../../../constants/apiConstants";
import { AuthContext } from "../../../context/AuthContext";
import { getUserProfile } from "../../../api/backend";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { Linking } from "react-native";
import { TouchableWithoutFeedback, Keyboard } from "react-native";
import { Menu } from "react-native-paper";
import { useRouter } from "expo-router";

const SPOTIFY_API_URL = "https://api.spotify.com/v1/albums";
//const BATCH_SIZE = 5; // Number of reviews to fetch per batch
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const ALBUM_CACHE_KEY = 'spotify_album_images_cache';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const BATCH_SIZE = 20; // Spotify allows up to 20 IDs per request

export default function HomeScreen() {
  const { userId } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [likedReviews, setLikedReviews] = useState({});
  const [albumImages, setAlbumImages] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const [selectedTab, setSelectedTab] = useState("Popular");
  const [refreshing, setRefreshing] = useState(false);
  const [popularReviewIds, setPopularReviewIds] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [userProfiles, setUserProfiles] = useState({});
  const defaultProfileImage = require("../../../../assets/images/default-profile-photo.webp");
  const [popularReviews, setPopularReviews] = useState([]);
  const [yourReviews, setYourReviews] = useState([]);
  const [fetchedReviewIds, setFetchedReviewIds] = useState(new Set());
  const [albumDetails, setAlbumDetails] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const router = useRouter();
  const screenHeight = Dimensions.get("window").height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const [yourReviewsPage, setYourReviewsPage] = useState(0);
  const [yourReviewsHasMore, setYourReviewsHasMore] = useState(true);
  const [loadingMoreYourReviews, setLoadingMoreYourReviews] = useState(false);
  const [followedReviews, setFollowedReviews] = useState([]);
const [followedReviewsPage, setFollowedReviewsPage] = useState(0);
const [followedReviewsHasMore, setFollowedReviewsHasMore] = useState(true);
const [loadingMoreFollowedReviews, setLoadingMoreFollowedReviews] = useState(false);

  const getProfileImageUrl = (fileName) => {
    if (!fileName || fileName === "default.png") {
      return Image.resolveAssetSource(defaultProfileImage).uri;
    }
    return `${BACKEND_PROFILE_PICTURE_DOWNLOADER_URL}/s3/download/${fileName}`;
  };

  const fetchUserProfile = async (userId) => {
    try {
      // Check if we already have this user's profile
      if (userProfiles[userId]) return;

      const profile = await getUserProfile(userId);
      setUserProfiles((prev) => ({
        ...prev,
        [userId]: {
          username: profile.username,
          profileImage: profile.profileImage || null,
        },
      }));
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error(`Error fetching profile for user ${userId}:`, error);
      }
      // Set a default username if fetch fails
      setUserProfiles((prev) => ({
        ...prev,
        [userId]: {
          username: profile.username,
          profileImage: profile.profileImage || null,
        },
      }));
    }
  };

  useEffect(() => {
    fetchSpotifyAccessToken();
  }, []);

  useEffect(() => {
    if (accessToken) {
      fetchInitialData().then(() => {
        fetchAlbumDetailsForAllReviews();
      });
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      if (accessToken) {
        fetchInitialData();
      }
    }, [accessToken])
  );

  const fetchSpotifyAccessToken = async () => {
    try {
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
      });
      const data = await response.json();
      if (data.access_token) {
        setAccessToken(data.access_token);
      } else {
        if (IS_DEVELOPMENT) {
          console.error("Failed to fetch Spotify access token:", data);
        }
      }
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Error fetching Spotify token:", error);
      }
    }
  };
  const loadImageCache = async () => {
    try {
      const cachedImagesJson = await AsyncStorage.getItem(ALBUM_CACHE_KEY);
      if (cachedImagesJson) {
        const cachedImages = JSON.parse(cachedImagesJson);
        
        // Filter out expired entries
        const now = Date.now();
        const validEntries = Object.entries(cachedImages).filter(([_, value]) => {
          return value.timestamp && (now - value.timestamp) < CACHE_EXPIRY;
        });
        
        if (validEntries.length > 0) {
          // Convert back to object with just URLs
          return Object.fromEntries(
            validEntries.map(([key, value]) => [key, value.url])
          );
        }
      }
      return {};
    } catch (error) {
      console.error('Error loading image cache:', error);
      return {};
    }
  };

  const saveImageCache = async (images) => {
    try {
      const now = Date.now();
      const cachedImagesJson = await AsyncStorage.getItem(ALBUM_CACHE_KEY);
      let cachedImages = {};
      
      if (cachedImagesJson) {
        cachedImages = JSON.parse(cachedImagesJson);
      }
      
      // Add timestamps to new entries
      const imagesWithTimestamp = Object.entries(images).reduce((acc, [id, url]) => {
        acc[id] = { url, timestamp: now };
        return acc;
      }, {});
      
      // Merge with existing cache
      const updatedCache = { ...cachedImages, ...imagesWithTimestamp };
      
      await AsyncStorage.setItem(ALBUM_CACHE_KEY, JSON.stringify(updatedCache));
    } catch (error) {
      console.error('Error saving image cache:', error);
    }
  };
  const fetchInitialData = async () => {
    setLoading(true);
    setUserProfiles({});
    await fetchPopularReviewIds();
    await fetchFollowedReviews(0, false); // Reset to page 0
    await fetchYourReviews(0, false);     // Reset to page 0
    setLoading(false);
  };
  

  const fetchPopularReviewIds = async () => {
    try {
      const url = `${BACKEND_REVIEW_URL}/review/popular`;
      const response = await fetch(url);
      const reviewIds = await response.json();
      console.log("Popüler Review ID'leri:", reviewIds);
      setPopularReviewIds(reviewIds);

      if (isInitialLoad) {
        // For initial load, reset the batch index and fetch first batch
        setCurrentBatchIndex(0);
        setFetchedReviewIds(new Set());
        setPopularReviews([]); // Only clear for initial load
        await fetchReviewsBatch(reviewIds, 0);
      } else {
        await refreshExistingReviews(reviewIds);
      }
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Error fetching popular review IDs:", error);
      }
    }
  };

  const refreshExistingReviews = async (reviewIds) => {
    // Get the IDs of reviews we've already fetched
    const existingReviewIds = Array.from(fetchedReviewIds);

    // Filter to only include reviews that are still popular
    const stillPopularIds = existingReviewIds.filter((id) =>
      reviewIds.includes(id)
    );

    // Re-fetch these reviews to get any updates
    const refreshedReviews = await Promise.all(
      stillPopularIds.map(async (id) => {
        try {
          const reviewResponse = await fetch(
            `${BACKEND_REVIEW_URL}/review/get-review/${id}`
          );
          if (!reviewResponse.ok) return null;
          return await reviewResponse.json();
        } catch (error) {
          return null;
        }
      })
    );

    const validRefreshedReviews = refreshedReviews.filter(
      (review) => review !== null
    );

    // Update the existing reviews with any changes
    setPopularReviews((prev) => {
      const updatedReviews = [...prev];
      validRefreshedReviews.forEach((updatedReview) => {
        const index = updatedReviews.findIndex(
          (r) => r.id === updatedReview.id
        );
        if (index >= 0) {
          updatedReviews[index] = updatedReview;
        }
      });
      return updatedReviews;
    });

    // Update like counts and statuses for refreshed reviews
    const counts = await fetchLikeCounts(validRefreshedReviews);
    setLikeCounts((prev) => ({ ...prev, ...counts }));

    const likedStatuses = await fetchLikedReviews(validRefreshedReviews);
    setLikedReviews((prev) => ({ ...prev, ...likedStatuses }));
  };

  const fetchReviewsBatch = async (reviewIds, startIndex) => {
    const endIndex = startIndex + BATCH_SIZE;
    const batchIds = reviewIds.slice(startIndex, endIndex);

    // Filter out already fetched review IDs
    const newBatchIds = batchIds.filter((id) => !fetchedReviewIds.has(id));

    const reviewsData = await Promise.all(
      newBatchIds.map(async (id) => {
        try {
          const reviewResponse = await fetch(
            `${BACKEND_REVIEW_URL}/review/get-review/${id}`
          );
          if (!reviewResponse.ok) {
            if (IS_DEVELOPMENT) {
              console.warn(`⚠️ Review ID ${id} not found, skipping...`);
              return null;
            }
          }
          return await reviewResponse.json();
        } catch (error) {
          if (IS_DEVELOPMENT) {
            console.error(`Error fetching review ID ${id}:`, error);
          }
          return null;
        }
      })
    );

    const validReviews = reviewsData.filter((review) => review !== null);

    // Update fetchedReviewIds with the new review IDs
    setFetchedReviewIds((prevIds) => {
      const newIds = new Set(prevIds);
      validReviews.forEach((review) => newIds.add(review.id));
      return newIds;
    });

    // Append new reviews to popularReviews
    setPopularReviews((prevReviews) => [...prevReviews, ...validReviews]);

    // Fetch user profiles for new reviews
    validReviews.forEach((review) => {
      fetchUserProfile(review.userId);
    });

    const images = await fetchAlbumImages(validReviews);
    setAlbumImages((prevImages) => ({ ...prevImages, ...images }));

    const counts = await fetchLikeCounts(validReviews);
    setLikeCounts((prev) => ({ ...prev, ...counts }));

    const likedStatuses = await fetchLikedReviews(validReviews);
    setLikedReviews((prev) => ({ ...prev, ...likedStatuses }));

    setCurrentBatchIndex(endIndex);
  };

  const fetchLikedReviews = async (reviewsData) => {
    let likedReviewsData = {};

    await Promise.all(
      reviewsData.map(async (review) => {
        try {
          const url = `${BACKEND_REVIEW_LIKE_URL}/review-like/${review.id}/is-liked/${userId}`;
          const response = await fetch(url);

          if (!response.ok) {
            console.error(
              `API Error for review ${review.id}:`,
              response.status,
              response.statusText
            );
            likedReviewsData[review.id] = null;
            return;
          }

          const text = await response.text();
          if (!text) {
            console.warn(`Empty response for review ${review.id}`);
            likedReviewsData[review.id] = null;
            return;
          }

          const data = JSON.parse(text);
          likedReviewsData[review.id] = data.id ? data.id : null;
        } catch (error) {
          console.error(
            `Error fetching liked status for review ${review.id}:`,
            error
          );
          likedReviewsData[review.id] = null;
        }
      })
    );

    return likedReviewsData;
  };

  const fetchFollowedReviews = async (page = 0, append = false) => {
    try {
      setLoadingMoreFollowedReviews(true);
  
      const response = await fetch(`${BACKEND_REVIEW_URL}/review/followed-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, page }),
      });
  
      const data = await response.json(); // this is an array (not Page object)
  
      if (IS_DEVELOPMENT) {
        console.log(`Fetched followed reviews (page ${page}):`, data);
      }
  
      if (append) {
        setFollowedReviews((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const newUnique = data.filter((r) => !existingIds.has(r.id));
          return [...prev, ...newUnique];
        });
      } else {
        setFollowedReviews(data);
      }
      
  
      setFollowedReviewsPage(page);
      setFollowedReviewsHasMore(data.length === 10); // if less than 10, no more pages
  
      // Fetch user profiles, like counts, liked status, and album images
      data.forEach((review) => {
        fetchUserProfile(review.userId);
      });
  
      const counts = await fetchLikeCounts(data);
      setLikeCounts((prev) => ({ ...prev, ...counts }));
  
      const likedStatuses = await fetchLikedReviews(data);
      setLikedReviews((prev) => ({ ...prev, ...likedStatuses }));
  
      const images = await fetchAlbumImages(data);
      setAlbumImages((prevImages) => ({ ...prevImages, ...images }));
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Error fetching followed users' reviews:", error);
      }
    } finally {
      setLoadingMoreFollowedReviews(false);
    }
  };

  const fetchYourReviews = async (page = 0, append = false) => {
    try {
      setLoadingMoreYourReviews(true);
      const url = `${BACKEND_REVIEW_URL}/review/get-reviews/user/${userId}?page=${page}`;
      const response = await fetch(url);
      const data = await response.json();
      
      // Check if there are more pages to load
      setYourReviewsHasMore(!data.last);
      setYourReviewsPage(data.number);
      
      // If append is true, add to existing reviews, otherwise replace them
      const reviews = data.content || [];
      if (append) {
        setYourReviews((prevReviews) => {
          const existingIds = new Set(prevReviews.map(r => r.id));
          const newUnique = reviews.filter(r => !existingIds.has(r.id));
          return [...prevReviews, ...newUnique];
        });
      } else {
        setYourReviews(reviews);
      }
      
  
      // Fetch user profile, likes and images for the new reviews
      if (reviews.length > 0) {
        // Fetch your own profile
        fetchUserProfile(userId);
  
        const counts = await fetchLikeCounts(reviews);
        setLikeCounts((prev) => ({ ...prev, ...counts }));
  
        const likedStatuses = await fetchLikedReviews(reviews);
        setLikedReviews((prev) => ({ ...prev, ...likedStatuses }));
  
        const images = await fetchAlbumImages(reviews);
        setAlbumImages((prevImages) => ({ ...prevImages, ...images }));
      }
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Error fetching your reviews:", error);
      }
    } finally {
      setLoadingMoreYourReviews(false);
    }
  };

  const fetchAlbumDetailsForAllReviews = async () => {
    if (!accessToken) return;
  
    const allReviews = [...popularReviews, ...followedReviews, ...yourReviews];
  
    // Get unique album IDs to avoid duplicate requests
    const uniqueSpotifyIds = [...new Set(allReviews.map((r) => r.spotifyId))];
    
    // Filter out albums we already have details for
    const newSpotifyIds = uniqueSpotifyIds.filter(id => !albumDetails[id]);
  
    for (let i = 0; i < newSpotifyIds.length; i++) {
      const spotifyId = newSpotifyIds[i];
      try {
        // Add delay between requests
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
  
        const response = await fetch(
          `https://api.spotify.com/v1/albums/${spotifyId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after') || 1;
          console.warn(`Rate limited by Spotify API. Waiting ${retryAfter}s before retry for album details ${spotifyId}`);
          
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000 + 500));
          
          const retryResponse = await fetch(
            `https://api.spotify.com/v1/albums/${spotifyId}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
          
          if (!retryResponse.ok) {
            console.warn(`Failed to fetch album details ${spotifyId} after retry: ${retryResponse.status}`);
            continue;
          }
          
          const data = await retryResponse.json();
          const albumName = data.name || "Unknown Album";
          const artistName = data.artists?.[0]?.name || "Unknown Artist";
          const releaseYear = data.release_date ? new Date(data.release_date).getFullYear() : null;
  
          setAlbumDetails((prev) => ({
            ...prev,
            [spotifyId]: {
              albumName,
              artistName,
              releaseYear,
            },
          }));
          continue;
        }
        
        // Check if response is OK before trying to parse JSON
        if (!response.ok) {
          console.warn(`Failed to fetch album ${spotifyId}: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const data = await response.json();
        
        const albumName = data.name || "Unknown Album";
        const artistName = data.artists?.[0]?.name || "Unknown Artist";
        const releaseYear = data.release_date ? new Date(data.release_date).getFullYear() : null;
  
        setAlbumDetails((prev) => ({
          ...prev,
          [spotifyId]: {
            albumName,
            artistName,
            releaseYear,
          },
        }));
      } catch (error) {
        console.error(
          `Error fetching details for album ID ${spotifyId}:`,
          error
        );
        
        // Add fallback data to prevent repeated failed requests
        setAlbumDetails((prev) => ({
          ...prev,
          [spotifyId]: {
            albumName: "Unknown Album",
            artistName: "Unknown Artist",
            releaseYear: null,
          },
        }));
      }
    }
  };

  const fetchLikeCounts = async (reviewsData) => {
    let likeCountsData = {};
    await Promise.all(
      reviewsData.map(async (review) => {
        try {
          const response = await fetch(
            `${BACKEND_REVIEW_LIKE_URL}/review-like/${review.id}/count`
          );
          const data = await response.json();
          likeCountsData[review.id] = data.success ? data.data : 0;
        } catch (error) {
          console.error(
            `Error fetching like count for review ${review.id}:`,
            error
          );
          likeCountsData[review.id] = 0;
        }
      })
    );
    return likeCountsData;
  };
  const useAlbumImages = (initialImages = {}) => {
    const [albumImages, setAlbumImages] = useState(initialImages);
    const [isFetching, setIsFetching] = useState(false);
    
    useEffect(() => {
      // Load cache on component mount
      const loadCache = async () => {
        const cachedImages = await loadImageCache();
        setAlbumImages(prev => ({ ...prev, ...cachedImages }));
      };
      
      loadCache();
    }, []);
  const fetchAlbumImages = async (reviewsData, accessToken, existingImages = {}) => {
    let images = { ...existingImages };
    
    // Identify which album images we need to fetch
    const idsToFetch = [];
    reviewsData.forEach(review => {
      if (!images[review.spotifyId]) {
        idsToFetch.push(review.spotifyId);
      }
    });
    
    if (idsToFetch.length === 0) {
      return images; // All images already cached
    }
    
    // Process in batches to respect API limits
    for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
      const batch = idsToFetch.slice(i, i + BATCH_SIZE);
      const idsParam = batch.join(',');
      
      try {
        // Add a small delay between batches to prevent rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const response = await fetch(
          `https://api.spotify.com/v1/albums?ids=${idsParam}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        
        if (response.status === 429) {
          // Handle rate limiting
          const retryAfter = response.headers.get('Retry-After') || 2;
          console.log(`Rate limited by Spotify, retrying after ${retryAfter} seconds`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          i -= BATCH_SIZE; // Retry this batch
          continue;
        }
        
        if (!response.ok) {
          throw new Error(`Spotify API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.albums) {
          const batchImages = {};
          data.albums.forEach((album) => {
            if (album && album.images && album.images.length > 0) {
              batchImages[album.id] = album.images[0].url;
            }
          });
          
          // Update images dictionary
          images = { ...images, ...batchImages };
          
          // Save to cache in real-time
          await saveImageCache(batchImages);
        }
      } catch (error) {
        console.error('Error batch fetching album images:', error);
      }
    }
    
    return images;
  };
  const fetchImages = async (reviewsData, accessToken) => {
    if (!accessToken || isFetching) return;
    
    setIsFetching(true);
    try {
      const updatedImages = await fetchAlbumImages(reviewsData, accessToken, albumImages);
      setAlbumImages(updatedImages);
    } finally {
      setIsFetching(false);
    }
  };
  
  return { albumImages, setAlbumImages, fetchImages, isFetching };
};
  const ListFooterComponent = () => {
    if (
      (selectedTab === "Popular" && currentBatchIndex < popularReviewIds.length) ||
      (selectedTab === "My reviews" && loadingMoreYourReviews && yourReviewsHasMore)
    ) {
      return (
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      );
    }
    return null;
  };
  const toggleLike = async (reviewId) => {
    const likeId = likedReviews[reviewId];

    // Optimistically update the UI
    const wasLiked = !!likeId;
    const previousLikeCount = likeCounts[reviewId] || 0;

    setLikedReviews((prev) => ({
      ...prev,
      [reviewId]: wasLiked ? null : true, // Using true as placeholder until we get the actual like ID
    }));

    setLikeCounts((prev) => ({
      ...prev,
      [reviewId]: wasLiked
        ? Math.max(previousLikeCount - 1, 0)
        : previousLikeCount + 1,
    }));

    try {
      if (wasLiked) {
        // Unlike operation
        const response = await fetch(
          `${BACKEND_REVIEW_LIKE_URL}/review-like/unlike/${likeId}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error("Unlike operation failed");
        }

        // If successful, we already updated the UI
      } else {
        // Like operation
        const response = await fetch(
          `${BACKEND_REVIEW_LIKE_URL}/review-like/like`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, reviewId }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error("Like operation failed");
        }

        // Update with the actual like ID from the server
        setLikedReviews((prev) => ({
          ...prev,
          [reviewId]: data.data, // This should be the like ID from the server
        }));
      }
    } catch (error) {
      console.error("Like/Unlike operation failed:", error);

      // Revert the optimistic update if the API call failed
      setLikedReviews((prev) => ({
        ...prev,
        [reviewId]: wasLiked ? likeId : null,
      }));

      setLikeCounts((prev) => ({
        ...prev,
        [reviewId]: previousLikeCount,
      }));

      Alert.alert("Error", "Could not update like status. Please try again.");
    }
  };

  useEffect(() => {
    if (refreshing) {
      fetchInitialData().then(() => setRefreshing(false));
    }
  }, [refreshing]);

  const handleDeleteReview = async (reviewId) => {
    try {
      const response = await fetch(
        `${BACKEND_REVIEW_URL}/review/delete/${reviewId}`,
        {
          method: "DELETE",
        }
      );
      if (response.ok) {
        setYourReviews((prevReviews) =>
          prevReviews.filter((review) => review.id !== reviewId)
        );
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setModalVisible(false));
      } else {
        Alert.alert("Error", "Failed to delete review");
      }
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Error deleting review:", error);
        Alert.alert("Error", "An error occurred while deleting the review");
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPopularReviewIds();
      await fetchFollowedReviews(0, false); // Reset to page 0
      await fetchYourReviews(0, false);     // Reset to page 0
    } finally {
      setRefreshing(false);
    }
  };
  

  const onEndReached = async () => {
    if (selectedTab === "Popular" && currentBatchIndex < popularReviewIds.length) {
      await fetchReviewsBatch(popularReviewIds, currentBatchIndex);
    } else if (selectedTab === "My reviews" && yourReviewsHasMore && !loadingMoreYourReviews) {
      await fetchYourReviews(yourReviewsPage + 1, true);
    } else if (selectedTab === "Following" && followedReviewsHasMore && !loadingMoreFollowedReviews) {
      await fetchFollowedReviews(followedReviewsPage + 1, true);
    }
  };
  

  const getReviewsForTab = () => {
    switch (selectedTab) {
      case "Popular":
        return popularReviews;
      case "Following":
        return followedReviews;
      case "My reviews":
        return yourReviews;
      default:
        return [];
    }
  };

  const openDeleteModal = () => {
    setModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      friction: 5,
      tension: 50,
      useNativeDriver: true,
    }).start();
  };

  const closeDeleteModal = () => {
    Animated.timing(slideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
  };

  const ReviewCard = ({
    review,
    albumImage,
    likedReviews,
    toggleLike,
    setModalVisible,
    setSelectedReviewId,
    userId,
  }) => {
    const [menuVisible, setMenuVisible] = useState(false);
    const isOwner = Number(review.userId) === Number(userId);
    const router = useRouter();

    useEffect(() => {
      if (!userProfiles[review.userId]) {
        fetchUserProfile(review.userId);
      }
    }, [review.userId]);

    const handlePress = () => {
      router.push({
        pathname: "/Screens/ReviewDetail/",
        params: {
          id: review.id,
          username: userProfiles[review.userId]?.username || "Unknown User",
          profileImage: userProfiles[review.userId]?.profileImage || null,
          createdAt: review.createdAt,
          comment: review.comment,
          rating: review.rating,
          likeCount: likeCounts[review.id] || 0,
          spotifyId: review.spotifyId,
          isLiked: Boolean(likedReviews[review.id]),
          likeId: likedReviews[review.id] || null,
          reviewUserId: review.userId,
        },
      });
    };

    return (
      <View style={styles.cardContainer}>
        {/* Make the main content area clickable */}
        <TouchableWithoutFeedback onPress={handlePress}>
          <View>
            {/* Profile section */}
            <View style={styles.profileSection}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() => {
                    router.push({
                      pathname: "/Screens/Profile/Profile/",
                      params: { userId: review.userId },
                    });
                  }}
                >
                  <Image
                    source={{
                      uri: getProfileImageUrl(
                        userProfiles[review.userId]?.profileImage
                      ),
                    }}
                    style={styles.profilePhoto}
                  />
                </TouchableOpacity>

                <View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={styles.ReviewBy}>Review by </Text>
                    <TouchableOpacity
                      onPress={() => {
                        router.push({
                          pathname: "/Screens/Profile/Profile/",
                          params: { userId: review.userId },
                        });
                      }}
                    >
                      <Text style={styles.userName}>
                        {userProfiles[review.userId]?.username ||
                          `User ${review.userId}`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(review.createdAt).toDateString()}
                  </Text>
                </View>
              </View>

              {isOwner && (
                <Menu
                  visible={menuVisible}
                  onDismiss={() => setMenuVisible(false)}
                  anchor={
                    <TouchableOpacity onPress={() => setMenuVisible(true)}>
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={24}
                        color="white"
                        style={{ marginTop: -20 }}
                      />
                    </TouchableOpacity>
                  }
                >
                  <Menu.Item
                    onPress={() => {
                      setSelectedReviewId(review.id);
                      openDeleteModal();
                      setMenuVisible(false);
                    }}
                    title="Delete"
                    leadingIcon="delete"
                  />

                  <Menu.Item
                    onPress={async () => {
                      setMenuVisible(false);

                      let details = albumDetails[review.spotifyId];

                      if (!details) {
                        try {
                          const response = await fetch(
                            `https://api.spotify.com/v1/albums/${review.spotifyId}`,
                            {
                              headers: {
                                Authorization: `Bearer ${accessToken}`,
                              },
                            }
                          );
                          const data = await response.json();
                          details = {
                            albumName: data.name,
                            artistName:
                              data.artists?.[0]?.name || "Unknown Artist",
                            releaseYear: new Date(
                              data.release_date
                            ).getFullYear(),
                          };
                        } catch (error) {
                          console.error(
                            "Error fetching album details for update:",
                            error
                          );
                        }
                      }

                      const album = {
                        id: review.spotifyId,
                        name: details?.albumName || "Unknown Album",
                        images: [{ url: albumImages[review.spotifyId] || "" }],
                        release_date: details?.releaseYear
                          ? `${details.releaseYear}-01-01`
                          : "2023-01-01",
                        artists: [
                          {
                            name: details?.artistName || "Unknown Artist",
                          },
                        ],
                      };

                      router.push({
                        pathname: "Screens/Review/Entry",
                        params: {
                          selectedAlbum: JSON.stringify(album),
                          reviewToUpdate: JSON.stringify(review),
                          isUpdateFlow: true,
                        },
                      });
                    }}
                    title="Update"
                    leadingIcon="pencil"
                  />
                </Menu>
              )}
            </View>

            <View style={styles.divider} />

            {/* Album + Review section */}
            <View style={styles.reviewMainContent}>
              <Image source={{ uri: albumImage }} style={styles.albumCover} />
              <View style={styles.reviewTextContainer}>
                <Text
                  style={styles.reviewText}
                  numberOfLines={5}
                  ellipsizeMode="tail"
                >
                  {review.comment}
                </Text>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>

        {/* Footer with rating and like button */}
        <View style={styles.reviewFooter}>
          <View style={styles.rating}>
            {[...Array(5)].map((_, i) => {
              const diff = review.rating - i;
              let iconName = "star-outline";
              if (diff >= 1) {
                iconName = "star";
              } else if (diff >= 0.5) {
                iconName = "star-half";
              }

              return (
                <Ionicons key={i} name={iconName} size={16} color="#FFD700" />
              );
            })}
          </View>
          <TouchableOpacity
            onPress={() => toggleLike(review.id)}
            style={styles.likeButton}
          >
            <View style={styles.likeContainer}>
              <Ionicons
                name={likedReviews[review.id] ? "heart" : "heart-outline"}
                size={20}
                color={likedReviews[review.id] ? "red" : "white"}
              />
              <Text style={styles.likeText}>
                {likeCounts[review.id] || 0} Likes
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        {["Popular", "Following", "My reviews"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, selectedTab === tab && styles.activeTab]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === tab && styles.activeTabText,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={getReviewsForTab()}
        keyExtractor={(item, index) => `${item.id.toString()}-${index}`}
        renderItem={({ item }) => (
          <ReviewCard
            review={item}
            albumImage={albumImages[item.spotifyId]}
            likedReviews={likedReviews}
            toggleLike={toggleLike}
            setModalVisible={setModalVisible}
            setSelectedReviewId={setSelectedReviewId}
            userId={userId}
            ListFooterComponent={ListFooterComponent}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={() => {
          if (selectedTab === "Popular") {
            return (
              <EmptyState message="Looks like there are no popular reviews yet." />
            );
          } else if (selectedTab === "Following") {
            return (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <EmptyState message="The people you follow seem to be quiet." />
                <TouchableOpacity
                  style={styles.tabButtons}
                  onPress={() => {
                    router.push({
                      pathname: "/Screens/Search/Main/",
                    });
                  }}
                >
                  <Text style={styles.tabButtonTexts}>
                    Find More People to Follow
                  </Text>
                </TouchableOpacity>
              </View>
            );
          } else if (selectedTab === "My reviews") {
            return (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <EmptyState message="You don't seem to have posted any reviews." />
                <TouchableOpacity
                  style={styles.tabButtons}
                  onPress={() => {
                    router.push({
                      pathname: "/Screens/Review/Entry/",
                      params: {
                        selectedAlbum: null,
                        reviewToUpdate: null,
                        isUpdateFlow: false,
                      },
                    });
                  }}
                >
                  <Text style={styles.tabButtonTexts}>
                    Post Your First Review
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }
          return null;
        }}
      />
      <Modal
        transparent={true}
        animationType="none"
        visible={modalVisible}
        onRequestClose={closeDeleteModal}
      >
        <TouchableWithoutFeedback onPress={closeDeleteModal}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
          >
            <TouchableWithoutFeedback>
              <Animated.View
                style={{
                  backgroundColor: "#1E1E1E",
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  padding: 20,
                  transform: [{ translateY: slideAnim }],
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 18,
                    textAlign: "center",
                    marginBottom: 20,
                  }}
                >
                  Are you sure you want to delete your review?
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-around",
                  }}
                >
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#FF0000",
                      paddingVertical: 10,
                      paddingHorizontal: 20,
                      borderRadius: 10,
                    }}
                    onPress={() => handleDeleteReview(selectedReviewId)}
                  >
                    <Text style={{ color: "white", fontWeight: "bold" }}>
                      Yes
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      backgroundColor: "#888",
                      paddingVertical: 10,
                      paddingHorizontal: 20,
                      borderRadius: 10,
                    }}
                    onPress={closeDeleteModal}
                  >
                    <Text style={{ color: "white", fontWeight: "bold" }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const EmptyState = ({ message }) => (
  <View style={styles.emptyStateContainer}>
    <Image
      source={require("../../../../assets/images/luci-black.png")}
      style={styles.emptyImage}
      resizeMode="contain"
    />
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  albumCover: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
  },
  reviewContent: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
    marginBottom: 3,
  },
  reviewDate: {
    fontSize: 10,
    color: "gray",
    marginBottom: 5,
  },
  reviewText: {
    fontSize: 14,
    color: "lightgray",
  },
  reviewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  rating: {
    marginLeft: 10,
    flexDirection: "row",
  },
  likeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeText: {
    color: "white",
    marginLeft: 5,
  },
  deleteButton: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    width: "40%",
    alignItems: "center",
  },
  buttonYes: {
    backgroundColor: "#FF0000",
  },
  buttonNo: {
    backgroundColor: "#2196F3",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  deleteSwipeContainer: {
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "red",
    width: 130,
    height: "75%",
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    marginRight: 10,
  },
  deleteText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: "#1E1E1E",
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: "white",
  },
  tabText: {
    color: "gray",
    fontSize: 16,
  },
  activeTabText: {
    color: "black",
    fontWeight: "bold",
  },
  profilePhoto: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  ReviewBy: {
    color: "lightgrey",
    fontSize: 12,
  },
  commentScrollWrapper: {
    maxHeight: 100,
    overflow: "hidden",
  },
  imageModalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  imageModalCloseButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 1,
  },
  imageModalImage: {
    width: 300,
    height: 300,
    borderRadius: 10,
  },
  imageModalText: {
    fontSize: 24,
    color: "white",
    marginTop: 20,
  },
  imageModalTextSmall: {
    fontSize: 16,
    color: "gray",
    marginTop: 4,
  },
  spotifyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1DB954",
    padding: 10,
    borderRadius: 5,
    marginTop: 20,
    width: 200,
  },
  spotifyButtonText: {
    color: "white",
    fontSize: 16,
    marginLeft: 10,
  },
  imageModalContent: {
    alignItems: "center",
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 200,
  },
  emptyImage: {
    width: 100,
    height: 100,
    marginBottom: 0,
  },
  emptyText: {
    color: "gray",
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  tabButtons: {
    backgroundColor: "#1DB954",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 16,
  },
  tabButtonTexts: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  cardContainer: {
    flexDirection: "column",
    backgroundColor: "#1E1E1E",
    margin: 10,
    borderRadius: 10,
    padding: 10,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
  },
  divider: {
    borderBottomColor: "#333",
    borderBottomWidth: 1,
    marginVertical: 6,
    marginBottom: 10,
  },
  reviewMainContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  reviewTextContainer: {
    flex: 1,
    marginLeft: 10,
    maxHeight: 100,
  },
  likeButton: {
    padding: 5,
    marginLeft: 10,
  },
  profilePhoto: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  ReviewBy: {
    color: "lightgrey",
    fontSize: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
    marginBottom: 3,
  },
  reviewDate: {
    fontSize: 10,
    color: "gray",
  },
  albumCover: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  reviewText: {
    fontSize: 14,
    color: "lightgray",
    lineHeight: 20,
  },
  reviewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 5,
  },
  rating: {
    flexDirection: "row",
  },
  likeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeText: {
    color: "white",
    marginLeft: 5,
    fontSize: 14,
  },
});
