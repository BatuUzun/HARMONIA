import React, { useState, useEffect, useContext,   useCallback, } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,

  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getUserProfile } from "../../../api/backend";
import {
  getAccessToken,
  searchArtists,
  searchAlbums,
} from "../../../api/spotify";
import axios from "axios";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { Linking } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { Keyboard } from "react-native";
import { AuthContext } from "../../../context/AuthContext";
import { TouchableWithoutFeedback } from "react-native";
import { useNavigation, useFocusEffect  } from "@react-navigation/native";
import { Menu , Portal  } from "react-native-paper";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
  BACKEND_REVIEW_LIKE_URL,
  BACKEND_REVIEW_URL,
  BACKEND_USER_FOLLOW_URL,
  BACKEND_FAVORITE_URL,
  BACKEND_PROFILE_PICTURE_DOWNLOADER_URL,
} from "../../../constants/apiConstants";

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useContext(AuthContext);
  const { userId: loggedInUserId } = useContext(AuthContext);
  const { userId } = useLocalSearchParams();
  const [currentUserId, setCurrentUserId] = useState(null);
  const defaultProfileImage = require("../../../../assets/images/default-profile-photo.webp");
  const navigation = useNavigation();
  const [profileLoading, setProfileLoading] = useState(false);


  useFocusEffect(
    React.useCallback(() => {
      console.log("📌 ProfileScreen focus oldu, veriler tazeleniyor...");
      fetchProfileAndFavorites(); 
    }, [currentUserId])
  );

  useEffect(() => {
    if (userId) {
      setCurrentUserId(userId);
    } else {
      setCurrentUserId(loggedInUserId);
    }
  }, [userId, loggedInUserId]);

  useEffect(() => {
    if (currentUserId) {
      fetchProfileAndFavorites();
    }
  }, [currentUserId]);

  const [profile, setProfile] = useState({
    username: "",
    bio: "",
    location: "",
    link: "",
    profileImage: "",
    favoriteAlbums: Array(4).fill(null),
    favoriteArtists: Array(4).fill(null),
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [accessToken, setAccessToken] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("albums");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [reviewsRefreshing, setReviewsRefreshing] = useState(false);

  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [followingModalVisible, setFollowingModalVisible] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
  const [albumImages, setAlbumImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [likedReviews, setLikedReviews] = useState({});
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const [nextFollowersCursor, setNextFollowersCursor] = useState(null);
  const [nextFollowingCursor, setNextFollowingCursor] = useState(null);
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(false);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [likeCounts, setLikeCounts] = useState({});
  const [selectedAlbumInfo, setSelectedAlbumInfo] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [albumDetails, setAlbumDetails] = useState({});


  const SPOTIFY_API_URL = "https://api.spotify.com/v1/albums";
  const SPOTIFY_ALBUM_API_URL = "https://api.spotify.com/v1/albums";
  const SPOTIFY_ARTIST_API_URL = "https://api.spotify.com/v1/artists";

  const getProfileImageUrl = (fileName) => {
    if (!fileName || fileName === "default.png") {
      return Image.resolveAssetSource(defaultProfileImage).uri;
    }
    return `${BACKEND_PROFILE_PICTURE_DOWNLOADER_URL}/s3/download/${fileName}`;
  };

  const fetchInitialData = async () => {
    setLoading(true);
    setUserProfiles({});
    await fetchPopularReviewIds();
    await fetchFollowedReviews();
    await fetchYourReviews();
    setLoading(false);
  };

    useEffect(() => {
      if (refreshing) {
        fetchInitialData().then(() => setRefreshing(false));
      }
    }, [refreshing]);

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

    const fetchAlbumDetailsForAllReviews = async () => {
      if (!accessToken) return;

      const allReviews = [...popularReviews, ...followedReviews, ...yourReviews];

      // Aynı albüm id'sine sahip reviewlar olabilir, tekrar fetch etmeyelim
      const uniqueSpotifyIds = [...new Set(allReviews.map((r) => r.spotifyId))];

      for (const spotifyId of uniqueSpotifyIds) {
        try {
          const response = await fetch(
            `https://api.spotify.com/v1/albums/${spotifyId}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
          const data = await response.json();
          const albumName = data.name;
          const artistName = data.artists?.[0]?.name || "Unknown Artist";
          const releaseYear = new Date(data.release_date).getFullYear();

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
        }
      }
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
        console.error("❌ Spotify token alınamadı:", data);
      }
    } catch (error) {
      console.error("❌ Spotify token hatası:", error);
    }
  };

  useEffect(() => {
    if (followersModalVisible) {
      fetchFollowers();
    }
  }, [followersModalVisible]);

  useEffect(() => {
    if (followingModalVisible) {
      fetchFollowing();
    }
  }, [followingModalVisible]);

  useEffect(() => {
    fetchSpotifyAccessToken();
  }, []);

  const toggleLike = async (reviewId) => {
    const likeId = likedReviews[reviewId];
    const wasLiked = !!likeId;
    const previousLikeCount = likeCounts[reviewId] || 0;

    setLikedReviews((prev) => ({
      ...prev,
      [reviewId]: wasLiked ? null : true,
    }));

    setLikeCounts((prev) => ({
      ...prev,
      [reviewId]: wasLiked
        ? Math.max(previousLikeCount - 1, 0)
        : previousLikeCount + 1,
    }));

    try {
      if (wasLiked) {
        await fetch(`${BACKEND_REVIEW_LIKE_URL}/review-like/unlike/${likeId}`, {
          method: "DELETE",
        });
      } else {
        const response = await fetch(`${BACKEND_REVIEW_LIKE_URL}/review-like/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId, reviewId }),
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setLikedReviews((prev) => ({
            ...prev,
            [reviewId]: data.data, // serverdan gelen likeId
          }));
        }
      }
    } catch (error) {
      console.error("Like/Unlike Error:", error);
    }
  };

  const fetchLikeCounts = async (reviewsData) => {
    let likeCountsData = {};
    await Promise.all(
      reviewsData.map(async (review) => {
        try {
          const response = await fetch(`${BACKEND_REVIEW_LIKE_URL}/review-like/${review.id}/count`);
          const data = await response.json();
          likeCountsData[review.id] = data.success ? data.data : 0;
        } catch (error) {
          likeCountsData[review.id] = 0;
        }
      })
    );
    return likeCountsData;
  };

  const fetchLikedReviews = async (reviewsData) => {
    let likedReviewsData = {};
    await Promise.all(
      reviewsData.map(async (review) => {
        try {
          const url = `${BACKEND_REVIEW_LIKE_URL}/review-like/${review.id}/is-liked/${currentUserId}`;
          const response = await fetch(url);
          const text = await response.text();
          const data = JSON.parse(text);
          likedReviewsData[review.id] = data.id ? data.id : null;
        } catch (error) {
          likedReviewsData[review.id] = null;
        }
      })
    );
    return likedReviewsData;
  };

  const handleDeleteReview = async (reviewId) => {
    try {
      const response = await fetch(
        `${BACKEND_REVIEW_URL}/review/delete/${reviewId}`,
        {
          method: "DELETE",
        }
      );
      if (response.ok) {
        setReviews((prevReviews) =>
          prevReviews.filter((review) => review.id !== reviewId)
        );
        Alert.alert("Başarılı", "Review silindi.");
        setModalVisible(false);
        fetchUsersReviews();
      } else {
        Alert.alert("Hata", "Review silinemedi.");
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      Alert.alert("Error", "An error occurred while deleting the review");
    }
  };

  const fetchUsersReviews = async () => {
    try {
      setReviewsRefreshing(true);
      console.log("🔍 Kullanıcının reviewları getiriliyor...");

      const response = await fetch(
        `${BACKEND_REVIEW_URL}/review/get-reviews/user/${currentUserId}`
      );
      const data = await response.json();
      setReviews(data.content || []);
      setReviewCount(data.content ? data.content.length : 0);
      console.log("API Yanıtı:", data);
      const counts = await fetchLikeCounts(data.content || []);
      setLikeCounts(counts);
      const likedStatuses = await fetchLikedReviews(data.content || []);
      setLikedReviews((prev) => ({ ...prev, ...likedStatuses }));


      const reviewsWithAlbumNames = await Promise.all(
        data.content.map(async (review) => {
          try {
            const spotifyResponse = await fetch(
              `${SPOTIFY_API_URL}/${review.spotifyId}`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            const spotifyData = await spotifyResponse.json();
            return {
              ...review,
              albumName: spotifyData.name,
            };
          } catch (error) {
            console.error(
              `❌ Albüm adı çekme hatası (${review.spotifyId}):`,
              error
            );
            return review;
          }
        })
      );

      setReviews(reviewsWithAlbumNames || []);
      setReviewCount(reviewsWithAlbumNames ? reviewsWithAlbumNames.length : 0);
      console.log("API Yanıtı:", reviewsWithAlbumNames);

      const images = await fetchAlbumImages(data.content || []);
      setAlbumImages(images);
      setLoading(false);
    } catch (error) {
      console.error("❌ Reviewları getirirken hata oluştu:", error);
      setLoading(false);
    } finally {
      setReviewsRefreshing(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchUsersReviews();
    }
  }, [accessToken, currentUserId]);

  const onRefreshReviews = () => {
    fetchUsersReviews();
  };

  const onRefreshProfile = async () => {
    setRefreshing(true);
    try {
      await fetchProfileAndFavorites();
    } catch (error) {
      console.error("❌ Profil yenilenirken hata oluştu:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchAlbumImages = async (reviewsData) => {
    let images = {};

    await Promise.all(
      reviewsData.map(async (review) => {
        try {
          if (!review.spotifyId) {
            console.warn(`⚠ Missing spotifyId for review:`, review);
            images[review.spotifyId] = null;
            return;
          }

          const response = await fetch(
            `${SPOTIFY_API_URL}/${review.spotifyId}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (!response.ok) {
            console.warn(`⚠ Spotify API hatası: ${response.status}`);
            console.warn(`⚠ Spotify ID: ${review.spotifyId}`);
            images[review.spotifyId] = null;
            return;
          }

          const data = await response.json();
          images[review.spotifyId] = data.images?.[0]?.url || null;

          console.log(
            `✅ ${review.spotifyId} için resim bulundu:`,
            images[review.spotifyId]
          );
        } catch (error) {
          console.error(
            `❌ Albüm resmi çekme hatası (${review.spotifyId}):`,
            error
          );
          images[review.spotifyId] = null;
        }
      })
    );

    return images;
  };

  const addFavorite = async (userId, spotifyId, type) => {
    try {
      console.log(
        `Adding favorite: userId=${userId}, spotifyId=${spotifyId}, type=${type}`
      );
      await axios.post(`${BACKEND_FAVORITE_URL}/favorite/add-favorite`, {
        userId,
        spotifyId,
        type,
      });
      console.log(`✅ Başarıyla eklendi: ${type} - ${spotifyId}`);
    } catch (error) {
      
    }
  };

  const getUserFavoritesImages = async (accessToken, userId) => {
    try {
      console.log(`🔍 Favoriler çekiliyor: userId=${userId}`);

      const [albumsResponse, artistsResponse] = await Promise.all([
        axios
          .get(`${BACKEND_FAVORITE_URL}/favorite/user/${userId}/album?page=0`)
          .then((response) => {
            console.log("✅ Albüm API başarılı:", response.data);
            return response.data.content;
          })
          .catch((error) => {
            return null;
          }),

        axios
          .get(`${BACKEND_FAVORITE_URL}/favorite/user/${userId}/artist?page=0`)
          .then((response) => {
            console.log("✅ Sanatçı API başarılı:", response.data);
            return response.data.content;
          })
          .catch((error) => {

            return null;
          }),
      ]);

      console.log("📌 API Yanıtları:", { albumsResponse, artistsResponse });

      const albums = Array.isArray(albumsResponse) ? albumsResponse : [];
      const artists = Array.isArray(artistsResponse) ? artistsResponse : [];

      const favorites = [...albums, ...artists];

      if (favorites.length === 0) {
        console.log("ℹ Kullanıcının favorisi yok.");
        return [];
      }

      console.log("✅ Favoriler başarıyla alındı:", favorites);

      const images = [];

      for (const favorite of favorites) {
        const { type, spotifyId } = favorite;

        if (!type || !spotifyId) {
          console.warn(`⚠ Geçersiz favori öğesi atlandı:`, favorite);
          continue;
        }

        try {
          const url =
            type === "album"
              ? `${SPOTIFY_ALBUM_API_URL}/${spotifyId}`
              : `${SPOTIFY_ARTIST_API_URL}/${spotifyId}`;

          console.log(`🔄 Spotify'dan çekiliyor: ${url}`);

          const spotifyResponse = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!spotifyResponse.ok) {
            console.warn(
              `⚠ Spotify API hatası: ${spotifyResponse.status} - ${spotifyId}`
            );
            continue;
          }

          const data = await spotifyResponse.json();

          if (!data || !data.name) {
            console.warn(`⚠ Spotify'dan geçersiz veri geldi:`, data);
            continue;
          }

          images.push({
            favoriteId: favorite.id,
            id: spotifyId,
            name: data.name,
            image: data.images?.[0]?.url || null,
            type,
          });

          console.log(`✅ ${spotifyId} için resim başarıyla çekildi.`);
        } catch (error) {
          console.error(
            
            error
          );
        }
      }

      console.log("✅ Favori görselleri başarıyla çekildi:", images);
      return images;
    } catch (error) {
      console.error(
        
        error
      );
      return [];
    }
  };

  const fetchProfileAndFavorites = async () => {
    try {
      setProfileLoading(true); 
      console.log("⏳ Kullanıcı profili çekiliyor...");
      const userData = await getUserProfile(currentUserId);

      if (!userData) throw new Error("❌ Kullanıcı bilgisi alınamadı.");

      const token = await getAccessToken();
      setAccessToken(token);

      console.log("⏳ Kullanıcı favorileri ve görselleri çekiliyor...");
      const images = await getUserFavoritesImages(token, currentUserId);

      console.log("✅ Favori görselleri çekildi:", images);

      const favoriteAlbumsData = images.filter((fav) => fav.type === "album");
      const favoriteArtistsData = images.filter((fav) => fav.type === "artist");

      setProfile({
        username: userData.username || "Unknown",
        bio: userData.bio || "No bio available",
        location: userData.location || "Unknown location",
        link: userData.link || "Unknown link",
        profileImage: userData.profileImage || defaultProfileImage,
        favoriteAlbums: favoriteAlbumsData.length > 0 ? favoriteAlbumsData : [],
        favoriteArtists:
          favoriteArtistsData.length > 0 ? favoriteArtistsData : [],
      });

      console.log("✅ Güncellenmiş profil state:", profile);
    } catch (error) {

    }
    setProfileLoading(false);
  };

  useEffect(() => {
    fetchProfileAndFavorites();
  }, [currentUserId]);

  useEffect(() => {
    const updateFavoritesImages = async () => {
      if (!accessToken) return;

      console.log("🔄 Favoriler tekrar güncelleniyor...");

      const allFavorites = [
        ...profile.favoriteAlbums,
        ...profile.favoriteArtists,
      ].filter((fav) => fav && !fav.image);

      if (allFavorites.length === 0) return;

      const updatedImages = await fetchFavoritesImages(allFavorites);

      setProfile((prevProfile) => ({
        ...prevProfile,
        favoriteAlbums: prevProfile.favoriteAlbums.map((album) =>
          album && !album.image
            ? { ...album, image: updatedImages[album.id] }
            : album
        ),
        favoriteArtists: prevProfile.favoriteArtists.map((artist) =>
          artist && !artist.image
            ? { ...artist, image: updatedImages[artist.id] }
            : artist
        ),
      }));

      console.log("✅ Eksik resimler güncellendi!");
    };

    updateFavoritesImages();
  }, [profile.favoriteAlbums, profile.favoriteArtists]);

  const openSpotify = (item) => {
    if (!item || !item.id) {
      console.error("❌ Geçersiz öğe:", item);
      return;
    }

    const url =
      item.type === "album"
        ? `https://open.spotify.com/album/${item.id}`
        : `https://open.spotify.com/artist/${item.id}`;

    Linking.openURL(url).catch((err) =>
      console.error("❌ Spotify açılırken hata oluştu:", err)
    );
  };

  const handleAlbumOrArtistPress = (index, category) => {
    if (currentUserId === loggedInUserId) {
      setSelectedCategory(category);
      setSelectedIndex(index);
      setSearchModalVisible(true);
    } else {
      const item =
        category === "albums"
          ? profile.favoriteAlbums[index]
          : profile.favoriteArtists[index];
      setSelectedItem(item);
      setImageModalVisible(true);
    }
  };

  const handleLongPressFavorite = (item) => {
    if (!item || !item.favoriteId) {
      console.error("❌ Favori item geçersiz:", item);
      return;
    }
  
    Alert.alert(
      "Delete Favorite",
      `Are you sure you want to delete this ${item.type === "album" ? "album" : "artist"}?`,
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes",
          onPress: async () => {
            try {
              await axios.delete(`${BACKEND_FAVORITE_URL}/favorite/remove-favorite/${item.favoriteId}`);
              Alert.alert("Success", `${item.type === "album" ? "Album" : "Artist"} deleted.`);
              fetchProfileAndFavorites(); // Favoriler ekranı güncellensin
            } catch (error) {
              console.error("❌ Favori silinirken hata:", error);
              Alert.alert("Error", "Failed to delete favorite.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const ImageModal = () => (
    <Modal visible={imageModalVisible} animationType="fade" transparent={true}>
      <View style={styles.imageModalBackground}>
        <TouchableOpacity
          style={styles.imageModalCloseButton}
          onPress={() => setImageModalVisible(false)}
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <Image
          source={{ uri: selectedItem?.image }}
          style={styles.imageModalImage}
        />
        <Text style={styles.imageModalText}>{selectedItem?.name}</Text>

        <TouchableOpacity
          style={styles.spotifyButton}
          onPress={() => openSpotify(selectedItem)}
        >
          <FontAwesome name="spotify" size={24} color="white" />
          <Text style={styles.spotifyButtonText}>Open in Spotify</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await getAccessToken();
        console.log("🔑 Access Token:", token);
        setAccessToken(token);
      } catch (error) {
        console.error("❌ Error fetching access token:", error);
      }
    };
    fetchToken();
  }, []);

  useEffect(() => {
    if (searchModalVisible) {
      setSearchText("");
      setSearchResults([]);
    }
  }, [searchModalVisible]);

  const handleSearch = async (text) => {
    setSearchText(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      let results;
      if (selectedCategory === "artists") {
        results = await searchArtists(accessToken, text);
      } else {
        results = await searchAlbums(accessToken, text);
      }
      setSearchResults(results);
    } catch (error) {
      console.error("Search Error:", error);
    }
  };

  const handleSelectItem = async (item) => {
    try {
      const updatedProfile = { ...profile };

      if (selectedCategory === "artists") {
        const existingFavorite = updatedProfile.favoriteArtists[selectedIndex];
        if (existingFavorite) {
          await axios.put(
            `${BACKEND_FAVORITE_URL}/favorite/replace-favorite/${existingFavorite.id}`,
            {
              userId: currentUserId,
              spotifyId: item.id,
              type: "artist",
            }
          );
        } else {
          await addFavorite(currentUserId, item.id, "artist");
        }
        updatedProfile.favoriteArtists[selectedIndex] = item;
      } else {
        const existingFavorite = updatedProfile.favoriteAlbums[selectedIndex];
        if (existingFavorite) {
          await axios.put(
            `${BACKEND_FAVORITE_URL}/favorite/replace-favorite/${existingFavorite.id}`,
            {
              userId: currentUserId,
              spotifyId: item.id,
              type: "album",
            }
          );
        } else {
          await addFavorite(currentUserId, item.id, "album");
        }
        updatedProfile.favoriteAlbums[selectedIndex] = item;
      }

      const imageUrl = await fetchImageFromSpotify(item.id, selectedCategory);
      if (imageUrl) {
        if (selectedCategory === "artists") {
          updatedProfile.favoriteArtists[selectedIndex].image = imageUrl;
        } else {
          updatedProfile.favoriteAlbums[selectedIndex].image = imageUrl;
        }
      }

      setProfile(updatedProfile);
      setSearchModalVisible(false);
      await fetchProfileAndFavorites();
    } catch (error) {
      console.error("Error while selecting item:", error);
    }
  };

  const fetchImageFromSpotify = async (spotifyId, type) => {
    try {
      const url =
        type === "album"
          ? `${SPOTIFY_ALBUM_API_URL}/${spotifyId}`
          : `${SPOTIFY_ARTIST_API_URL}/${spotifyId}`;

      console.log("Fetching image from Spotify API:", url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        console.warn(`⚠ Spotify API hatası: ${response.status}`);
        console.warn("Response:", await response.text());
        return null;
      }

      const data = await response.json();
      console.log("Spotify API response:", data);
      return data.images?.[0]?.url || null;
    } catch (error) {
      console.error(`❌ Spotify API çağrısı başarısız (${spotifyId}):`, error);
      return null;
    }
  };

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const fetchFollowCounts = async () => {
    try {
      const followerResponse = await axios.get(
        `${BACKEND_USER_FOLLOW_URL}/user-follow/follower-count?userProfileId=${currentUserId}`
      );
      const followingResponse = await axios.get(
        `${BACKEND_USER_FOLLOW_URL}/user-follow/following-count?userProfileId=${currentUserId}`
      );

      console.log("📥 Follower Count Response:", followerResponse.data);
      console.log("📥 Following Count Response:", followingResponse.data);

      setFollowerCount(Number(followerResponse.data));
      setFollowingCount(Number(followingResponse.data));
    } catch (error) {
      console.error(
        "❌ API'den gelen hata:",
        error.response ? error.response.data : error.message
      );
    }
  };

  useEffect(() => {
    console.log("📌 currentUserId:", currentUserId);
    if (currentUserId) fetchFollowCounts();
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      fetchFollowCounts();
      fetchFollowers();
      fetchFollowing();
    }
  }, [currentUserId]);

  const openFollowersModal = () => {
    setNextFollowersCursor(null); // Eski cursor'ı temizle
    fetchFollowers(); // Yeniden baştan yükle
    setFollowersModalVisible(true);
    console.log("Followers API Response:", data);
    console.log(`Fetching followers with cursor: ${cursor}`);
  };

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);

  const fetchFollowers = async (cursor = null) => {
    try {
      setIsLoadingFollowers(true);
      let url = `${BACKEND_USER_FOLLOW_URL}/user-follow/followers?userId=${currentUserId}`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data && data.items) {
        if (cursor) {
          setFollowers((prev) => [...prev, ...data.items]);
        } else {
          setFollowers(data.items);
        }
        setNextFollowersCursor(data.nextCursor);
      } else {
        console.log("❌ Takipçi verisi doğru gelmedi:", data);

        setFollowers([]);
      }
    } catch (error) {
      console.error("❌ Takipçiler alınırken hata oluştu:", error);
      setFollowers([]);
    } finally {
      setIsLoadingFollowers(false);
    }
  };

  const fetchFollowing = async (cursor = null) => {
    try {
      setIsLoadingFollowing(true);

      let url = `${BACKEND_USER_FOLLOW_URL}/user-follow/followings?userId=${currentUserId}`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`; // encode önemli
      }

      const response = await fetch(url);
      const data = await response.json();

      console.log("📥 Gelen following data:", data);

      if (data && data.items) {
        if (cursor) {
          setFollowing((prev) => [...prev, ...data.items]);
        } else {
          setFollowing(data.items);
        }

        setNextFollowingCursor(data.nextCursor); // Sonuncunun date'ini kullan
      } else {
        console.warn("❌ Takip edilen verisi doğru gelmedi:", data);
      }
    } catch (error) {
      console.error("❌ Takip edilen alınırken hata oluştu:", error);
    } finally {
      setIsLoadingFollowing(false);
    }
  };

  console.log("followers list:", followers);
  console.log("following list:", following);

  const checkIsFollowing = async () => {
    if (!loggedInUserId || !currentUserId || loggedInUserId === currentUserId) {
      setIsFollowing(false); // kendini takip etmiyorsun
      return;
    }

    try {
      const response = await axios.get(
        `${BACKEND_USER_FOLLOW_URL}/user-follow/is-following`,
        {
          params: {
            followerId: loggedInUserId,
            followedId: currentUserId,
          },
        }
      );
      setIsFollowing(response.data === true);
    } catch (error) {
      console.error("❌ Takip durumu kontrolü hatası:", error);
      setIsFollowing(false);
    }
  };

  useEffect(() => {
    if (currentUserId) {
      checkIsFollowing();
    }
  }, [currentUserId, loggedInUserId]);

  const handleFollow = async () => {
    try {
      const endpoint = isFollowing ? "unfollow" : "follow";
      await axios({
        method: isFollowing ? "delete" : "post",
        url: `${BACKEND_USER_FOLLOW_URL}/user-follow/${endpoint}`,
        data: {
          followerId: loggedInUserId,
          followedId: currentUserId,
        },
      });

      setIsFollowing((prev) => !prev);

      setTimeout(() => {
        fetchFollowCounts();
        fetchFollowers();
        fetchFollowing();
      }, 300);
    } catch (error) {
      console.error("Takip işlemi hatası:", error);
    }
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
     const router = useRouter();
     const isOwner = Number(review.userId) === Number(userId);

 
     useEffect(() => {
       if (!userProfiles[review.userId]) {
         fetchUserProfile(review.userId);
       }
     }, [review.userId]);

     const AlbumImageModal = () => {
         const details = albumDetails[selectedAlbumInfo?.spotifyId];
     
         return (
           <Modal
             visible={imageModalVisible}
             animationType="fade"
             transparent={true}
             onDismiss={() => setSelectedAlbumInfo(null)}
           >
             <TouchableWithoutFeedback
               onPress={() => {
                 setImageModalVisible(false);
               }}
             >
               <View style={styles.imageModalBackground}>
                 <TouchableWithoutFeedback>
                   <View style={styles.imageModalContent}>
                     <Image
                       source={{ uri: selectedAlbumInfo?.image }}
                       style={styles.imageModalImage}
                     />
                     <Text style={styles.imageModalText}>
                       {details?.albumName || "Album"}
                     </Text>
                     <Text style={styles.imageModalTextSmall}>
                       {details?.artistName || "Artist"} •{" "}
                       {details?.releaseYear || "Year"}
                     </Text>
     
                     <TouchableOpacity
                       style={styles.spotifyButton}
                       onPress={() =>
                         Linking.openURL(
                           `https://open.spotify.com/album/${selectedAlbumInfo?.spotifyId}`
                         )
                       }
                     >
                       <FontAwesome name="spotify" size={24} color="white" />
                       <Text style={styles.spotifyButtonText}>Open in Spotify</Text>
                     </TouchableOpacity>
                   </View>
                 </TouchableWithoutFeedback>
               </View>
             </TouchableWithoutFeedback>
           </Modal>
         );
       };
 
     const handlePress = () => {
        setReviewsModalVisible(false);
       const details = albumDetails[review.spotifyId];
       const album = {
         id: review.spotifyId,
         name: details?.albumName || review.albumName || "Unknown Album",
         images: [{ url: albumImages[review.spotifyId] || "" }],
         release_date:
           review.releaseDate || `${details?.releaseYear || 2023}-01-01`,
         artists: [
           {
             name: details?.artistName || review.artistName || "Unknown Artist",
           },
         ],
       };
 
       router.push({
         pathname: "/Screens/ReviewDetail/",
         params: {
           review: JSON.stringify({
             ...review,
             createdAt: review.createdAt, // Ensure date is included
             rating: review.rating, // Ensure rating is included
             comment: review.comment, // Ensure comment is included
             userId: review.userId, // Ensure user ID is included
           }),
           album: JSON.stringify(album),
           userProfile: JSON.stringify(
             userProfiles[review.userId] || {
               username: "Unknown User",
               profileImage: null,
             }
           ),
           likeCount: likeCounts[review.id] || 0,
           isLiked: !!likedReviews[review.id],
           currentUserId: userId,
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
              <Image
                source={{
                  uri: getProfileImageUrl(
                    userProfiles[review.userId]?.profileImage
                  ),
                }}
                style={styles.profilePhoto}
              />
              <View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.ReviewBy}>Review by </Text>
                  <Text style={styles.userName}>
                    {userProfiles[review.userId]?.username ||
                      `User ${review.userId}`}
                  </Text>
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
                  <TouchableOpacity
                    onPress={() => {
                      console.log("3 noktaya tıklandı 🚀"); // EKLENDİ
                      setMenuVisible(true);
                    }}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={24}
                      color="white"
                      style={{ marginTop: -20 }}
                    />
                  </TouchableOpacity>

                }
              >
                <Portal>
                <Menu.Item
                  onPress={() => {
                    setSelectedReviewId(review.id);
                    setModalVisible(true);
                    setMenuVisible(false);
                  }}
                  title="Delete"
                  leadingIcon="delete"
                />
                <Menu.Item
                  onPress={() => {
                    setMenuVisible(false);
                    const details = albumDetails[review.spotifyId];
                    const album = {
                      id: review.spotifyId,
                      name: details?.albumName || "Unknown Album",
                      images: [{ url: albumImages[review.spotifyId] || "" }],
                      release_date:
                        review.releaseDate ||
                        `${details?.releaseYear || 2023}-01-01`,
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
                </Portal>
              </Menu>
            )}
          </View>

          <View style={styles.divider} />

          {/* Album + Review section */}
          <View style={styles.reviewMainContent}>
            <Image source={{ uri: albumImage }} style={styles.albumCover} />
            <View style={styles.reviewTextContainer}>
              <ScrollView
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.reviewText}>{review.comment}</Text>
              </ScrollView>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Footer with rating and like button */}
      <View style={styles.reviewFooter}>
        <View style={styles.rating}>
          {[...Array(5)].map((_, i) => (
            <Ionicons
              key={i}
              name={i < review.rating ? "star" : "star-outline"}
              size={16}
              color="#FFD700"
            />
          ))}
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

  if (profileLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={{ color: "white", marginTop: 10 }}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefreshProfile}
            colors={["#1DB954"]}
            tintColor="#1DB954"
          />
        }
        ListHeaderComponent={
          <>
            {currentUserId !== loggedInUserId && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.push("/Screens/Profile/Profile")}
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => router.push("Screens/AuthenticationSettings")}
            >
              <Ionicons name="settings-outline" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.profileInfoContainer}>
              <View style={styles.profileImageContainer}>
                {profile.profileImage &&
                profile.profileImage !== "default.png" &&
                profile.profileImage !== null ? (
                  <Image
                    source={{
                      uri:
                        profile.profileImage &&
                        profile.profileImage !== "default.png"
                          ? `${BACKEND_PROFILE_PICTURE_DOWNLOADER_URL}/s3/download/${profile.profileImage}`
                          : Image.resolveAssetSource(defaultProfileImage).uri,
                    }}
                    style={styles.profileImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={defaultProfileImage}
                    style={styles.profileImage}
                    resizeMode="cover"
                  />
                )}
              </View>
              <View style={styles.statsContainer}>
                <TouchableOpacity
                  style={styles.statItem}
                  onPress={() => setReviewsModalVisible(true)}
                >
                  <Text style={styles.statNumber}>{reviewCount}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statItem}
                  onPress={() => {
                    fetchFollowing();
                    setFollowingModalVisible(true);
                  }}
                >
                  <Text style={styles.statNumber}>{followingCount}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statItem}
                  onPress={() => {
                    fetchFollowers();
                    setFollowersModalVisible(true);
                  }}
                >
                  <Text style={styles.statNumber}>{followerCount}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.userInfoContainer}>
              <View style={styles.usernameContainer}>
                <Text style={styles.username}>{profile.username}</Text>
                {currentUserId !== loggedInUserId && (
                  <TouchableOpacity
                    style={[styles.followButton, { marginLeft: 15 }]}
                    onPress={() => handleFollow()}
                  >
                    <Text style={styles.followButtonText}>
                      {isFollowing ? "Unfollow" : "Follow"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.bio}>{profile.bio}</Text>
              <Text style={styles.location}>
                <Ionicons name="location-outline" size={16} color="gray" />{" "}
                {profile.location}
              </Text>
              <Text style={styles.link}>
                <Ionicons name="link-outline" size={16} color="gray" />{" "}
                {profile.link ? (
                  profile.link.startsWith("https://open.spotify.com/user/") ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(profile.link)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: "white",
                          marginLeft: 6,
                          textDecorationLine: "underline",
                        }}
                      >
                        Spotify{" "}
                      </Text>
                      <FontAwesome name="spotify" size={20} color="#1DB954" />
                    </TouchableOpacity>
                  ) : (
                    <View style={{ marginTop: 5 }}>
                      <Text style={{ color: "#ccc" }}>{profile.link}</Text>
                    </View>
                  )
                ) : null}
              </Text>
            </View>

            <View style={styles.separator} />
            <Text style={styles.favoriteTitle}>FAVORITE ALBUMS</Text>
            <View style={styles.gridContainer}>
              {[
                ...profile.favoriteAlbums,
                ...Array(4 - profile.favoriteAlbums.length).fill(null),
              ].map((album, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleAlbumOrArtistPress(index, "albums")}
                  onLongPress={() => album && handleLongPressFavorite(album)}
                  delayLongPress={500}
                  style={styles.albumContainer}
                >
                  {album ? (
                    <>
                      <Image
                        source={{ uri: album.image }}
                        style={styles.album}
                        resizeMode="cover"
                      />
                      <Text
                        style={{
                          color: "white",
                          fontSize: 12,
                          textAlign: "center",
                        }}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {album.name}
                      </Text>
                    </>
                  ) : (
                    <View style={styles.emptyAlbum}>
                      <Ionicons name="add" size={40} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.separator} />
            <Text style={styles.favoriteTitle}>FAVORITE ARTISTS</Text>
            <View style={styles.gridContainer}>
              {[
                ...profile.favoriteArtists,
                ...Array(4 - profile.favoriteArtists.length).fill(null),
              ].map((artist, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleAlbumOrArtistPress(index, "artists")}
                  onLongPress={() => artist && handleLongPressFavorite(artist)}
                  delayLongPress={500}
                  style={styles.artistContainer}
                >
                  {artist ? (
                    <>
                      <Image
                        source={{ uri: artist.image }}
                        style={styles.artist}
                        resizeMode="cover"
                      />
                      <Text
                        style={{
                          color: "white",
                          fontSize: 12,
                          textAlign: "center",
                        }}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {artist.name}
                      </Text>
                    </>
                  ) : (
                    <View style={styles.emptyArtist}>
                      <Ionicons name="add" size={40} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
      />

      {/* Followers Modal */}
      <Modal
        visible={followersModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFollowersModalVisible(false)}
      >
        <View style={styles.modalBackgroundFollow}>
          <View style={styles.modalContainerFollow}>
            <TouchableOpacity
              onPress={() => setFollowersModalVisible(false)}
              style={styles.closeButtonFollow}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalTitleFollow}>Followers</Text>

            {isLoadingFollowers && followers.length === 0 ? (
              <ActivityIndicator size="large" color="#1DB954" />
            ) : (
              <FlatList
                data={followers}
                keyExtractor={(item) => item.userId.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      navigation.navigate("Screens/Profile/Profile/index", {
                        userId: item.userId,
                      });
                      setFollowersModalVisible(false);
                    }}
                    style={styles.userItemFollow}
                  >
                    <Image
                      source={
                        item.profileImage && item.profileImage !== "default.png"
                          ? {
                              uri: `${BACKEND_PROFILE_PICTURE_DOWNLOADER_URL}/s3/download/${item.profileImage}`,
                            }
                          : defaultProfileImage
                      }
                      style={styles.userImageFollow}
                    />
                    <Text style={styles.usernameFollow}>{item.username}</Text>
                  </TouchableOpacity>
                )}
                ListFooterComponent={
                  nextFollowersCursor && (
                    <TouchableOpacity
                      onPress={() => fetchFollowers(nextFollowersCursor)}
                      style={styles.loadMoreButton}
                      disabled={isLoadingFollowers}
                    >
                      {isLoadingFollowers ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.loadMoreText}>Load More</Text>
                      )}
                    </TouchableOpacity>
                  )
                }
                ListEmptyComponent={
                  <Text style={styles.noResultsText}>No followers found</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Following Modal */}
      <Modal
        visible={followingModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFollowingModalVisible(false)}
      >
        <View style={styles.modalBackgroundFollow}>
          <View style={styles.modalContainerFollow}>
            <TouchableOpacity
              onPress={() => setFollowingModalVisible(false)}
              style={styles.closeButtonFollow}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalTitleFollow}>Following</Text>

            {isLoadingFollowing && following.length === 0 ? (
              <ActivityIndicator size="large" color="#1DB954" />
            ) : (
              <FlatList
                data={following}
                keyExtractor={(item) => item.userId.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      navigation.navigate("Screens/Profile/Profile/index", {
                        userId: item.userId,
                      });
                      setFollowingModalVisible(false);
                    }}
                    style={styles.userItemFollow}
                  >
                    <Image
                      source={
                        item.profileImage && item.profileImage !== "default.png"
                          ? {
                              uri: `${BACKEND_PROFILE_PICTURE_DOWNLOADER_URL}/s3/download/${item.profileImage}`,
                            }
                          : defaultProfileImage
                      }
                      style={styles.userImageFollow}
                    />
                    <Text style={styles.usernameFollow}>{item.username}</Text>
                  </TouchableOpacity>
                )}
                ListFooterComponent={
                  nextFollowingCursor && (
                    <TouchableOpacity
                      onPress={() => fetchFollowing(nextFollowingCursor)}
                      style={styles.loadMoreButton}
                      disabled={isLoadingFollowing}
                    >
                      {isLoadingFollowing ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.loadMoreText}>Load More</Text>
                      )}
                    </TouchableOpacity>
                  )
                }
                ListEmptyComponent={
                  <Text style={styles.noResultsText}>Not following anyone</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Reviews Modal */}
      <Modal
        visible={reviewsModalVisible}
        animationType="slide"
        transparent={true}
      >
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(!modalVisible);
          }}
        >
        </Modal>
        <View style={styles.modalBackground}>
          <View style={styles.reviewModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setReviewsModalVisible(false)}>
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Reviews</Text>
            </View>

            {reviewsRefreshing ? (
              <ActivityIndicator size="large" color="white" />
            ) : reviews.length > 0 ? (
              <FlatList
                data={reviews}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <ReviewCard
                  review={item}
                  albumImage={albumImages[item.spotifyId]}
                  likedReviews={likedReviews}
                  toggleLike={toggleLike}
                  setModalVisible={setModalVisible}
                  setSelectedReviewId={setSelectedReviewId}
                  userId={currentUserId}
                  isOwner={Number(loggedInUserId) === Number(currentUserId)}
                  />
                )}
                refreshControl={
                  <RefreshControl refreshing={reviewsRefreshing} onRefresh={onRefreshReviews} />
                }
              />
            ) : (
              <Text
                style={{ color: "gray", textAlign: "center", marginTop: 10 }}
              >
                There are no reviews yet.
              </Text>
            )}
          </View>
        </View>
      </Modal>
      <Modal
              animationType="slide"
              transparent={true}
              visible={modalVisible}
              onRequestClose={() => {
                setModalVisible(!modalVisible);
              }}
            >
              <View style={styles.centeredView}>
                <View style={styles.modalView}>
                  <Text style={styles.modalText}>
                    Are you sure you want to delete your review?
                  </Text>
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonYes]}
                      onPress={() => handleDeleteReview(selectedReviewId)}
                    >
                      <Text style={styles.textStyle}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonNo]}
                      onPress={() => setModalVisible(!modalVisible)}
                    >
                      <Text style={styles.textStyle}>No</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

      {/* Search Modal */}
      <Modal
        visible={searchModalVisible}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.modalBackground}>
          <View style={styles.searchModal}>
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>
                Search {selectedCategory === "albums" ? "Albums" : "Artists"}
              </Text>
              <TouchableOpacity
                onPress={() => setSearchModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search-outline"
                size={20}
                color="gray"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor="gray"
                onChangeText={handleSearch}
                value={searchText}
                autoFocus={true}
              />
            </View>

            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelectItem(item)}
                  style={styles.resultItem}
                >
                  <Image
                    source={{
                      uri:
                        item.images?.[0]?.url ||
                        "https://via.placeholder.com/50",
                    }}
                    style={styles.resultImage}
                  />
                  <Text style={styles.resultText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              onScroll={() => Keyboard.dismiss()}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.noResultsText}>No results found.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Image Modal */}
      <ImageModal />
    </>
  );
}

