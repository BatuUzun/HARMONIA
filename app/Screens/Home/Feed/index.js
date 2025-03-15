import React, { useEffect, useState, useCallback, useContext } from "react";
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
} from "react-native";
import {
  Swipeable,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
  BACKEND_REVIEW_URL,
  BACKEND_REVIEW_LIKE_URL,
  BACKEND_USER_FOLLOW_URL,
} from "../../../constants/apiConstants";
import { AuthContext } from "../../../context/AuthContext";

const SPOTIFY_API_URL = "https://api.spotify.com/v1/albums";
const BATCH_SIZE = 5; // Number of reviews to fetch per batch

export default function HomeScreen() {
  const { userId } = useContext(AuthContext); // Get userId from AuthContext
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

  const [popularReviews, setPopularReviews] = useState([]);
  const [followedReviews, setFollowedReviews] = useState([]);
  const [yourReviews, setYourReviews] = useState([]);

  const [fetchedReviewIds, setFetchedReviewIds] = useState(new Set()); // Track fetched review IDs

  useEffect(() => {
    fetchSpotifyAccessToken();
  }, []);

  useEffect(() => {
    if (accessToken) {
      fetchInitialData();
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
        console.error("Failed to fetch Spotify access token:", data);
      }
    } catch (error) {
      console.error("Error fetching Spotify token:", error);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    setFetchedReviewIds(new Set()); // Reset fetched review IDs
    setPopularReviews([]); // Clear popular reviews
    await fetchPopularReviewIds();
    await fetchFollowedReviews();
    await fetchYourReviews();
    setLoading(false);
  };

  const fetchPopularReviewIds = async () => {
    try {
      const url = `${BACKEND_REVIEW_URL}/review/popular`;
      const response = await fetch(url);
      const reviewIds = await response.json();
      setPopularReviewIds(reviewIds);
      await fetchReviewsBatch(reviewIds, 0);
    } catch (error) {
      console.error("Error fetching popular review IDs:", error);
    }
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
            console.warn(`⚠️ Review ID ${id} not found, skipping...`);
            return null;
          }
          return await reviewResponse.json();
        } catch (error) {
          console.error(`Error fetching review ID ${id}:`, error);
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

    const images = await fetchAlbumImages(validReviews);
    setAlbumImages((prevImages) => ({ ...prevImages, ...images }));

    const likeCounts = await fetchLikeCounts(validReviews);
    setLikedReviews((prevLikes) => ({ ...prevLikes, ...likeCounts }));

    setCurrentBatchIndex(endIndex);
  };

  const fetchFollowedReviews = async () => {
    try {
      // Step 1: Fetch the users that user with ID 1 follows
      const followedUsersUrl = `${BACKEND_USER_FOLLOW_URL}/user-follow/${userId}/followed`;
      const followedUsersResponse = await fetch(followedUsersUrl);
      const followedUserIds = await followedUsersResponse.json();

      console.log("Followed User IDs:", followedUserIds);

      if (!followedUserIds || followedUserIds.length === 0) {
        setFollowedReviews([]); // No users followed, set empty list
        return;
      }

      // Step 2: Fetch reviews for each followed user
      const reviewsPromises = followedUserIds.map(async (userId) => {
        const userReviewsUrl = `${BACKEND_REVIEW_URL}/review/get-reviews/user/${userId}`;
        const response = await fetch(userReviewsUrl);
        const data = await response.json();
        return data.content || []; // Return the reviews for this user
      });

      // Wait for all requests to complete
      const reviewsResults = await Promise.all(reviewsPromises);

      // Combine all reviews into a single array
      const allReviews = reviewsResults.flat();

      console.log("All reviews from followed users:", allReviews);

      // Set the reviews in the state
      setFollowedReviews(allReviews);

      // Fetch like counts and album images for the reviews
      const likeCounts = await fetchLikeCounts(allReviews);
      setLikedReviews((prevLikes) => ({ ...prevLikes, ...likeCounts }));

      const images = await fetchAlbumImages(allReviews);
      setAlbumImages((prevImages) => ({ ...prevImages, ...images }));
    } catch (error) {
      console.error("Error fetching followed reviews:", error);
    }
  };

  const fetchYourReviews = async () => {
    try {
      const url = `${BACKEND_REVIEW_URL}/review/get-reviews/user/${userId}`;
      const response = await fetch(url);
      const data = await response.json();
      setYourReviews(data.content || []);

      const likeCounts = await fetchLikeCounts(data.content || []);
      setLikedReviews((prevLikes) => ({ ...prevLikes, ...likeCounts }));

      const images = await fetchAlbumImages(data.content || []);
      setAlbumImages((prevImages) => ({ ...prevImages, ...images }));
    } catch (error) {
      console.error("Error fetching your reviews:", error);
    }
  };

  const fetchLikeCounts = async (reviewsData) => {
    let likeCounts = {};
    await Promise.all(
      reviewsData.map(async (review) => {
        try {
          const url = `${BACKEND_REVIEW_LIKE_URL}/review-like/${review.id}/count`;
          const response = await fetch(url);
          const data = await response.json();
          likeCounts[review.id] =
            data.success && typeof data.data === "number" ? data.data : 0;
        } catch (error) {
          console.error(
            `Error fetching like count for review ${review.id}:`,
            error
          );
          likeCounts[review.id] = 0;
        }
      })
    );
    return likeCounts;
  };

  const fetchAlbumImages = async (reviewsData) => {
    let images = {};
    await Promise.all(
      reviewsData.map(async (review) => {
        try {
          const response = await fetch(
            `${SPOTIFY_API_URL}/${review.spotifyId}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          const data = await response.json();
          images[review.spotifyId] = data.images?.[0]?.url || null;
        } catch (error) {
          console.error(
            `Error fetching album image for ${review.spotifyId}:`,
            error
          );
          images[review.spotifyId] = null;
        }
      })
    );
    return images;
  };

  const toggleLike = async (reviewId) => {
    const isLiked = likedReviews[reviewId] > 0;
    const url = isLiked
      ? `${BACKEND_REVIEW_LIKE_URL}/review-like/unlike/${reviewId}`
      : `${BACKEND_REVIEW_LIKE_URL}/review-like/like`;

    try {
      const response = await fetch(url, {
        method: isLiked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: isLiked ? null : JSON.stringify({ userId: userId, reviewId }),
      });

      if (response.ok) {
        setLikedReviews((prev) => ({
          ...prev,
          [reviewId]: isLiked ? prev[reviewId] - 1 : prev[reviewId] + 1,
        }));
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
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
        setYourReviews((prevReviews) =>
          prevReviews.filter((review) => review.id !== reviewId)
        );
        setModalVisible(false);
      } else {
        Alert.alert("Error", "Failed to delete review");
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      Alert.alert("Error", "An error occurred while deleting the review");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInitialData();
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (
      selectedTab === "Popular" &&
      currentBatchIndex < popularReviewIds.length
    ) {
      await fetchReviewsBatch(popularReviewIds, currentBatchIndex);
    }
  };

  const getReviewsForTab = () => {
    switch (selectedTab) {
      case "Popular":
        return popularReviews;
      case "Following":
        return followedReviews;
      case "Yours":
        return yourReviews;
      default:
        return [];
    }
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
        {["Popular", "Following", "Yours"].map((tab) => (
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
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
      />
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
    </View>
  );
}

const ReviewCard = ({
  review,
  albumImage,
  likedReviews,
  toggleLike,
  setModalVisible,
  setSelectedReviewId,
  userId,
}) => {
  const [isSwiped, setIsSwiped] = useState(false);

  const renderRightActions = () => (
    <View style={styles.deleteSwipeContainer}>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          setSelectedReviewId(review.id);
          setModalVisible(true);
        }}
      >
        <Ionicons name="trash-outline" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );

  return (
    <GestureHandlerRootView>
      <Swipeable
        renderRightActions={
          review.userId === userId ? renderRightActions : null
        }
        overshootRight={false}
        onSwipeableWillOpen={() => setIsSwiped(true)}
        onSwipeableWillClose={() => setIsSwiped(false)}
      >
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#1E1E1E",
            margin: 10,
            marginRight: isSwiped ? 0 : 10,
            borderRadius: 10,
            padding: 10,
            alignItems: "center",
          }}
        >
          {albumImage ? (
            <Image source={{ uri: albumImage }} style={styles.albumCover} />
          ) : (
            <View style={[styles.albumCover, styles.placeholder]}>
              <Ionicons name="image-outline" size={40} color="gray" />
            </View>
          )}

          <View style={styles.reviewContent}>
            <Text style={styles.userName}>
              {review.username || `User ${review.userId}`}
            </Text>
            <Text style={styles.reviewDate}>
              {new Date(review.createdAt).toDateString()}
            </Text>
            <Text style={styles.reviewText}>{review.comment}</Text>
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
              <TouchableOpacity onPress={() => toggleLike(review.id)}>
                <View style={styles.likeContainer}>
                  <Ionicons
                    name={likedReviews[review.id] ? "heart" : "heart-outline"}
                    size={20}
                    color={likedReviews[review.id] ? "red" : "white"}
                  />
                  <Text style={styles.likeText}>
                    {likedReviews[review.id] || 0} Likes
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Swipeable>
    </GestureHandlerRootView>
  );
};

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
    width: 80,
    height: 80,
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
  },
  reviewDate: {
    fontSize: 12,
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
});
