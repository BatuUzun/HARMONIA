import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BACKEND_COMMENT_URL,
  BACKEND_REVIEW_LIKE_URL,
} from "../../constants/apiConstants";
import { AuthContext } from "../../context/AuthContext";

const ReviewDetailScreen = () => {
  const { userId } = useContext(AuthContext);
  const params = useLocalSearchParams();
  const router = useRouter();

  // State for all data
  const [reviewData, setReviewData] = useState(null);
  const [albumData, setAlbumData] = useState(null);
  const [userProfileData, setUserProfileData] = useState(null);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeId, setLikeId] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);

  // Parse params when they change
  useEffect(() => {
    const fetchAlbumInfoFromSpotify = async (spotifyId) => {
      try {
        const tokenResponse = await fetch(TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
        });
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const albumResponse = await fetch(
          `https://api.spotify.com/v1/albums/${spotifyId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        const data = await albumResponse.json();

        const album = {
          id: spotifyId,
          name: data.name,
          images: data.images,
          release_date: data.release_date,
          artists: data.artists,
        };

        setAlbumData(album);
      } catch (error) {
        console.error("Error fetching album from Spotify:", error);
      }
    };

    if (params.review && params.userProfile) {
      try {
        const parsedReview = JSON.parse(params.review);
        const parsedUserProfile = JSON.parse(params.userProfile);
        setReviewData(parsedReview);
        setUserProfileData(parsedUserProfile);
        setLikeCount(Number(params.likeCount) || 0);
        setIsLiked(params.isLiked === "true" || Boolean(params.isLiked));

        if (params.album) {
          setAlbumData(JSON.parse(params.album));
        } else {
          fetchAlbumInfoFromSpotify(parsedReview.spotifyId);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error parsing data:", error);
        Alert.alert("Error", "Failed to load review data");
        router.back();
      }
    }
  }, []);

  // Fetch comments when review data is available
  useEffect(() => {
    if (!reviewData) return;

    setComments([]);

    const fetchComments = async () => {
      try {
        const response = await fetch(
          `${BACKEND_COMMENT_URL}/get-comments/${reviewData.id}`
        );

        if (!response.ok) throw new Error("Failed to fetch comments");

        const data = await response.json();
        setComments(data?.content || []);
      } catch (error) {
        console.error("Error fetching comments:", error);
        Alert.alert("Error", "Could not load comments");
      }
    };

    fetchComments();
  }, [reviewData]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !reviewData) return;

    try {
      const response = await fetch(`${BACKEND_COMMENT_URL}/add-comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewId: reviewData.id,
          userId: userId,
          comment: newComment,
        }),
      });

      const data = await response.json();

      if (!response.ok)
        throw new Error(data.message || "Failed to post comment");

      setComments((prev) => [data, ...prev]);
      setNewComment("");
    } catch (error) {
      console.error("Error posting comment:", error);
      Alert.alert("Error", error.message || "Could not post comment");
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

      if (!response.ok) throw new Error("Failed to delete comment");

      setComments(comments.filter((comment) => comment.id !== commentId));
    } catch (error) {
      console.error("Error deleting comment:", error);
      Alert.alert("Error", "Could not delete comment");
    }
  };

  const handleLike = async () => {
    if (!reviewData) return;

    const likeId = isLiked; // This could be true/false or the actual like ID
    const wasLiked = !!likeId;
    const previousLikeCount = likeCount;

    // Optimistic update
    setIsLiked(!wasLiked);
    setLikeCount(
      wasLiked ? Math.max(previousLikeCount - 1, 0) : previousLikeCount + 1
    );

    try {
      if (wasLiked) {
        // Unlike
        const response = await fetch(
          `${BACKEND_REVIEW_LIKE_URL}/review-like/unlike/${likeId}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) throw new Error("Unlike operation failed");
      } else {
        // Like
        const response = await fetch(
          `${BACKEND_REVIEW_LIKE_URL}/review-like/like`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, reviewId: reviewData.id }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success)
          throw new Error("Like operation failed");

        // Update with the actual like ID if needed
        setIsLiked(data.data || true);
      }
    } catch (error) {
      console.error("Like/Unlike operation failed:", error);
      // Revert optimistic update
      setIsLiked(wasLiked);
      setLikeCount(previousLikeCount);
      Alert.alert("Error", "Could not update like status");
    }
  };

  if (loading || !reviewData || !albumData || !userProfileData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header with back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        {/* Review content */}
        <View style={styles.reviewContainer}>
          {/* User info */}
          <View style={styles.userInfo}>
            <Image
              source={
                userProfileData.profileImage
                  ? { uri: userProfileData.profileImage }
                  : require("../../../assets/images/default-profile-photo.webp")
              }
              style={styles.profileImage}
            />
            <View style={styles.userText}>
              <Text style={styles.username}>{userProfileData.username}</Text>
              <Text style={styles.date}>
                {new Date(reviewData.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {/* Album info */}
          <View style={styles.albumInfo}>
            <Image
              source={{ uri: albumData.images[0].url }}
              style={styles.albumCover}
            />
            <View style={styles.albumText}>
              <Text style={styles.albumName}>{albumData.name}</Text>
              <Text style={styles.artistName}>
                {albumData.artists[0].name} •{" "}
                {new Date(albumData.release_date).getFullYear()}
              </Text>
            </View>
          </View>

          {/* Rating */}
          <View style={styles.rating}>
            {[...Array(5)].map((_, i) => (
              <Ionicons
                key={i}
                name={i < reviewData.rating ? "star" : "star-outline"}
                size={24}
                color="#FFD700"
              />
            ))}
          </View>

          {/* Review text */}
          <Text style={styles.reviewText}>{reviewData.comment}</Text>

          {/* Like button */}
          <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
            <View style={styles.likeContainer}>
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={24}
                color={isLiked ? "red" : "white"}
              />
              <Text style={styles.likeText}>{likeCount} Likes</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Comments section */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Comments</Text>

          {comments.length > 0 ? (
            comments.map((comment) => (
              <View key={comment.id} style={styles.comment}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentUser}>
                    {comment.userId === userId
                      ? "You"
                      : `User ${comment.userId}`}
                  </Text>
                  {comment.userId === userId && (
                    <TouchableOpacity
                      onPress={() => handleDeleteComment(comment.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.commentText}>{comment.comment}</Text>
                <Text style={styles.commentDate}>
                  {new Date(comment.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noComments}>No comments yet</Text>
          )}
        </View>
      </ScrollView>

      {/* Comment input */}
      <View style={styles.commentInputContainer}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor="#888"
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <TouchableOpacity
          style={styles.postButton}
          onPress={handleAddComment}
          disabled={!newComment.trim()}
        >
          <Text style={styles.postButtonText}>Post</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  scrollContainer: {
    paddingTop: 20,
    paddingBottom: 80,
  },
  header: {
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  reviewContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userText: {
    flex: 1,
  },
  username: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  date: {
    color: "gray",
    fontSize: 12,
  },
  albumInfo: {
    flexDirection: "row",
    marginBottom: 15,
  },
  albumCover: {
    width: 80,
    height: 80,
    borderRadius: 5,
    marginRight: 15,
  },
  albumText: {
    flex: 1,
    justifyContent: "center",
  },
  albumName: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  artistName: {
    color: "gray",
    fontSize: 14,
  },
  rating: {
    flexDirection: "row",
    marginBottom: 15,
  },
  reviewText: {
    color: "white",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  likeButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  likeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeText: {
    color: "white",
    marginLeft: 5,
  },
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: "#333",
    padding: 20,
  },
  commentsTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  comment: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  commentUser: {
    color: "white",
    fontWeight: "bold",
    marginBottom: 3,
  },
  commentText: {
    color: "white",
    marginBottom: 3,
  },
  commentDate: {
    color: "gray",
    fontSize: 12,
  },
  noComments: {
    color: "gray",
    textAlign: "center",
    marginVertical: 20,
  },
  commentInputContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1E1E1E",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#333",
    color: "white",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
  },
  postButton: {
    marginLeft: 10,
    padding: 10,
  },
  postButtonText: {
    color: "#1DB954",
    fontWeight: "bold",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
});

export default ReviewDetailScreen;
