import React, { useEffect, useState, useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useLocalSearchParams } from "expo-router";
import { BACKEND_COMMENT_URL } from "../../constants/apiConstants";
import { AuthContext } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { getAccessToken } from "../../api/spotify";
import { getUserProfile } from "../../api/backend";
import {
  BACKEND_PROFILE_PICTURE_DOWNLOADER_URL,
  BACKEND_REVIEW_LIKE_URL,
} from "../../constants/apiConstants";
import { IS_DEVELOPMENT } from "../../constants/apiConstants";
import FontAwesome from "react-native-vector-icons/FontAwesome";

const ReviewDetail = () => {
  const { userId } = useContext(AuthContext);
  const params = useLocalSearchParams();
  const screenHeight = Dimensions.get("window").height;
  const modalHeight = Dimensions.get("window").height * 0.3;
  const [isNewDataComing, setIsNewDataComing] = useState(false);
  const defaultProfileImage = require("../../../assets/images/default-profile-photo.webp");
  const router = useRouter();

  const getProfileImageUrl = (fileName) => {
    if (!fileName || fileName === "default.png") {
      return Image.resolveAssetSource(defaultProfileImage).uri;
    }
    return `${BACKEND_PROFILE_PICTURE_DOWNLOADER_URL}/s3/download/${fileName}`;
  };

  const {
    id,
    username,
    profileImage,
    createdAt,
    comment,
    rating,
    likeCount,
    albumImage: paramAlbumImage,
    albumName: paramAlbumName,
    artistName: paramArtistName,
    releaseYear: paramReleaseYear,
    spotifyId,
    isLiked: paramIsLiked,
    likeId: paramLikeId,
    reviewUserId,
  } = params;

  console.log("ReviewDetail params:", params);

  const [albumImage, setAlbumImage] = useState(null);
  const [albumName, setAlbumName] = useState(null);
  const [artistName, setArtistName] = useState(null);
  const [releaseYear, setReleaseYear] = useState(null);

  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Use useRef for animated value to prevent recreation
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  const [isLiked, setIsLiked] = useState(
    paramIsLiked === true || paramIsLiked === "true" ? true : false
  );
  const [currentLikeCount, setCurrentLikeCount] = useState(likeCount || 0);
  const [likeId, setLikeId] = useState(paramLikeId || null);

  const [albumModalVisible, setAlbumModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      setIsLiked(
        paramIsLiked === true || paramIsLiked === "true" ? true : false
      );
      setCurrentLikeCount(Number(likeCount) || 0);
      setLikeId(paramLikeId || null);
    }
  }, [id, paramIsLiked, likeCount, paramLikeId]);

  const openModal = () => {
    setModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      friction: 5, // sürtünme (ne kadar hızlı duracağı)
      tension: 50, // esnekliği kontrol eder (yüksek olursa daha çok zıplar)
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    setNewComment("");
    Animated.timing(slideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true, // Consistent native driver
    }).start(() => setModalVisible(false));
  };

  useEffect(() => {
    if (!id) return;

    setIsNewDataComing(true);

    // Önce her şeyi temizle
    setComments([]);
    setAlbumImage(null);
    setAlbumName(null);
    setArtistName(null);
    setReleaseYear(null);
    setIsLiked(false);
    setCurrentLikeCount(0);
    setLikeId(null);
    setLoadingComments(true);

    const fetchComments = async () => {
      try {
        const response = await fetch(
          `${BACKEND_COMMENT_URL}/get-comments/${id}`
        );
        if (!response.ok) throw new Error("Failed to fetch comments");
        const data = await response.json();
        const commentsWithProfiles = await Promise.all(
          (data?.content || []).map(async (comment) => {
            const userProfile = await getUserProfile(comment.userId);
            return {
              ...comment,
              userId: comment.userId,
              username: userProfile?.username || `User ${comment.userId}`,
              profileImage: userProfile?.profileImage || null,
            };
          })
        );
        setComments(
          commentsWithProfiles.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          )
        );
      } catch (error) {
        if (IS_DEVELOPMENT) {
          console.error("Error fetching comments:", error);
          Alert.alert("Error", "Could not load comments");
        }
      } finally {
        setLoadingComments(false);
      }
    };

    const fetchAlbumInfo = async () => {
      try {
        if (spotifyId) {
          const token = await getAccessToken();
          const response = await fetch(
            `https://api.spotify.com/v1/albums/${spotifyId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const data = await response.json();

          setAlbumImage(data.images?.[0]?.url || null);
          setAlbumName(data.name || "Unknown Album");
          setArtistName(data.artists?.[0]?.name || "Unknown Artist");
          setReleaseYear(
            new Date(data.release_date).getFullYear() || "Unknown Year"
          );
        } else {
          // Eğer spotifyId yoksa params'tan gelen bilgileri kullan
          setAlbumImage(paramAlbumImage || null);
          setAlbumName(paramAlbumName || null);
          setArtistName(paramArtistName || null);
          setReleaseYear(paramReleaseYear || null);
        }
      } catch (error) {
        console.error("Error fetching album info from Spotify:", error);
      }
    };

    const applyBasicParams = () => {
      setIsLiked(
        paramIsLiked === true || paramIsLiked === "true" ? true : false
      );
      setCurrentLikeCount(Number(likeCount) || 0);
      setLikeId(paramLikeId || null);
    };

    applyBasicParams();
    fetchComments();
    fetchAlbumInfo();
    setIsNewDataComing(false);
  }, [id]);

  const handleSendComment = async () => {
    if (!newComment.trim()) return;

    setSending(true);
    try {
      const response = await fetch(`${BACKEND_COMMENT_URL}/add-comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          reviewId: id,
          comment: newComment,
        }),
      });

      if (!response.ok) throw new Error("Failed to post comment");

      const savedComment = await response.json(); // zaten direkt yorum objesi
      const userProfile = await getUserProfile(savedComment.userId);

      setComments((prev) => [
        {
          ...savedComment,
          userId: savedComment.userId,
          username: userProfile?.username || `User ${savedComment.userId}`,
          profileImage: userProfile?.profileImage || null, // Burası eksikti!
        },
        ...prev,
      ]);

      setNewComment("");
      closeModal();
    } catch (error) {
      console.error("Error posting comment:", error);
      Alert.alert("Error", "Could not send comment");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const response = await fetch(
        `${BACKEND_COMMENT_URL}/delete-comment/${commentId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }

      setComments((prevComments) =>
        prevComments.filter((comment) => comment.id !== commentId)
      );
    } catch (error) {
      console.error("Error deleting comment:", error);
      Alert.alert("Error", "Could not delete comment");
    }
  };

  const handleGoBack = () => {
    // Yorumlar
    setComments([]);
    setLoadingComments(true);
    setNewComment("");
    setModalVisible(false);

    // Review bilgileri
    setAlbumImage(null);
    setAlbumName(null);
    setArtistName(null);
    setReleaseYear(null);

    // Beğeni bilgileri
    setIsLiked(false);
    setCurrentLikeCount(0);
    setLikeId(null);

    // Keyboard
    Keyboard.dismiss();

    // Geri git
    router.back();
  };

  const handleToggleLike = async () => {
    const previousIsLiked = isLiked;
    const previousLikeCount = currentLikeCount;
    const previousLikeId = likeId;

    try {
      if (isLiked) {
        // Önce hemen UI'da unlike göster
        setIsLiked(false);
        setCurrentLikeCount((prev) => Math.max(prev - 1, 0));
        setLikeId(null);

        // Sonra API'ye unlike isteği gönder
        const response = await fetch(
          `${BACKEND_REVIEW_LIKE_URL}/review-like/unlike/${likeId}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          }
        );
        if (!response.ok) throw new Error("Unlike failed");
      } else {
        // Önce hemen UI'da like göster
        setIsLiked(true);
        setCurrentLikeCount((prev) => prev + 1);

        // Sonra API'ye like isteği gönder
        const response = await fetch(
          `${BACKEND_REVIEW_LIKE_URL}/review-like/like`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, reviewId: id }),
          }
        );
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error("Like failed");

        setLikeId(data.data); // likeId'yi kaydet
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      Alert.alert("Error", "Could not update like status");

      // HATA OLURSA geri al
      setIsLiked(previousIsLiked);
      setCurrentLikeCount(previousLikeCount);
      setLikeId(previousLikeId);
    }
  };

  const AlbumImageModal = () => {
    return (
      <Modal
        visible={albumModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAlbumModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setAlbumModalVisible(false)}>
          <View style={styles.imageModalBackground}>
            <TouchableWithoutFeedback>
              <View style={styles.imageModalContent}>
                <Image
                  source={{ uri: albumImage }}
                  style={styles.imageModalImage}
                />
                <Text style={styles.imageModalText}>
                  {albumName || "Album"}
                </Text>
                <Text style={styles.imageModalTextSmall}>
                  {artistName || "Artist"} • {releaseYear || "Year"}
                </Text>
                <TouchableOpacity
                  style={styles.spotifyButton}
                  onPress={() => {
                    if (spotifyId) {
                      Linking.openURL(
                        `https://open.spotify.com/album/${spotifyId}`
                      );
                    }
                  }}
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

  return (
    <SafeAreaView style={styles.container}>
      <AlbumImageModal />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }} // Altta boşluk kalır
          keyboardShouldPersistTaps="handled"
        >
          {/* Fixed header section */}
          <View style={styles.reviewInfoContainer}>
            <View style={styles.userInfo}>
              <TouchableOpacity
                onPress={handleGoBack}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={28} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  router.push({
                    pathname: "/Screens/Profile/Profile/",
                    params: { userId: params.reviewUserId },
                  });
                }}
              >
                {profileImage ? (
                  <Image
                    source={{ uri: getProfileImageUrl(profileImage) }}
                    style={styles.profileImageSmall}
                  />
                ) : (
                  <View style={styles.profileImagePlaceholder} />
                )}
              </TouchableOpacity>

              <View style={styles.userTextContainer}>
                <TouchableOpacity
                  onPress={() => {
                    router.push({
                      pathname: "/Screens/Profile/Profile/",
                      params: { userId: params.reviewUserId },
                    });
                  }}
                >
                  <Text style={styles.username}>{username}</Text>
                </TouchableOpacity>
                <Text style={styles.date}>
                  {new Date(createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>

            <View style={styles.albumAndCommentContainer}>
              <View style={styles.albumTopSection}>
                <TouchableOpacity onPress={() => setAlbumModalVisible(true)}>
                  <Image
                    source={{ uri: albumImage }}
                    style={styles.albumCover}
                  />
                </TouchableOpacity>

                <View style={styles.albumInfoTexts}>
                  <Text style={styles.albumName}>{albumName}</Text>
                  <Text style={styles.artistYear}>
                    {artistName} • {releaseYear}
                  </Text>
                  <View style={styles.ratingContainer}>
                    {[...Array(5)].map((_, index) => {
                      const diff = rating - index;
                      let iconName = "star-outline";
                      if (diff >= 0.75) {
                        iconName = "star";
                      } else if (diff >= 0.25) {
                        iconName = "star-half";
                      }
                      return (
                        <Ionicons
                          key={index}
                          name={iconName}
                          size={24}
                          color="#FFD700"
                        />
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.reviewCommentSection}>
                <Text style={styles.reviewText}>{comment}</Text>
              </View>
            </View>

            <View style={styles.likeContainer}>
              <TouchableOpacity
                onPress={handleToggleLike}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={24}
                  color={isLiked ? "red" : "white"}
                />
                <Text style={styles.likeText}>{currentLikeCount} Likes</Text>
              </TouchableOpacity>

              <Ionicons
                name="chatbubble-outline"
                size={20}
                color="white"
                style={{ marginLeft: 20 }}
              />
              <Text style={styles.likeCommentText}>{comments.length}</Text>
            </View>
          </View>

          {/* Scrollable comments section */}
          <ScrollView
            style={styles.commentsScrollView}
            contentContainerStyle={styles.commentsContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {loadingComments ? (
              <ActivityIndicator size="small" color="#1DB954" />
            ) : comments.length > 0 ? (
              comments.map((comment) => (
                <TouchableOpacity
                  key={comment.id}
                  onLongPress={() => {
                    if (String(comment.userId) === String(userId)) {
                      Alert.alert(
                        "Delete Comment",
                        "Are you sure you want to delete this comment?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => handleDeleteComment(comment.id),
                          },
                        ],
                        { cancelable: true }
                      );
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.commentItem}>
                    <View style={styles.commentHeader}>
                      <View style={styles.commentUserInfo}>
                        <TouchableOpacity
                          onPress={() => {
                            router.push({
                              pathname: "/Screens/Profile/Profile/",
                              params: { userId: comment.userId },
                            });
                          }}
                        >
                          <Text style={styles.commentUsername}>
                            {comment.username}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.commentText}>{comment.comment}</Text>

                    <Text style={styles.commentDate}>
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noCommentsText}>No comments yet.</Text>
            )}
          </ScrollView>

          {/* Comment Modal */}
          <Modal
            visible={modalVisible}
            transparent={true}
            animationType="none"
            onRequestClose={closeModal}
          >
            <TouchableWithoutFeedback onPress={closeModal}>
              <View style={styles.modalOverlay}>
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : "height"}
                  style={{ flex: 1 }}
                >
                  <TouchableWithoutFeedback>
                    <Animated.View
                      style={[
                        styles.modalContentContainer,
                        {
                          transform: [{ translateY: slideAnim }],
                          height: modalHeight,
                        },
                      ]}
                    >
                      <View style={styles.modalHeader}>
                        <Pressable
                          onPress={closeModal}
                          style={styles.modalCloseButton}
                        >
                          <Text style={styles.modalCloseText}>Cancel</Text>
                        </Pressable>
                        <Text style={styles.modalTitle}>Add Comment</Text>
                        <TouchableOpacity
                          style={styles.modalSubmitButton}
                          onPress={handleSendComment}
                          disabled={sending}
                        >
                          {sending ? (
                            <ActivityIndicator color="white" />
                          ) : (
                            <Text style={styles.modalSubmitText}>Post</Text>
                          )}
                        </TouchableOpacity>
                      </View>

                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="Write your comment..."
                          placeholderTextColor="#888"
                          multiline
                          autoFocus
                          value={newComment}
                          onChangeText={setNewComment}
                          maxLength={255}
                        />
                        <Text style={styles.characterCount}>
                          {newComment.length}/255
                        </Text>
                      </View>
                    </Animated.View>
                  </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </ScrollView>
        <TouchableOpacity
          style={styles.commentTrigger}
          onPress={openModal}
          activeOpacity={0.7}
        >
          <Text style={styles.commentTriggerText}>Add a comment...</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    paddingHorizontal: 20,
  },
  reviewInfoContainer: {
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileImageSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  profileImagePlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "gray",
    marginRight: 10,
  },
  userTextContainer: {
    justifyContent: "center",
  },
  username: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
    textAlign: "left",
  },
  date: {
    fontSize: 12,
    color: "gray",
    textAlign: "left",
  },
  albumInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    width: "100%",
  },
  albumCover: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginRight: 10,
  },
  albumCoverPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: "gray",
    borderRadius: 10,
    marginRight: 10,
  },
  albumText: {
    flexShrink: 1,
    justifyContent: "center",
  },
  albumName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    textAlign: "left",
  },
  artistName: {
    fontSize: 14,
    color: "gray",
    marginTop: 4,
    textAlign: "left",
  },
  ratingContainer: {
    flexDirection: "row",
    marginTop: 10,
    justifyContent: "flex-start",
    width: "100%",
  },
  reviewText: {
    fontSize: 16,
    color: "lightgrey",
    marginTop: 10,
    textAlign: "left",
  },
  likeContainer: {
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    justifyContent: "flex-start",
    width: "100%",
  },
  likeText: {
    fontSize: 16,
    color: "white",
    marginLeft: 5,
  },
  commentsWrapper: {
    flex: 1,
    marginTop: 10,
  },
  commentItem: {
    marginTop: 10,
    paddingLeft: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  commentText: {
    marginTop: 5,
    fontSize: 16,
    color: "lightgrey",
    textAlign: "left",
    paddingRight: 10,
  },
  commentDate: {
    fontSize: 12,
    color: "gray",
    marginTop: 10,
    textAlign: "left",
  },
  noCommentsText: {
    fontSize: 16,
    color: "gray",
    marginTop: 20,
    textAlign: "center",
  },
  commentTrigger: {
    padding: 15,
    backgroundColor: "#222",
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  commentTriggerText: {
    color: "#888",
    fontSize: 16,
  },
  modalOverlay: {
    paddingTop: 320,
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContentContainer: {
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    width: "100%",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: "#333",
    color: "white",
    borderRadius: 10,
    padding: 15,
    textAlignVertical: "top",
    fontSize: 16,
    flex: 1,
  },
  modalCloseButton: {
    padding: 10,
  },
  modalCloseText: {
    color: "white",
    fontSize: 16,
  },
  modalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalSubmitButton: {
    backgroundColor: "#1DB954",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  modalSubmitText: {
    color: "white",
    fontWeight: "bold",
  },
  inputContainer: {
    flex: 1,
    justifyContent: "flex-start",
  },
  albumAndCommentContainer: {
    flexDirection: "column",
    alignItems: "center",
    marginTop: 15,
    marginLeft: 0,
    width: "100%",
  },

  albumCommentTexts: {
    marginLeft: 12,
    flexShrink: 1,
  },

  artistYear: {
    fontSize: 14,
    color: "gray",
    marginTop: 2,
  },
  likeAndCommentContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },

  iconTextPair: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20, // Like ve comment arasına boşluk
  },

  likeCommentText: {
    color: "white",
    fontSize: 16,
    marginLeft: 5,
  },
  commentUsername: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  deleteIconButton: {
    padding: 5,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  characterCount: {
    alignSelf: "flex-end",
    color: "gray",
    fontSize: 12,
    marginTop: 5,
    marginRight: 5,
  },
  commentUserInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  commentProfileImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  commentProfileImagePlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "gray",
    marginRight: 8,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  backButton: {
    paddingRight: 5,
  },
  imageModalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  imageModalContent: {
    alignItems: "center",
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
  albumTopSection: {
    flexDirection: "row",
    marginBottom: 10,
  },
  albumInfoTexts: {
    flex: 1,
    marginLeft: 10,
    justifyContent: "center",
  },

  reviewCommentSection: {
    paddingHorizontal: 5,
    backgroundColor: "transparent",
    borderRadius: 0,
    width: "100%",
  },
});

export default ReviewDetail;