// Stil Tanımları
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
  },
  headerText: { fontSize: 24, color: "white" },
  profileInfoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 0,
    marginTop: 50,
  },
  profileImage: {
    left: 20,
    width: 90,
    height: 90,
    borderRadius: 50,
    marginRight: 10,
    borderWidth: 1, // Border ekliyoruz
    borderColor: "#1DB954", // Spotify yeşiline uyumlu bir renk
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "50%",
    marginLeft: 50,
  },

  statItem: {
    bottom: 10,
    alignItems: "center",
    right: 50,
  },

  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },

  statLabel: {
    fontSize: 12,
    color: "gray",
  },

  bioContainer: { marginLeft: 25 },

  username: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },

  bio: { fontSize: 14, color: "white", marginVertical: 5 },
  userInfoContainer: {
    alignItems: "row",
    marginBottom: 12,
    paddingHorizontal: 25,
  },
  locationLinkContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
  },
  location: { fontSize: 14, color: "white", marginRight: 15, marginTop: 5 },
  link: { fontSize: 14, color: "#1DB954", marginTop: 10 },

  separator: { height: 2, backgroundColor: "#333333", marginVertical: 15 },

  favoriteTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    paddingLeft: 15,
  },
  gridContainer: {
    flexDirection: "row",
    justifyContent: "space-around", // Her iki tarafta da eşit boşluk bırakır.
    flexWrap: "wrap",
    marginVertical: 5,
    paddingHorizontal: 10,
  },
  albumContainer: {
    width: 90,
    marginBottom: 10,
  },
  artistContainer: {
    width: 90,
    marginBottom: 10,
  },
  album: {
    width: 90,
    height: 90,
    borderRadius: 5,
    margin: 5,
  },
  artist: {
    width: 90,
    height: 90,
    borderRadius: 40,
    margin: 5,
  },

  emptyAlbum: {
    width: 80,
    height: 80,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 5,
    margin: 5,
  },
  emptyArtist: {
    width: 80,
    height: 80,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 40,
    margin: 5,
  },

  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)", // Daha koyu bir arka plan
  },
  searchModal: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#1E1E1E", // Modal arka plan rengi
    borderRadius: 15,
    padding: 15,
  },
  searchModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  closeButton: {
    padding: 5,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "white",
    fontSize: 16,
    paddingVertical: 10,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  resultImage: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginRight: 10,
  },
  resultText: {
    fontSize: 16,
    color: "white",
  },
  noResultsText: {
    color: "gray",
    textAlign: "center",
    marginTop: 20,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)", // Arka planı koyu ve yarı saydam yap
    justifyContent: "center",
    alignItems: "center",
  },
  reviewModal: {
    width: "90%", // Modal genişliği
    maxHeight: "80%", // Modal yüksekliği
    backgroundColor: "#1E1E1E", // Modal arka plan rengi
    borderRadius: 10,
    padding: 15,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginLeft: 10,
  },
  reviewContainer: {
    flexDirection: "row",
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  albumCover: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholder: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 8,
  },
  reviewContent: {
    flex: 1,
    marginLeft: 10,
  },
  usernameReview: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  reviewDate: {
    fontSize: 12,
    color: "gray",
    marginBottom: 5,
    marginTop: 5,
  },
  reviewText: {
    fontSize: 14,
    color: "lightgray",
    marginBottom: 3,
  },
  ratingContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  rating: {
    flexDirection: "row",
  },
  likeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
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
    borderTopRightRadius: 10, // Rounded on the right
    borderBottomRightRadius: 10, // Rounded on the right
    borderTopLeftRadius: 0, // No border radius on the left
    borderBottomLeftRadius: 0, // No border radius on the left
    marginRight: 10,
  },
  deleteText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalBackgroundFollow: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContainerFollow: {
    width: "80%", // Daha geni┼ş
    maxHeight: "60%", // Ekran─▒n %70'ini kaplas─▒n
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 15,
  },
  modalTitleFollow: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    marginBottom: 15,
    alignSelf: "center",
  },
  closeButtonFollow: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  userImageFollow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  usernameFollow: {
    fontSize: 16,
    color: "white",
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
  spotifyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1DB954", // Spotify yeşili
    padding: 10,
    borderRadius: 5,
    marginTop: 20,
  },
  spotifyButtonText: {
    color: "white",
    fontSize: 16,
    marginLeft: 10,
  },
  settingsButton: {
    position: "absolute",
    top: 0, // Sağ üst köşeye yerleştirildi
    right: 0,
    padding: 15,
    zIndex: 10,
  },
  profileImageContainer: {
    alignItems: "center", // Profil resmi ve nick'i ortalar
    flexDirection: "column",
    marginBottom: 20,
  },
  followButton: {
    backgroundColor: "#1DB954", // Spotify yeşili
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginLeft: 10,
    alignSelf: "center", // Butonun kendini ortalaması
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },

  followButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  usernameContainer: {
    flexDirection: "row",
    alignItems: "center", // Nick ve butonu aynı hizada tutar
    justifyContent: "flex-start", // İkisini yatayda ayırır
    width: "100%",
  },
  loadMoreButton: {
    padding: 10,
    backgroundColor: "#1DB954",
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  loadMoreText: {
    color: "white",
    fontWeight: "bold",
  },
  noResultsText: {
    color: "gray",
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  optionText: {
    color: "white",
    marginLeft: 10,
    fontSize: 16,
  },
  backButton: {
    position: "absolute",
    top: 4,
    left: 15,
    padding: 10,
    zIndex: 10,
  },
  userItemFollow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    padding: 10,
    marginBottom: 5,
    backgroundColor: "#2a2a2a", // Hafif koyu arkaplan
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  userImageFollow: {
    width: 30,
    height: 30,
    borderRadius: 25, // Tam yuvarlak
    marginRight: 15,
  },
  usernameFollow: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black", // Arka plan uyumlu kalsın
  },
  cardContainer: {
    flexDirection: "column",
    backgroundColor: "#1E1E1E",
    margin: 10,
    borderRadius: 10,
    padding: 10,
    overflow: "visible",
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
