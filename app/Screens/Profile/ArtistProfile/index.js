import React, {
  useEffect,
  useState,
  useCallback,
  useContext,
  useRef,
} from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  FlatList,
  RefreshControl,
  Animated,
  Easing,
  ActivityIndicator,
  Modal,
  Dimensions,
  Linking,
} from "react-native";
import { Menu } from "react-native-paper";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import { getArtistAlbums, getAlbumTracks } from "../../../api/spotify";
import {
  getReviewsByAlbumIds,
  getUserProfile,
  getAverageRating,
} from "../../../api/backend";
import { AuthContext } from "../../../context/AuthContext";
import {
  BACKEND_REVIEW_LIKE_URL,
  BACKEND_REVIEW_URL,
  BACKEND_PROFILE_PICTURE_DOWNLOADER_URL,
} from "../../../constants/apiConstants";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import defaultProfileImage from "../../../../assets/images/default-profile-photo.webp";

const ArtistProfile = ({ route, navigation }) => {
  const { artistId, artistName, artistImage } = route.params || {};
  const [selectedTab, setSelectedTab] = useState("Artist Profile");
  const [albums, setAlbums] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likedReviews, setLikedReviews] = useState({});
  const [userProfiles, setUserProfiles] = useState({});
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [tracksByAlbum, setTracksByAlbum] = useState({});
  const [averageRatings, setAverageRatings] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const { userId } = useContext(AuthContext);
  const router = useRouter();
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [menuVisibleReviewId, setMenuVisibleReviewId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const screenHeight = Dimensions.get("window").height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  // Fetch albums when artistId changes
  useEffect(() => {
    if (!artistId) {
      console.error("Artist ID is undefined");
      return;
    }
    fetchAlbums();
  }, [artistId]);

  const fetchAlbums = async () => {
    try {
      setAlbumsLoading(true);
      const albumsData = await getArtistAlbums(artistId);

      const ratingsData = {};
      for (const album of albumsData) {
        if (!album.id) {
          console.error("Album ID is undefined:", album);
          continue;
        }
        const averageRating = await getAverageRating(album.id);
        ratingsData[album.id] =
          averageRating !== undefined &&
          typeof averageRating === "number" &&
          !isNaN(averageRating)
            ? averageRating
            : 0;
      }

      const sortedAlbums = [...albumsData].sort((a, b) => {
        const ratingA = ratingsData[a.id] || 0;
        const ratingB = ratingsData[b.id] || 0;
        return ratingB - ratingA;
      });

      setAlbums(sortedAlbums);
      setAverageRatings(ratingsData);
    } catch (error) {
      console.error("Error fetching albums:", error);
    } finally {
      setAlbumsLoading(false);
    }
  };

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const albumIds = albums.map((album) => album.id);
      const reviewsData = await getReviewsByAlbumIds(albumIds);
      setReviews(reviewsData);
      await fetchLikeCounts(reviewsData);
      await fetchLikedReviews(reviewsData);
      fetchUserProfiles(reviewsData);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [albums]);

  const fetchUserProfiles = async (reviews) => {
    try {
      const userProfilesData = {};
      await Promise.all(
        reviews.map(async (review) => {
          const userProfile = await getUserProfile(review.userId);
          userProfilesData[review.userId] = {
            username: userProfile.username,
            profileImage: userProfile.profileImage || null,
          };
        })
      );
      setUserProfiles(userProfilesData);
    } catch (error) {
      console.error("Error fetching user profiles:", error);
    }
  };

  useEffect(() => {
    if (selectedTab === "Reviews" || selectedTab === "Artist Profile") {
      fetchReviews();
    }
  }, [selectedTab, fetchReviews]);

  const fetchLikedReviews = async (reviewsData) => {
    let likedReviewsData = {};
    await Promise.all(
      reviewsData.map(async (review) => {
        try {
          const url = `${BACKEND_REVIEW_LIKE_URL}/review-like/${review.id}/is-liked/${userId}`;
          const response = await fetch(url);
          if (!response.ok) {
            likedReviewsData[review.id] = null;
            return;
          }
          const text = await response.text();
          if (!text) {
            likedReviewsData[review.id] = null;
            return;
          }
          const data = JSON.parse(text);
          likedReviewsData[review.id] = data.id ? data.id : null;
        } catch (error) {
          likedReviewsData[review.id] = null;
        }
      })
    );
    setLikedReviews(likedReviewsData);
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
          likeCountsData[review.id] = 0;
        }
      })
    );
    setLikeCounts(likeCountsData);
  };

  const fetchAlbumTracks = async (albumId) => {
    try {
      const tracksData = await getAlbumTracks(albumId);
      setTracksByAlbum((prev) => ({
        ...prev,
        [albumId]: tracksData,
      }));
    } catch (error) {
      console.error("Error fetching album tracks:", error);
    }
  };

  const animationRefs = useRef({});

  const handleAlbumPress = (albumId) => {
    if (selectedAlbum === albumId) {
      // Collapse the currently expanded album
      Animated.timing(animationRefs.current[albumId], {
        toValue: 0,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start(() => {
        setSelectedAlbum(null);
      });
    } else {
      // First collapse any currently expanded album
      if (selectedAlbum) {
        Animated.timing(animationRefs.current[selectedAlbum], {
          toValue: 0,
          duration: 300,
          easing: Easing.ease,
          useNativeDriver: false,
        }).start();
      }

      // Then expand the new album
      setSelectedAlbum(albumId);
      fetchAlbumTracks(albumId);

      // Initialize animation value if not exists
      if (!animationRefs.current[albumId]) {
        animationRefs.current[albumId] = new Animated.Value(0);
      }

      Animated.timing(animationRefs.current[albumId], {
        toValue: 1,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start();
    }
  };

  const toggleLike = async (reviewId) => {
    const likeId = likedReviews[reviewId];
    try {
      if (likeId) {
        const response = await fetch(
          `${BACKEND_REVIEW_LIKE_URL}/review-like/unlike/${likeId}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          }
        );
        if (response.ok) {
          setLikedReviews((prev) => ({ ...prev, [reviewId]: null }));
          setLikeCounts((prev) => ({
            ...prev,
            [reviewId]: Math.max((prev[reviewId] || 1) - 1, 0),
          }));
          await fetchReviews();
        }
      } else {
        const response = await fetch(
          `${BACKEND_REVIEW_LIKE_URL}/review-like/like`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, reviewId }),
          }
        );
        const data = await response.json();
        if (response.ok || data.success) {
          setLikedReviews((prev) => ({
            ...prev,
            [reviewId]: data.data || true,
          }));
          setLikeCounts((prev) => ({
            ...prev,
            [reviewId]: (prev[reviewId] || 0) + 1,
          }));
          await fetchReviews();
        }
      }
    } catch (error) {
      console.error("Like/Unlike error:", error);
    } finally {
      setRefreshing(true);
    }
  };

  const getUserRatingForAlbum = (albumId) => {
    if (!userId || !reviews || !Array.isArray(reviews)) return null;
    const userReview = reviews.find((review) => {
      const reviewAlbumId =
        review.spotifyId || review.albumId || review.album?.id;
      return (
        String(review.userId) === String(userId) &&
        String(reviewAlbumId) === String(albumId)
      );
    });
    return userReview ? userReview.rating : null;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAlbums();
      await fetchReviews();
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderStars = (rating) => (
    <View style={{ flexDirection: "row", justifyContent: "center" }}>
      {[...Array(5)].map((_, i) => {
        const diff = rating - i;
        let iconName = "star-outline";
        if (diff >= 0.75) {
          iconName = "star";
        } else if (diff >= 0.25) {
          iconName = "star-half";
        }
        return (
          <Ionicons
            key={i}
            name={iconName}
            size={12}
            color="#FFD700"
            style={{ marginHorizontal: 1 }}
          />
        );
      })}
    </View>
  );

  const openDeleteModal = (reviewId) => {
    setSelectedReviewId(reviewId);
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

  const renderAlbumRow = ({ item }) => {
    const albumTracks = tracksByAlbum[item.id] || [];
    const userRating = getUserRatingForAlbum(item.id);
    const isExpanded = selectedAlbum === item.id;
    const animation = animationRefs.current[item.id];

    // Base height of album info row (~70)
    const baseHeight = 70;
    const trackHeight = 40;
    const expandedHeight = baseHeight + albumTracks.length * trackHeight;

    return (
      <Animated.View
        style={{
          overflow: "hidden",
          marginBottom: 10,
          backgroundColor: "#1a1a1a",
          borderRadius: 8,
          height: animation
            ? animation.interpolate({
                inputRange: [0, 1],
                outputRange: [baseHeight, expandedHeight],
              })
            : baseHeight,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 10,
            paddingHorizontal: 10,
            columnGap: 20,
          }}
        >
          {/* Album Info (only this is clickable to open tracks) */}
          <TouchableOpacity
            onPress={() => handleAlbumPress(item.id)}
            style={{
              flex: 2,
              flexDirection: "row",
              alignItems: "center",
              width: "50%",
              paddingRight: 20,
              marginRight: 25,
            }}
          >
            <Image
              source={{ uri: item.images[0]?.url }}
              style={{ width: 50, height: 50, borderRadius: 5 }}
            />
            <View style={{ marginLeft: 10 }}>
              <Text
                style={{ color: "white", fontSize: 14, flexShrink: 1 }}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {item.name}
              </Text>
              <Text style={{ color: "gray", fontSize: 12 }}>
                {item.release_date?.split("-")[0]}
              </Text>
            </View>
          </TouchableOpacity>

          {/* User Rating */}
          <View style={{ flex: 1, alignItems: "center", width: "30%" }}>
            {userRating !== null ? (
              renderStars(userRating)
            ) : (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/Screens/Review/Entry/",
                    params: {
                      selectedAlbum: JSON.stringify({
                        id: item.id,
                        name: item.name,
                        images: item.images,
                        release_date: item.release_date,
                        artists: item.artists || [{ name: artistName }],
                      }),
                      isUpdateFlow: false,
                    },
                  })
                }
              >
                <Ionicons name="add-circle-outline" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>

          {/* Community Rating */}
          <View style={{ flex: 1, alignItems: "center", width: "20%" }}>
            <Text
              style={{
                color:
                  averageRatings[item.id] >= 4
                    ? "green"
                    : averageRatings[item.id] >= 2
                    ? "orange"
                    : "red",
                fontSize: 14,
              }}
            >
              {typeof averageRatings[item.id] === "number" &&
              !isNaN(averageRatings[item.id])
                ? averageRatings[item.id].toFixed(1)
                : "N/A"}
            </Text>
          </View>
        </View>

        {/* Tracklist */}
        {albumTracks.length > 0 && (
          <View style={{ paddingLeft: 70, paddingRight: 10 }}>
            {albumTracks.map((track, index) => (
              <View
                key={track.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  height: 40,
                }}
              >
                <Text style={{ color: "gray", width: 24 }}>{index + 1}.</Text>
                <Text style={{ color: "lightgray", fontSize: 12 }}>
                  {track.name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    );
  };

  const renderReviewCard = ({ item }) => {
    const isOwner = Number(item.userId) === Number(userId);
    const album = albums.find((album) => album.id === item.spotifyId);
    const username =
      userProfiles[item.userId]?.username || `User ${item.userId}`;

    return (
      <TouchableOpacity
        onPress={() => {
          router.push({
            pathname: "/Screens/ReviewDetail/",
            params: {
              id: item.id,
              username: username,
              profileImage: userProfiles[item.userId]?.profileImage || null,
              createdAt: item.createdAt,
              comment: item.comment,
              rating: item.rating,
              likeCount: likeCounts[item.id] || 0,
              spotifyId: item.spotifyId,
              isLiked: Boolean(likedReviews[item.id]),
              likeId: likedReviews[item.id] || null,
              reviewUserId: item.userId,
            },
          });
        }}
        activeOpacity={0.8}
      >
        <View style={styles.reviewCardContainer}>
          <View style={styles.reviewProfileSection}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Image
                source={{
                  uri: getProfileImageUrl(
                    userProfiles[item.userId]?.profileImage
                  ),
                }}
                style={styles.reviewProfilePhoto}
              />

              <View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.reviewBy}>Review by </Text>
                  <Text style={styles.reviewUserName}>{username}</Text>
                </View>
                <Text style={styles.reviewDate}>
                  {new Date(item.createdAt).toDateString()}
                </Text>
              </View>
            </View>

            {isOwner && (
              <Menu
                visible={menuVisibleReviewId === item.id}
                onDismiss={() => setMenuVisibleReviewId(null)}
                anchor={
                  <TouchableOpacity
                    onPress={() => setMenuVisibleReviewId(item.id)}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={20}
                      color="white"
                    />
                  </TouchableOpacity>
                }
              >
                <Menu.Item
                  onPress={() => {
                    openDeleteModal(item.id);
                    setMenuVisibleReviewId(null);
                  }}
                  title="Delete"
                  leadingIcon="delete"
                />
                <Menu.Item
                  onPress={() => {
                    setMenuVisibleReviewId(null);
                    const albumData = {
                      id: album?.id,
                      name: album?.name,
                      images: album?.images,
                      release_date: album?.release_date,
                      artists: album?.artists || [{ name: artistName }],
                    };
                    router.push({
                      pathname: "/Screens/Review/Entry/",
                      params: {
                        selectedAlbum: JSON.stringify(albumData),
                        reviewToUpdate: JSON.stringify(item),
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

          <View style={styles.reviewDivider} />

          <View style={styles.reviewMainContent}>
            <Image
              source={{
                uri: album?.images[0]?.url || "https://via.placeholder.com/150",
              }}
              style={styles.reviewAlbumCover}
            />
            <View style={styles.reviewTextContainer}>
              <Text style={styles.reviewText} numberOfLines={5}>
                {item.comment}
              </Text>
            </View>
          </View>

          <View style={styles.reviewFooter}>
            <View style={styles.reviewRating}>
              {[...Array(5)].map((_, i) => {
                const diff = item.rating - i;
                let iconName = "star-outline";
                if (diff >= 0.75) {
                  iconName = "star";
                } else if (diff >= 0.25) {
                  iconName = "star-half";
                }
                return (
                  <Ionicons key={i} name={iconName} size={16} color="#FFD700" />
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => toggleLike(item.id)}
              style={styles.reviewLikeButton}
            >
              <View style={styles.reviewLikeContainer}>
                <Ionicons
                  name={likedReviews[item.id] ? "heart" : "heart-outline"}
                  size={20}
                  color={likedReviews[item.id] ? "red" : "white"}
                />
                <Text style={styles.reviewLikeText}>
                  {likeCounts[item.id] || 0} Likes
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getProfileImageUrl = (fileName) => {
    if (!fileName || fileName === "default.png") {
      return Image.resolveAssetSource(defaultProfileImage).uri;
    }
    return `${BACKEND_PROFILE_PICTURE_DOWNLOADER_URL}/s3/download/${fileName}`;
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
        closeDeleteModal();
      } else {
        console.error("Failed to delete review");
      }
    } catch (error) {
      console.error("Error deleting review:", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Cover Image */}
      <View style={styles.coverContainer}>
        <Image source={{ uri: artistImage }} style={styles.coverImage} />
        <TouchableOpacity
          style={styles.spotifyIconWrapper}
          onPress={() => {
            const spotifyUrl = `https://open.spotify.com/artist/${artistId}`;
            Linking.openURL(spotifyUrl);
          }}
        >
          <FontAwesome name="spotify" size={28} color="#1DB954" />
        </TouchableOpacity>

        {/* Artist Name */}
        <LinearGradient
          colors={["rgba(0,0,0, 0.7)", "rgba(0,0,0,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.artistNameWrapper}
        >
          <Text style={styles.artistName}>{artistName}</Text>
        </LinearGradient>
      </View>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>

        <View style={styles.tabsContainer}>
          <View style={styles.tabsBackground}>
            {["Artist Profile", "Reviews"].map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setSelectedTab(tab)}
                style={[
                  styles.tabItem,
                  selectedTab === tab && styles.selectedTabItem,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    selectedTab === tab && styles.selectedTabText,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Tab Content */}
      <View style={styles.contentContainer}>
        {selectedTab === "Artist Profile" &&
          (albumsLoading || loading ? ( // ikisi bitmeden FlatList gösterme
            <View style={styles.loadingContainer1}>
              <ActivityIndicator size="large" color="#1DB954" />
            </View>
          ) : (
            <FlatList
              data={albums}
              keyExtractor={(item) => item.id}
              renderItem={renderAlbumRow}
              contentContainerStyle={{ paddingHorizontal: 0 }}
              stickyHeaderIndices={[0]}
              ListHeaderComponent={
                <View style={styles.albumHeader}>
                  <Text
                    style={[styles.headerText, { flex: 2, textAlign: "left" }]}
                  >
                    Album
                  </Text>
                  <Text
                    style={[styles.headerText, { flex: 1, paddingLeft: 20 }]}
                  >
                    Your Rating
                  </Text>
                  <Text
                    style={[styles.headerText, { flex: 1, paddingLeft: 15 }]}
                  >
                    Community
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          ))}

        {selectedTab === "Reviews" && (
          <FlatList
            data={reviews}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderReviewCard}
            ListEmptyComponent={
              loading ? (
                <View style={styles.loadingContainer2}>
                  <ActivityIndicator size="large" color="#1DB954" />
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text
                    style={{
                      color: "gray",
                      textAlign: "center",
                      paddingTop: 40,
                    }}
                  >
                    There are no reviews on albums of this artist yet.
                  </Text>
                </View>
              )
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>
      <Modal
        transparent={true}
        animationType="none"
        visible={modalVisible}
        onRequestClose={closeDeleteModal}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={closeDeleteModal}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <TouchableOpacity activeOpacity={1}>
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
                Are you sure you want to delete this review?
              </Text>
              <View
                style={{ flexDirection: "row", justifyContent: "space-around" }}
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  coverContainer: {
    position: "relative",
    width: "100%",
    height: 270,
  },
  coverImage: {
    width: "100%",
    height: "100%",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  topBar: {
    position: "absolute",
    top: 5,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    zIndex: 99,
  },
  backButton: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsContainer: {
    flex: 1,
    marginLeft: 10,
  },
  tabsBackground: {
    flexDirection: "row",
    backgroundColor: "rgba(128,128,128,0.5)",
    borderRadius: 10,
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
  },
  selectedTabItem: {
    backgroundColor: "white",
  },
  tabText: {
    color: "white",
    fontSize: 14,
  },
  selectedTabText: {
    color: "black",
    fontWeight: "bold",
  },
  artistNameWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  artistName: {
    color: "white",
    fontSize: 26,
    fontWeight: "bold",
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  albumHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "gray",
    backgroundColor: "black",
  },
  albumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomColor: "#333",
    borderBottomWidth: 1,
  },
  albumColumn: {
    flex: 2,
  },
  albumContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  albumImage: {
    width: 50,
    height: 50,
    borderRadius: 5,
  },
  albumInfo: {
    marginLeft: 10,
    maxWidth: 180,
  },
  albumName: {
    color: "white",
    fontSize: 14,
  },
  albumYear: {
    color: "gray",
    fontSize: 12,
  },
  ratingColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 30,
  },
  communityRatingColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  communityRating: {
    fontSize: 14,
  },
  addButton: {
    alignItems: "center",
  },
  headerText: {
    color: "lightgray",
    fontWeight: "bold",
  },
  reviewCardContainer: {
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  reviewProfileSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewProfilePhoto: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  reviewBy: {
    color: "lightgray",
    fontSize: 12,
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
  },
  reviewDate: {
    fontSize: 10,
    color: "gray",
  },
  reviewDivider: {
    borderBottomColor: "#333",
    borderBottomWidth: 1,
    marginVertical: 10,
  },
  reviewMainContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  reviewAlbumCover: {
    width: 80,
    height: 80,
    borderRadius: 5,
  },
  reviewTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  reviewText: {
    color: "lightgray",
    fontSize: 14,
    lineHeight: 20,
  },
  reviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  reviewRating: {
    flexDirection: "row",
  },
  reviewLikeButton: {
    padding: 5,
  },
  reviewLikeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewLikeText: {
    color: "white",
    marginLeft: 5,
    fontSize: 14,
  },
  expandedAlbumRow: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    marginBottom: 10,
    paddingBottom: 10,
  },
  tracksContainer: {
    marginTop: 10,
    paddingHorizontal: 10,
    width: "100%",
  },
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  trackNumber: {
    color: "gray",
    width: 24,
    fontSize: 12,
  },
  trackName: {
    color: "lightgray",
    fontSize: 12,
    flex: 1,
  },
  albumContainerWrapper: {
    borderBottomColor: "#333",
    borderBottomWidth: 1,
  },
  expandedAlbumContainer: {
    backgroundColor: "#1a1a1a",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  albumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  albumInfo: {
    marginLeft: 10,
    flex: 1,
  },
  albumName: {
    color: "white",
    fontSize: 14,
    marginBottom: 2,
  },
  albumYear: {
    color: "gray",
    fontSize: 12,
  },
  tracksContainer: {
    paddingLeft: 60,
    paddingRight: 10,
  },
  tracksList: {
    paddingBottom: 10,
  },
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  trackNumber: {
    color: "gray",
    width: 24,
    fontSize: 12,
  },
  trackName: {
    color: "lightgray",
    fontSize: 12,
    flex: 1,
  },
  albumRowWrapper: {
    marginBottom: 10,
  },
  loadingContainer1: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    paddingBottom: 70,
  },
  loadingContainer2: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    paddingTop: 150,
  },
  spotifyIconWrapper: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "black",
    padding: 5,
    borderRadius: 50,
    opacity: 0.7,
    zIndex: 5,
  },
});

export default ArtistProfile;
