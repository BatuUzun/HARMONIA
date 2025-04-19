import axios from "axios";
import {
  BACKEND_PROFILE_API_URL,
  BACKEND_SEARCH_PROFILE_URL,
  BACKEND_REVIEW_URL,
  BACKEND_REVIEW_LIKE_URL,
  IS_DEVELOPMENT,
  BACKEND_IMAGE_DOWNLOAD_URL,
  CONVERSATION_URL,
} from "../constants/apiConstants";

const searchPeople = async (username) => {
  try {
    const response = await axios.post(
      `${BACKEND_SEARCH_PROFILE_URL}/search-profile/search`,
      null,
      {
        params: { username },
      }
    );
    if (IS_DEVELOPMENT) {
      console.log("✅ API Response:", response.data);
    }
    return response.data;
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error(
        "❌ People Search Error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
};

// Kullanıcı profilini getir
const getUserProfile = async (id) => {
  try {
    const response = await axios.get(
      `${BACKEND_PROFILE_API_URL}/profile-api/get-user-profile/${id}`
    );
    if (IS_DEVELOPMENT) {
      console.log("✅ Fetch User Profile Response:", response.data);
    }
    return response.data;
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error(
        "❌ Fetch User Profile Error:",
        error.response?.data || error.message
      );
    }
    throw error;
  }
};

// Kullanıcı profilini güncelle
const updateUserProfile = async (id, profileData) => {
  try {
    const response = await axios.put(
      `${BACKEND_PROFILE_API_URL}/profile-api/update-profile/${id}`,
      profileData
    );
    if (IS_DEVELOPMENT) {
      console.log("✅ Update User Profile Response:", response.data);
    }
    return response.data;
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error(
        "❌ Update User Profile Error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
};

const getUserReview = async (userId, spotifyId) => {
  try {
    const response = await axios.get(
      `${BACKEND_REVIEW_URL}/review/user-review`,
      {
        params: { userId, spotifyId },
      }
    );
    if (IS_DEVELOPMENT) {
      console.log("✅ Get User Review Response:", response.data);
    }
    return response.data;
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error(
        "❌ Get User Review Error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
};

const getAverageRating = async (spotifyId) => {
  try {
    const response = await axios.get(
      `${BACKEND_REVIEW_URL}/review/calculate/spotify/${spotifyId}/average-rating`
    );
    if (IS_DEVELOPMENT) {
      console.log(
        `✅ Get Average Rating for Spotify ID ${spotifyId}:`,
        response.data
      );
    }
    return response.data;
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error(
        "❌ Get Average Rating Error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
};

const isReviewLikedByUser = async (reviewId, userId) => {
  try {
    const response = await axios.get(
      `${BACKEND_REVIEW_LIKE_URL}/review-like/${reviewId}/is-liked/${userId}`
    );
    return response.data;
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error(
        "❌ Error checking if review is liked:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
};

const likeReview = async (reviewId, userId) => {
  try {
    const response = await axios.post(
      `${BACKEND_REVIEW_LIKE_URL}/review-like/like`,
      {
        reviewId,
        userId: userId,
      }
    );
    return response.data;
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error(
        "❌ Error liking review:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
};

const unlikeReview = async (reviewId, userId) => {
  try {
    const response = await axios.delete(
      `${BACKEND_REVIEW_LIKE_URL}/review-like/unlike/${reviewId}`,
      {
        data: { userId: userId },
      }
    );
    return response.data;
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error(
        "❌ Error unliking review:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
};

const getLikeCount = async (reviewId) => {
  try {
    const response = await axios.get(
      `${BACKEND_REVIEW_LIKE_URL}/review-like/${reviewId}/count`
    );
    return response.data;
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error(
        "❌ Error getting like count:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
};

const getReviewsByAlbumIds = async (albumIds) => {
  try {
    const reviews = [];
    for (const albumId of albumIds) {
      const response = await axios.get(
        `${BACKEND_REVIEW_URL}/review/get-reviews/spotify/${albumId}`
      );
      if (IS_DEVELOPMENT) {
        console.log(
          `✅ Get Reviews for Album ID ${albumId}:`,
          response.data.content
        );
      }
      reviews.push(...response.data.content);
    }
    if (IS_DEVELOPMENT) {
      console.log("✅ Get Reviews By Album IDs Response:", reviews);
    }
    return reviews;
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error(
        "❌ Get Reviews By Album IDs Error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
};

const getMessagesByConversationId = async (conversationId, cursor = null) => {
  try {
    const url = cursor
      ? `${CONVERSATION_URL}/conversation/${conversationId}?cursor=${encodeURIComponent(
          cursor
        )}`
      : `${CONVERSATION_URL}/conversation/${conversationId}`;

    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    if (IS_DEVELOPMENT) {
      console.error(
        "❌ Get Messages Error:",
        error.response?.data || error.message
      );
    }
    throw error;
  }
};

const getProfileImageBase64 = async (fileName) => {
  try {
    const response = await fetch(
      `${BACKEND_IMAGE_DOWNLOAD_URL}/profile-picture-downloader/download/${fileName}`
    );
    const base64 = await response.text(); // because your endpoint returns plain text
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
};

const getConversationSummaries = async (userId) => {
  try {
    const response = await fetch(
      `${CONVERSATION_URL}/conversation-summaries?userId=${userId}`
    );
    return await response.json();
  } catch (err) {
    console.error("❌ Failed to fetch conversation summaries:", err);
    return [];
  }
};

export {
  searchPeople,
  getUserProfile,
  updateUserProfile,
  getUserReview,
  getAverageRating,
  isReviewLikedByUser,
  likeReview,
  unlikeReview,
  getLikeCount,
  getReviewsByAlbumIds,
  getProfileImageBase64,
  getConversationSummaries,
  getMessagesByConversationId,
};
