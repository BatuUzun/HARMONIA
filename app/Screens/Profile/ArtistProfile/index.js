import React, { useEffect, useState, useCallback, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from "react-native";
import { getArtistAlbums, getAlbumTracks } from "../../../api/spotify";
import {
  getReviewsByAlbumIds,
  getUserProfile,
  getAverageRating,
} from "../../../api/backend";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import {
  Swipeable,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { BACKEND_REVIEW_LIKE_URL } from "../../../constants/apiConstants";
import { AuthContext } from "../../../context/AuthContext";
import ReviewScreen from "../../Review/Entry/index";
import { createStackNavigator } from "@react-navigation/stack";

const { width } = Dimensions.get("window");

const getCommunityRatingColor = (rating) => {
  if (rating >= 4) {
    return "green"; // Yüksek puanlar için yeşil
  } else if (rating >= 2) {
    return "orange"; // Orta puanlar için turuncu
  } else {
    return "red"; // Düşük puanlar için kırmızı
  }
};

function ArtistProfile({ route, navigation }) {
  const { artistId, artistName, artistImage } = route.params || {};

  console.log("ArtistProfile - Artist ID:", artistId); // Log the artist ID
  console.log("ArtistProfile - Artist Name:", artistName); // Log the artist name
  console.log("ArtistProfile - Artist Image:", artistImage); // Log the artist image URL
  const [albums, setAlbums] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likedReviews, setLikedReviews] = useState({});
  const [usernames, setUsernames] = useState({});
  const [selectedTab, setSelectedTab] = useState("Artist Profile");
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [averageRatings, setAverageRatings] = useState({});
  const [likeCounts, setLikeCounts] = useState({});

  const { userId } = useContext(AuthContext); // Get userId from AuthContext

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
      console.log("Fetching albums for artistId:", artistId); // Log artistId
      const albumsData = await getArtistAlbums(artistId);
      console.log("Albums data received:", albumsData); // Log the response

      if (!albumsData || !Array.isArray(albumsData)) {
        console.error("Invalid albums data:", albumsData);
        return;
      }

      setAlbums(albumsData);
      fetchAverageRatings(albumsData);
    } catch (error) {
      console.error("Error fetching albums:", error);
    }
  };

  const fetchAverageRatings = async (albums) => {
    try {
      const ratingsData = {};
      console.log("Albums received:", albums); // Debugging

      for (const album of albums) {
        console.log("Processing album:", album); // Debugging
        if (!album.id) {
          console.error("Album ID is undefined:", album);
          continue; // Skip this album
        }

        const averageRating = await getAverageRating(album.id);
        console.log(`Average rating for album ${album.id}:`, averageRating);

        ratingsData[album.id] =
          averageRating !== undefined &&
          typeof averageRating === "number" &&
          !isNaN(averageRating)
            ? averageRating
            : null;
      }
      setAverageRatings(ratingsData);
    } catch (error) {
      console.error("Error fetching average ratings:", error);
    }
  };

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const albumIds = albums.map((album) => album.id);
      const reviewsData = await getReviewsByAlbumIds(albumIds);
      setReviews(reviewsData);

      await fetchLikeCounts(reviewsData);
      await fetchLikedReviews(reviewsData); // Yeni fonksiyon eklendi
      fetchUsernames(reviewsData);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [albums]);

  useEffect(() => {
    if (selectedTab === "Review" || selectedTab === "Artist Profile") {
      fetchReviews();
    }
  }, [selectedTab, fetchReviews]);

  useEffect(() => {
    fetchReviews(); // Fetch reviews after albums are loaded
  }, [albums]);

  const fetchLikedReviews = async (reviewsData) => {
    let likedReviewsData = {};

    await Promise.all(
      reviewsData.map(async (review) => {
        try {
          const url = `${BACKEND_REVIEW_LIKE_URL}/review-like/${review.id}/is-liked/${userId}`;
          console.log(`🔍 Fetching liked status from: ${url}`);

          const response = await fetch(url);

          if (!response.ok) {
            console.error(
              `❌ API Error for review ${review.id}:`,
              response.status,
              response.statusText
            );
            likedReviewsData[review.id] = null;
            return;
          }

          const text = await response.text();
          if (!text) {
            console.warn(`⚠️ Empty response for review ${review.id}`);
            likedReviewsData[review.id] = null;
            return;
          }

          const data = JSON.parse(text);

          // 🔥 Eğer `data.id` null ise, bu review beğenilmemiş demektir
          likedReviewsData[review.id] = data.id ? data.id : null;
        } catch (error) {
          console.error(
            `❌ Error fetching liked status for review ${review.id}:`,
            error
          );
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
          console.error(
            `Error fetching like count for review ${review.id}:`,
            error
          );
          likeCountsData[review.id] = 0;
        }
      })
    );

    setLikeCounts(likeCountsData);
  };
  const fetchUsernames = async (reviews) => {
    try {
      const usernamesData = {};
      await Promise.all(
        reviews.map(async (review) => {
          const userProfile = await getUserProfile(review.userId);
          usernamesData[review.userId] = userProfile.username;
        })
      );
      setUsernames(usernamesData);
    } catch (error) {
      console.error("Error fetching usernames:", error);
    }
  };

  const fetchAlbumTracks = async (albumId) => {
    try {
      const tracksData = await getAlbumTracks(albumId);
      setTracks(tracksData);
    } catch (error) {
      console.error("Error fetching album tracks:", error);
    }
  };

  const handleAlbumPress = (albumId) => {
    if (selectedAlbum === albumId) {
      setSelectedAlbum(null);
      setTracks([]);
    } else {
      setSelectedAlbum(albumId);
      fetchAlbumTracks(albumId);
    }
  };

  const toggleLike = async (reviewId) => {
    const likeId = likedReviews[reviewId];

    try {
      if (likeId) {
        // Unlike işlemi
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

          await fetchReviews(); // 🔥 Refresh işlemi
        } else {
          console.error("Unlike işlemi başarısız:", await response.json());
        }
      } else {
        // Like işlemi
        const response = await fetch(
          `${BACKEND_REVIEW_LIKE_URL}/review-like/like`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, reviewId }),
          }
        );

        const data = await response.json();
        console.log("✅ Like işlemi response:", data); // API yanıtını logla

        if (response.ok || data.success) {
          // 🔥 Backend yanlış response dönse bile başarı say
          setLikedReviews((prev) => ({
            ...prev,
            [reviewId]: data.data || true,
          }));
          setLikeCounts((prev) => ({
            ...prev,
            [reviewId]: (prev[reviewId] || 0) + 1,
          }));

          await fetchReviews(); // 🔥 Refresh işlemi
        } else {
        }
      }
    } catch (error) {
      console.error("Like/Unlike işlemi sırasında hata oluştu:", error);
    } finally {
      setRefreshing(true); // 🔥 Refresh tetikle
    }
  };

  useEffect(() => {
    if (refreshing) {
      fetchReviews().then(() => setRefreshing(false)); // 🔥 Refresh tamamlanınca sıfırla
    }
  }, [refreshing]);

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

    console.log(`🎯 Album ID: ${albumId}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`🧾 Matching Review:`, userReview);

    return userReview ? userReview.rating : null;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!artistId) return;

      try {
        setLoading(true);
        const albumsData = await getArtistAlbums(artistId);
        setAlbums(albumsData);

        const albumIds = albumsData.map((album) => album.id);
        const reviewsData = await getReviewsByAlbumIds(albumIds);
        setReviews(reviewsData);

        await fetchAverageRatings(albumsData);
        await fetchLikeCounts(reviewsData);
        await fetchLikedReviews(reviewsData);
        await fetchUsernames(reviewsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [artistId, userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAlbums(); // Fetch updated albums
      await fetchReviews(); // Fetch updated reviews
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Albüm isimlerini kısaltan yardımcı fonksiyon
  const truncateAlbumName = (name, maxLength = 10) => {
    if (name.length > maxLength) {
      return name.substring(0, maxLength) + "...";
    }
    return name;
  };

  const renderAlbum = ({ item }) => {
    const userRating = getUserRatingForAlbum(item.id);

    const renderStars = (rating) => (
      <View style={{ flexDirection: "row", justifyContent: "center" }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <FontAwesome
            key={star}
            name={star <= rating ? "star" : "star-o"}
            size={14}
            color="yellow"
            style={{ marginHorizontal: 2 }}
          />
        ))}
      </View>
    );

    return (
      <View
        style={[
          styles.albumRow,
          {
            flexDirection: "column",
            alignItems: "flex-start",
            paddingVertical: 10,
          },
        ]}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", width: "100%" }}
        >
          <TouchableOpacity
            onPress={() => handleAlbumPress(item.id)}
            style={{ flex: 2 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Image
                source={{ uri: item.images[0].url }}
                style={styles.albumImage}
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.albumName}>
                  {truncateAlbumName(item.name)}
                </Text>
                <Text style={styles.albumYear}>
                  {item.release_date.split("-")[0]}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <View
            style={[styles.ratingColumn, { flex: 1, alignItems: "center" }]}
          >
            {userRating !== null ? (
              renderStars(userRating)
            ) : (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  navigation.navigate("Screens/Review/Entry/index", {
                    selectedAlbum: item,
                  });
                }}
              >
                <Ionicons name="add-circle-outline" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>

          <View
            style={[
              styles.communityRatingColumn,
              { flex: 1, alignItems: "center" },
            ]}
          >
            <Text
              style={{
                ...styles.communityRating,
                color: getCommunityRatingColor(
                  typeof averageRatings[item.id] === "number" &&
                    !isNaN(averageRatings[item.id])
                    ? averageRatings[item.id]
                    : 0
                ),
              }}
            >
              {typeof averageRatings[item.id] === "number" &&
              !isNaN(averageRatings[item.id])
                ? averageRatings[item.id].toFixed(1)
                : "0.0"}
            </Text>
          </View>
        </View>

        {selectedAlbum === item.id && tracks.length > 0 && (
          <View style={{ marginTop: 10, width: "100%" }}>
            {tracks.map((track) => (
              <Text key={track.id} style={styles.trackName}>
                {track.name}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderTrack = ({ item }) => (
    <View style={styles.trackContainer}>
      <Text style={styles.trackName}>{item.name}</Text>
    </View>
  );

  // Moved 'Review by' and username to appear before likes
  const renderReviewCard = ({ item }) => {
    const album = albums.find((album) => album.id === item.spotifyId);
    const username = usernames[item.userId] || `User ${item.userId}`;

    return (
      <GestureHandlerRootView>
        <Swipeable overshootRight={false}>
          <View style={styles.reviewContainer}>
            <Image
              source={{ uri: album?.images[0].url }}
              style={styles.albumImage}
            />
            <View style={styles.reviewContent}>
              <Text style={styles.albumName}>{album?.name}</Text>
              <View style={styles.starPicker}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <FontAwesome
                    key={star}
                    name="star"
                    size={14}
                    color={star <= item.rating ? "yellow" : "gray"}
                  />
                ))}
              </View>
              <Text style={styles.reviewText}>{item.comment}</Text>
              <Text style={styles.reviewByText}>
                Review by <Text style={styles.userName}>{username}</Text>
              </Text>
              <Text style={styles.reviewByText}>
                {new Date(item.createdAt).toDateString()}
              </Text>
              <View style={styles.reviewFooter}>
                <TouchableOpacity onPress={() => toggleLike(item.id)}>
                  <View style={styles.likeContainer}>
                    <Ionicons
                      name={likedReviews[item.id] ? "heart" : "heart-outline"}
                      size={20}
                      color={likedReviews[item.id] ? "red" : "white"}
                    />
                    <Text style={styles.likeText}>
                      {likeCounts[item.id] || 0} Likes
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

  const tabs = ["Artist Profile", "Review"];

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.navItem,
              selectedTab === tab && styles.selectedNavItem,
            ]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text
              style={[
                styles.navText,
                selectedTab === tab && styles.selectedNavText,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Image source={{ uri: artistImage }} style={styles.coverImage} />
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <FontAwesome name="arrow-left" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.profileContainer}>
        <Text style={styles.title}>{artistName}</Text>
        {selectedTab === "Artist Profile" && (
          <>
            <View
              style={[
                styles.headerRow,
                {
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                },
              ]}
            >
              <Text
                style={[styles.columnHeader, { flex: 2, textAlign: "left" }]}
              >
                Albums/Tracks
              </Text>
              <Text
                style={[styles.columnHeader, { flex: 1, textAlign: "center" }]}
              >
                Your Rating
              </Text>
              <Text
                style={[styles.columnHeader, { flex: 1, textAlign: "center" }]}
              >
                Community Rating
              </Text>
            </View>
            <FlatList
              data={albums}
              renderItem={renderAlbum}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }} // Add padding to the bottom
              style={{ flex: 1 }} // Ensure the FlatList takes up the full height
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          </>
        )}
        {selectedTab === "Review" &&
          (reviews.length > 0 ? (
            <FlatList
              data={reviews}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={fetchReviews}
                />
              }
              renderItem={renderReviewCard}
            />
          ) : (
            <View style={{ alignItems: "center", marginTop: 20 }}>
              <Text style={{ color: "gray", fontSize: 16 }}>
                There is no review for this artist.
              </Text>
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 10,
    marginBottom: 10, // Added spacing
  },
  navItem: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: "#333",
    marginHorizontal: 5, // Added horizontal spacing between items
  },
  selectedNavItem: {
    backgroundColor: "white",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  navText: {
    color: "gray",
    fontSize: 16,
  },
  selectedNavText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
  },
  coverImage: {
    width: "100%",
    height: width * 0.6,
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 1,
  },
  profileContainer: {
    flex: 1, // Ensure the container takes up the full height
    padding: 20,
  },
  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  albumRow: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    marginBottom: 12,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  albumColumn: {
    flex: 2,
    alignItems: "flex-start",
  },
  ratingColumn: {
    flex: 1,
    alignItems: "center",
  },
  communityRatingColumn: {
    flex: 1,
    alignItems: "center",
  },
  columnHeader: {
    color: "lightgray",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
    marginHorizontal: 10,
  },
  albumContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  albumImage: {
    width: 55,
    height: 55,
    borderRadius: 10,
    marginRight: 10,
  },
  albumInfo: {
    flexDirection: "column",
    justifyContent: "center",
  },
  albumName: {
    color: "white",
    fontSize: 14,
    maxWidth: 150,
  },
  albumYear: {
    color: "gray",
    fontSize: 11,
  },
  userRating: {
    color: "yellow",
    fontSize: 14,
  },
  reviewContainer: {
    flexDirection: "row",
    backgroundColor: "#262626",
    margin: 10,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  reviewContent: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
    marginTop: 5,
  },
  reviewText: {
    fontSize: 12,
    color: "lightgray",
    marginTop: 5,
  },
  reviewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  starPicker: {
    flexDirection: "row",
    marginTop: 5,
  },

  trackContainer: {
    padding: 5,
  },
  trackName: {
    color: "#ccc",
    fontSize: 14,
    paddingVertical: 3,
    borderBottomColor: "#333",
    borderBottomWidth: 1,
  },
  trackList: {
    marginTop: 5,
  },
  ratingContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    width: "100%", // Added
  },
  ratingText: {
    color: "yellow",
    fontSize: 14,
    marginTop: 5,
    fontWeight: "bold",
    textAlign: "center", // Added
  },
  communityRating: {
    color: "yellow",
    fontSize: 14,
  },
  likeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeText: {
    color: "white",
    marginLeft: 5,
  },
  addButton: {
    marginTop: 5,
    alignItems: "center",
  },
  reviewByText: {
    fontSize: 12,
    color: "lightgray",
    marginTop: 5,
  },
});

export default ArtistProfile;
