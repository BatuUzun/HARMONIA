import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { getUserProfile, updateUserProfile } from "../../api/backend";
import * as ImagePicker from "expo-image-picker";
import { AuthContext } from "../../context/AuthContext";

export default function AuthenticationSettings() {
  const router = useRouter();
  const { userId, logout } = useContext(AuthContext); // Get userId from AuthContext
  const defaultProfileImage = require("../../../assets/images/default-profile-photo.webp"); // Varsayılan profil fotoğrafı

  // Kullanıcı profili durumu
  const [profile, setProfile] = useState({
    username: "",
    description: "",
    bio: "",
    link: "",
    location: "",
    profileImage: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  // Kullanıcı profilini çek
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getUserProfile(userId);
        setProfile({
          username: data.username || "",
          description: data.description || "",
          bio: data.bio || "",
          link: data.link || "",
          location: data.location || "",
          profileImage: data.profileImage || "",
        });
      } catch (error) {
        Alert.alert("Error", "Failed to fetch profile data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Kamera ve Galeri izinleri
  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    const { status: galleryStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || galleryStatus !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera and gallery access is required to upload a profile picture."
      );
      return false;
    }
    return true;
  };

  // Profil resmi seçme veya çekme
  const handleProfileImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    Alert.alert(
      "Profile Picture",
      "Choose an option",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: handleTakePhoto },
        { text: "Choose from Library", onPress: handleChooseFromLibrary },
      ],
      { cancelable: true }
    );
  };

  const handleTakePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfile((prev) => ({ ...prev, profileImage: result.assets[0].uri }));
    }
  };

  const handleChooseFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfile((prev) => ({ ...prev, profileImage: result.assets[0].uri }));
    }
  };

  // Profil bilgilerini ve fotoğrafı kaydet
  const handleSaveProfile = async () => {
    try {
      // Seçilen fotoğrafın URI'sini doğrudan profile.profileImage'e ata
      if (selectedImage) {
        setProfile((prev) => ({ ...prev, profileImage: selectedImage.uri }));
      }

      // Profil bilgileri güncellemesi
      await updateUserProfile(userId, profile);

      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Update Error:", error);
      }
      Alert.alert("Error", "Failed to update profile");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          onPress: () => {
            logout(); // Clear token and update authentication state
            router.replace("/Screens/Auth"); // Navigate to login screen
          },
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 50, paddingHorizontal: 20 }} // İçerikleri kenarlardan ayırır.
          showsVerticalScrollIndicator={true}
          scrollIndicatorInsets={{ right: 0 }} // Scrollbar'ı sağa yapıştırır.
          style={{ flex: 1, width: "100%" }}
        >
          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={() => router.push("/Screens/Profile/Profile")}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            {/* Profil Resmi */}
            <TouchableOpacity onPress={handleProfileImage}>
              {selectedImage ? (
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.profileImage}
                />
              ) : profile.profileImage &&
                profile.profileImage !== "default.png" ? (
                <Image
                  source={{ uri: profile.profileImage }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={{ position: "relative" }}>
                  <Image
                    source={require("../../../assets/images/default-profile-photo.webp")}
                    style={styles.profileImage}
                  />
                  <View style={styles.speechBubble}>
                    <Text style={styles.speechBubbleText}>
                      Click me to change your profile photo!
                    </Text>
                    <View style={styles.speechBubbleTriangle} />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Username */}
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={profile.username}
              placeholder="Enter your username"
              onChangeText={(text) =>
                setProfile({ ...profile, username: text })
              }
            />

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={profile.description}
              placeholder="Enter your description"
              onChangeText={(text) =>
                setProfile({ ...profile, description: text })
              }
            />

            {/* Bio */}
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profile.bio}
              placeholder="Write something about yourself"
              multiline
              onChangeText={(text) => setProfile({ ...profile, bio: text })}
            />

            {/* Link */}
            <Text style={styles.label}>Link</Text>
            <TextInput
              style={styles.input}
              value={profile.link}
              placeholder="Enter your link"
              onChangeText={(text) => setProfile({ ...profile, link: text })}
            />

            {/* Location */}
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={profile.location}
              placeholder="Enter your location"
              onChangeText={(text) =>
                setProfile({ ...profile, location: text })
              }
            />

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveProfile}
            >
              <Text style={styles.saveButtonText}>Save Updates</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    paddingTop: 70,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginLeft: 10,
  },
  loadingText: {
    textAlign: "center",
    fontSize: 18,
    color: "white",
    marginTop: 50,
  },
  formContainer: {
    marginBottom: 20,
  },
  label: {
    color: "white",
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    backgroundColor: "#2E2E2E",
    color: "white",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#1DB954",
    padding: 15,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 8,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: "center",
    marginBottom: 20,
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: "#FF3B30",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  logoutButtonText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: "center",
    marginBottom: 20,
  },
  speechBubble: {
    position: "absolute",
    top: 0,
    right: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 8,
    borderColor: "#14853c",
    borderWidth: 2,
    maxWidth: 140,
    zIndex: 1,
    alignItems: "center",
  },
  speechBubbleText: {
    color: "black",
    fontSize: 12,
    textAlign: "center",
  },
  speechBubbleTriangle: {
    position: "absolute",
    bottom: -0,
    left: "0%",
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderStyle: "solid",
    backgroundColor: "transparent",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderColor: "#14853c",
  },
});
