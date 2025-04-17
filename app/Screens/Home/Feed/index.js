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
  ScrollView,
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
} from "../../../constants/apiConstants";
import { AuthContext } from "../../../context/AuthContext";
import { getUserProfile } from "../../../api/backend";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { Linking } from "react-native";
import { TouchableWithoutFeedback, Keyboard } from "react-native";
import { Menu } from "react-native-paper";
import { useRouter } from "expo-router";

const SPOTIFY_API_URL = "https://api.spotify.com/v1/albums";
const BATCH_SIZE = 5; // Number of reviews to fetch per batch

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
  const [followedReviews, setFollowedReviews] = useState([]);
  const [yourReviews, setYourReviews] = useState([]);
  const [fetchedReviewIds, setFetchedReviewIds] = useState(new Set());
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedAlbumInfo, setSelectedAlbumInfo] = useState(null);
  const [albumDetails, setAlbumDetails] = useState({});
  const router = useRouter();

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

  const fetchInitialData = async () => {
    setLoading(true);
    setFetchedReviewIds(new Set());
    setPopularReviews([]);
    setUserProfiles({});
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
      console.log("Popüler Review ID'leri:", reviewIds);
      setPopularReviewIds(reviewIds);
      await fetchReviewsBatch(reviewIds, 0);
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Error fetching popular review IDs:", error);
      }
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

    const likeCounts = await fetchLikeCounts(validReviews);
    setLikedReviews((prevLikes) => ({ ...prevLikes, ...likeCounts }));

    setCurrentBatchIndex(endIndex);
  };

  const fetchFollowedReviews = async () => {
    try {
      const followedUsersUrl = `${BACKEND_USER_FOLLOW_URL}/user-follow/${userId}/followed`;
      const followedUsersResponse = await fetch(followedUsersUrl);
      const followedUserIds = await followedUsersResponse.json();

      if (IS_DEVELOPMENT) {
        console.log("Followed User IDs:", followedUserIds);
      }
      if (!followedUserIds || followedUserIds.length === 0) {
        setFollowedReviews([]);
        return;
      }

      const reviewsPromises = followedUserIds.map(async (userId) => {
        const userReviewsUrl = `${BACKEND_REVIEW_URL}/review/get-reviews/user/${userId}`;
        const response = await fetch(userReviewsUrl);
        const data = await response.json();
        return data.content || [];
      });

      const reviewsResults = await Promise.all(reviewsPromises);
      const allReviews = reviewsResults.flat();

      if (IS_DEVELOPMENT) {
        console.log("All reviews from followed users:", allReviews);
      }

      setFollowedReviews(allReviews);

      // Fetch user profiles for followed users' reviews
      allReviews.forEach((review) => {
        fetchUserProfile(review.userId);
      });

      const likeCounts = await fetchLikeCounts(allReviews);
      setLikedReviews((prevLikes) => ({ ...prevLikes, ...likeCounts }));

      const images = await fetchAlbumImages(allReviews);
      setAlbumImages((prevImages) => ({ ...prevImages, ...images }));
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Error fetching followed users' reviews:", error);
      }
    }
  };

  const fetchYourReviews = async () => {
    try {
      const url = `${BACKEND_REVIEW_URL}/review/get-reviews/user/${userId}`;
      const response = await fetch(url);
      const data = await response.json();
      setYourReviews(data.content || []);

      // Fetch your own profile
      fetchUserProfile(userId);

      const likeCounts = await fetchLikeCounts(data.content || []);
      setLikedReviews((prevLikes) => ({ ...prevLikes, ...likeCounts }));

      const images = await fetchAlbumImages(data.content || []);
      setAlbumImages((prevImages) => ({ ...prevImages, ...images }));
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Error fetching your reviews:", error);
      }
    }
  };

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
          if (IS_DEVELOPMENT) {
            console.error(
              `Error fetching like count for review ${review.id}:`,
              error
            );
          }
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
          if (IS_DEVELOPMENT) {
            console.error(
              `Error fetching album image for ${review.spotifyId}:`,
              error
            );
          }
          images[review.spotifyId] = null;
        }
      })
    );
    return images;
  };

  const toggleLike = async (reviewId) => {
    const isLiked = likedReviews[reviewId] > 0;
    const url = isLiked
      ? `${BACKEND_REVIEW_LIKE_URL}/review-like/unlike/${userId}/${reviewId}`
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
          [reviewId]: isLiked
            ? (prev[reviewId] || 1) - 1
            : (prev[reviewId] || 0) + 1,
        }));
      }
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Error toggling like:", error);
      }
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
      if (IS_DEVELOPMENT) {
        console.error("Error deleting review:", error);
        Alert.alert("Error", "An error occurred while deleting the review");
      }
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
    useEffect(() => {
      if (!userProfiles[review.userId]) {
        fetchUserProfile(review.userId);
      }
    }, [review.userId]);

    return (
      <View
        style={{
          flexDirection: "column",
          backgroundColor: "#1E1E1E",
          margin: 10,
          marginRight: 10,
          borderRadius: 10,
          padding: 10,
        }}
      >
        {/* PROFİL FOTOĞRAF + KULLANICI ADI */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() =>
                router.push("/Screens/Profile/Profile", {
                  userId: review.userId,
                })
              }
            >
              <Image
                source={
                  userProfiles[review.userId]?.profileImage
                    ? { uri: userProfiles[review.userId].profileImage }
                    : defaultProfileImage
                }
                style={styles.profilePhoto}
              />
            </TouchableOpacity>
            <View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.ReviewBy}>Review by </Text>

                <TouchableOpacity
                  onPress={() =>
                    router.push("/Screens/Profile/Profile", {
                      userId: review.userId,
                    })
                  }
                >
                  <Text style={styles.userName}>
                    {userProfiles[review.userId]?.username}
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
            </Menu>
          )}
        </View>

        <View
          style={{
            borderBottomColor: "#333",
            borderBottomWidth: 1,
            marginVertical: 6,
            marginBottom: 10,
          }}
        />

        {/* ALBÜM + YORUM */}
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <TouchableOpacity
            onPress={() => {
              console.log("🟢 Albüm cover tıklandı!");
              setSelectedAlbumInfo({
                image: albumImage,
                albumName: review.albumName,
                artistName: review.artistName,
                year: new Date(review.releaseDate).getFullYear(),
                spotifyId: review.spotifyId,
              });
              setImageModalVisible(true);
            }}
          >
            {albumImage ? (
              <Image source={{ uri: albumImage }} style={styles.albumCover} />
            ) : (
              <View style={[styles.albumCover, styles.placeholder]}>
                <Ionicons name="image-outline" size={40} color="gray" />
              </View>
            )}
          </TouchableOpacity>

          <View style={[styles.reviewContent, { paddingTop: 0 }]}>
            <View style={styles.commentScrollWrapper}>
              <ScrollView
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.reviewText}>{review.comment}</Text>
              </ScrollView>
            </View>
          </View>
        </View>

        {/* EN ALTA SABİTLENEN KISIM */}
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
        ListEmptyComponent={() => {
          if (selectedTab === "Popular") {
            return (
              <EmptyState message="Looks like there are no popular reviews yet." />
              // TODO: Kullanıcıyı bilgilendiren bir yazı (popüler reviewlar ... dan sonra buraya düşer gibi)
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
          } else if (selectedTab === "Yours") {
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
      <AlbumImageModal />
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
    maxHeight: 100, // ya da 80, 100 vs. - dene görsel olarak
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
    justifyContent: "center", // YATAY ORTALA
    backgroundColor: "#1DB954",
    padding: 10,
    borderRadius: 5,
    marginTop: 20,
    width: 200, // sabit genişlik vererek ortalanmayı netleştir
  },
  spotifyButtonText: {
    color: "white",
    fontSize: 16,
    marginLeft: 10,
  },
  imageModalContent: {
    alignItems: "center", // Butonu ve textleri ortalar
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
});
