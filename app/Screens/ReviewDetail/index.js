import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Keyboard,
  SafeAreaView,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { AuthContext } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import {
  BACKEND_PROFILE_PICTURE_DOWNLOADER_URL,
  BACKEND_REVIEW_LIKE_URL,
  BACKEND_REVIEW_URL,
  BACKEND_IMAGE_DOWNLOAD_URL,
} from "../../constants/apiConstants";
import { getAccessToken } from "../../api/spotify";
import { 
  getCommentCount, 
  likeReview, 
  unlikeReview, 
  getLikeCount,
  getCommentsByReviewId,
  getUserProfile,
  deleteCommentById
} from "../../api/backend";
import axios from "axios";
import { Pressable } from "react-native"; // ✅ Add this import
import { Alert } from "react-native";
import { useFocusEffect } from "expo-router";

const ReviewDetail = () => {
  const { userId } = useContext(AuthContext);
  const params = useLocalSearchParams();
  const screenHeight = Dimensions.get("window").height;
  const defaultProfileImage = require("../../../assets/images/default-profile-photo.webp");
  const router = useRouter();
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  
  const {
    id,
    username,
    profileImage,
    createdAt,
    comment,
    rating,
    albumImage: paramAlbumImage,
    albumName: paramAlbumName,
    artistName: paramArtistName,
    releaseYear: paramReleaseYear,
    spotifyId,
    isLiked: paramIsLiked,
    likeId: paramLikeId,
    reviewUserId,
  } = params;

  const [albumImage, setAlbumImage] = useState(null);
  const [albumName, setAlbumName] = useState(null);
  const [artistName, setArtistName] = useState(null);
  const [releaseYear, setReleaseYear] = useState(null);
  const [profileImageUri, setProfileImageUri] = useState(null);

  const [isLiked, setIsLiked] = useState(
    paramIsLiked === true || paramIsLiked === "true"
  );
  const [currentLikeCount, setCurrentLikeCount] = useState(0);
  const [likeId, setLikeId] = useState(paramLikeId || null);
  const [commentCount, setCommentCount] = useState(0);
  const [albumModalVisible, setAlbumModalVisible] = useState(false);
  
  // New state for comments
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [userCache, setUserCache] = useState({});

  useFocusEffect(
    React.useCallback(() => {
      // Clear album image on focus to force re-load
      setAlbumImage(null);
  
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
            setReleaseYear(new Date(data.release_date).getFullYear() || "Unknown Year");
          } else {
            setAlbumImage(paramAlbumImage || null);
            setAlbumName(paramAlbumName || null);
            setArtistName(paramArtistName || null);
            setReleaseYear(paramReleaseYear || null);
          }
        } catch (error) {
          console.error("Error fetching album info from Spotify:", error);
        }
      };
  
      fetchAlbumInfo();
    }, [spotifyId])
  );
  
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
  
    setSendingComment(true);
    try {
      const response = await axios.post(`${BACKEND_REVIEW_URL}/api/comment/add-comment`, {
        userId,
        reviewId: id,
        comment: newComment.trim(),
      });
  
      const addedComment = response.data;
      setComments((prev) => [addedComment, ...prev]); // prepend
      setCommentCount((prev) => prev + 1);
      setNewComment(""); // clear input
    } catch (err) {
      Alert.alert("Error", "Failed to post comment.");
      console.error("Failed to post comment:", err);
    } finally {
      setSendingComment(false);
    }
  };
  
  // New function to get profile image as base64
  const getProfileImageBase64 = async (fileName) => {
    if (!fileName || fileName === "default.png") {
      return Image.resolveAssetSource(defaultProfileImage).uri;
    }
    
    try {
      const response = await fetch(
        `${BACKEND_IMAGE_DOWNLOAD_URL}/profile-picture-downloader/download/${fileName}`
      );
      const base64 = await response.text(); // because your endpoint returns plain text
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error("Error fetching image:", error);
      return Image.resolveAssetSource(defaultProfileImage).uri;
    }
  };

  // Cache for base64 images
  const [imageCache, setImageCache] = useState({});

  // Function to get image from cache or fetch it
  const getProfileImage = async (fileName) => {
    if (!fileName || fileName === "default.png") {
      return Image.resolveAssetSource(defaultProfileImage).uri;
    }
    
    // Check if image is in cache
    if (imageCache[fileName]) {
      return imageCache[fileName];
    }
    
    // If not in cache, fetch and cache it
    try {
      const base64Image = await getProfileImageBase64(fileName);
      setImageCache(prev => ({
        ...prev,
        [fileName]: base64Image
      }));
      return base64Image;
    } catch (error) {
      console.error("Error getting profile image:", error);
      return Image.resolveAssetSource(defaultProfileImage).uri;
    }
  };

  useEffect(() => {
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
          setAlbumImage(paramAlbumImage || null);
          setAlbumName(paramAlbumName || null);
          setArtistName(paramArtistName || null);
          setReleaseYear(paramReleaseYear || null);
        }
      } catch (error) {
        console.error("Error fetching album info from Spotify:", error);
      }
    };
  
    const fetchCommentCount = async () => {
      try {
        const count = await getCommentCount(id);
        setCommentCount(count);
      } catch (err) {
        console.error("Error fetching comment count:", err);
      }
    };
  
    const loadProfileImage = async () => {
      if (profileImage) {
        const imageUri = await getProfileImage(profileImage);
        setProfileImageUri(imageUri);
      }
    };
  
    if (id) {
      // 🔄 Reset comment state to prevent showing old data
      setComments([]);
      setCurrentPage(0);
      setHasMoreComments(true);
  
      fetchAlbumInfo();
      fetchCommentCount();
      fetchComments(); // Fetch comments for new review
      loadProfileImage();
    }
  }, [id, profileImage]);

  const fetchComments = async (page = 0) => {
    if (loadingComments || !id) return;
    
    try {
      setLoadingComments(true);
      const response = await getCommentsByReviewId(id, page);
      
      // Handle the response based on the ReviewCommentResponseDTO structure
      if (response && Array.isArray(response.content)) {
        const commentData = response.content;
        if (Array.isArray(response.content)) {
          const commentData = response.content;
        
          setComments(prev => {
            // Filter out already displayed comments by id
            const existingIds = new Set(prev.map(c => c.id));
            const newComments = commentData.filter(c => !existingIds.has(c.id));
            return page === 0 ? newComments : [...prev, ...newComments];
          });
        
          setCurrentPage(page);
          setHasMoreComments(!response.last);
        } else {
          setHasMoreComments(false);
        }
        
        
        setCurrentPage(page);
        setHasMoreComments(!response.last);
      } else {
        setHasMoreComments(false);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const loadMoreComments = () => {
    if (hasMoreComments && !loadingComments) {
      fetchComments(currentPage + 1);
    }
  };

  const handleToggleLike = async () => {
    
    const previousIsLiked = isLiked;
    const previousLikeCount = currentLikeCount;
    const previousLikeId = likeId;

    try {
      if (isLiked) {
        setIsLiked(false);
        setCurrentLikeCount((prev) => Math.max(prev - 1, 0));
        setLikeId(null);

        const response = await fetch(
          `${BACKEND_REVIEW_LIKE_URL}/review-like/unlike/${likeId}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          }
        );
        if (!response.ok) throw new Error("Unlike failed");
      } else {
        setIsLiked(true);
        setCurrentLikeCount((prev) => prev + 1);

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

        setLikeId(data.data);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      setIsLiked(previousIsLiked);
      setCurrentLikeCount(previousLikeCount);
      setLikeId(previousLikeId);
    }
  };

  const handleGoBack = () => {
    setAlbumImage(null);
    setAlbumName(null);
    setArtistName(null);
    setReleaseYear(null);
    setIsLiked(false);
    setCurrentLikeCount(0);
    setLikeId(null);
    Keyboard.dismiss();
    router.back();
  };

  const AlbumImageModal = () => (
    <Modal
      visible={albumModalVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setAlbumModalVisible(false)}
    >
      <TouchableOpacity
        onPress={() => setAlbumModalVisible(false)}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.7)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View style={{ alignItems: "center" }}>
          <Image
            source={{ uri: albumImage }}
            style={{ width: 300, height: 300, borderRadius: 10 }}
          />
          <Text style={{ color: "white", marginTop: 10, fontSize: 18 }}>
            {albumName}
          </Text>
          <Text style={{ color: "white" }}>
            {artistName} • {releaseYear}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 15 }}
            onPress={() =>
              Linking.openURL(`https://open.spotify.com/album/${spotifyId}`)
            }
          >
            <FontAwesome name="spotify" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Comment item component with user info
  const CommentItem = ({ item }) => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    console.log("Rendering comment user ID:", item.userId);

    useEffect(() => {
      const fetchUserData = async () => {
        if (userCache[item.userId]) {
          setUserData(userCache[item.userId]);
          setLoading(false);
          return;
        }
  
        try {
          setLoading(true);
          const data = await getUserProfile(item.userId);
          setUserCache((prev) => ({ ...prev, [item.userId]: data }));
          setUserData(data);
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
      };
  
      fetchUserData();
    }, [item.userId]);
  
    const confirmDelete = () => {
      Alert.alert("Delete Comment", "Are you sure you want to delete this comment?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCommentById(item.id);
              setComments((prev) => prev.filter((c) => c.id !== item.id));
              setCommentCount((prev) => Math.max(prev - 1, 0));
            } catch (error) {
              Alert.alert("Error", "Failed to delete comment.");
            }
          },
        },
      ]);
    };
  
    return (
      <Pressable
        onLongPress={userId == item.userId ? confirmDelete : undefined}
        delayLongPress={500}
        style={{
          padding: 10,
          borderBottomWidth: 0.5,
          borderBottomColor: "#333",
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/Screens/Profile/Profile/",
                params: { userId: item.userId },
              })
            }
          >
            <Text style={{ color: "white", fontWeight: "bold" }}>
              {loading ? "Loading..." : userData?.username || `User ${item.userId}`}
            </Text>
          </TouchableOpacity>
          <Text style={{ color: "gray", fontSize: 12 }}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Text style={{ color: "white", marginTop: 3 }}>{item.comment}</Text>
      </Pressable>
    );
  };
  

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "black" }}>
      <AlbumImageModal />
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={handleGoBack}>
              <Ionicons name="chevron-back" size={28} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/Screens/Profile/Profile/",
                  params: { userId: reviewUserId },
                })
              }
            >
              <Image
                source={{ uri: profileImageUri || Image.resolveAssetSource(defaultProfileImage).uri }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  marginLeft: 10,
                  backgroundColor: "gray",
                }}
              />
            </TouchableOpacity>
            <View style={{ marginLeft: 10 }}>
              <Text style={{ color: "white", fontWeight: "bold" }}>
                {username}
              </Text>
              <Text style={{ color: "gray" }}>
                {new Date(createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setAlbumModalVisible(true)}
            style={{ marginTop: 20 }}
          >
            <Image
              source={{ uri: albumImage }}
              style={{ width: "100%", height: 300, borderRadius: 10 }}
            />
          </TouchableOpacity>

          <Text
            style={{ color: "white", fontSize: 18, fontWeight: "bold", marginTop: 10 }}
          >
            {albumName}
          </Text>
          <Text style={{ color: "gray", marginBottom: 10 }}>
            {artistName} • {releaseYear}
          </Text>

          <View style={{ flexDirection: "row", marginBottom: 10 }}>
            {[...Array(5)].map((_, index) => {
              const diff = rating - index;
              let iconName = "star-outline";
              if (diff >= 0.75) iconName = "star";
              else if (diff >= 0.25) iconName = "star-half";
              return (
                <Ionicons key={index} name={iconName} size={24} color="#FFD700" />
              );
            })}
          </View>

          <Text style={{ color: "white", fontSize: 16 }}>{comment}</Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 16,
              gap: 20,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="chatbubble-outline" size={20} color="white" />
              <Text style={{ color: "white", marginLeft: 6 }}>
                {commentCount}
              </Text>
            </View>
          </View>
          
          {/* Comments section */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ color: "white", fontWeight: "bold", fontSize: 18, marginBottom: 10 }}>
              Comments
            </Text>
            
            {comments.length > 0 ? (
              <View>
                {comments.map((item, index) => (
                  <CommentItem key={`comment-${item.id || index}`} item={item} />
                ))}
                
                {hasMoreComments && (
                  <TouchableOpacity 
                    onPress={loadMoreComments}
                    style={{ 
                      padding: 10, 
                      alignItems: "center", 
                      marginTop: 10,
                      backgroundColor: "#333",
                      borderRadius: 5,
                    }}
                    disabled={loadingComments}
                  >
                    {loadingComments ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={{ color: "white" }}>Load More Comments</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ) : loadingComments ? (
              <View style={{ alignItems: "center", padding: 20 }}>
                <ActivityIndicator size="small" color="white" />
              </View>
            ) : (
              <Text style={{ color: "gray", textAlign: "center", padding: 20 }}>
                No comments yet. Be the first to comment!
              </Text>
            )}
          </View>
        </View>
        <View style={{ marginTop: 16 }}>
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <TextInput
      style={{
        flex: 1,
        backgroundColor: "#222",
        color: "white",
        borderRadius: 6,
        padding: 10,
      }}
      placeholder="Write a comment..."
      placeholderTextColor="#999"
      value={newComment}
      onChangeText={setNewComment}
    />
    <TouchableOpacity
      onPress={handleAddComment}
      disabled={sendingComment}
      style={{
        marginLeft: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: sendingComment ? "#666" : "#1DB954",
        borderRadius: 6,
      }}
    >
      <Text style={{ color: "white", fontWeight: "bold" }}>
        {sendingComment ? "..." : "Send"}
      </Text>
    </TouchableOpacity>
  </View>
</View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default ReviewDetail;