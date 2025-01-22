import axios from "axios";

const API_GATEWAY_URL = "http://192.168.0.27:8765";

const searchPeople = async (username) => {
  try {
    const response = await axios.post(
      `${API_GATEWAY_URL}/search-profile/search`,
      null,
      {
        params: { username },
      }
    );
    console.log("✅ API Response:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "❌ People Search Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Kullanıcı profilini getir
const getUserProfile = async (id) => {
  try {
    const response = await axios.get(
      `${API_GATEWAY_URL}/profile-api/get-user-profile/${id}`
    );
    console.log("✅ Fetch User Profile Response:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Fetch User Profile Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Kullanıcı profilini güncelle
const updateUserProfile = async (id, profileData) => {
  try {
    const response = await axios.put(
      `${API_GATEWAY_URL}/profile-api/update-profile/${id}`,
      profileData
    );
    console.log("✅ Update User Profile Response:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Update User Profile Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export {
  searchPeople,
  getUserProfile,
  updateUserProfile,
};
