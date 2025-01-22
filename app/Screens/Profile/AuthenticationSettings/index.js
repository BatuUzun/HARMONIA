import React, { useState, useEffect } from "react";
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
import { getUserProfile, updateUserProfile } from "../../../api/backend";
import * as ImagePicker from "expo-image-picker";

export default function AuthenticationSettings() {
  const router = useRouter();

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
        const data = await getUserProfile(1); // ID'si 1 olan kullanıcı
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
      await updateUserProfile(1, profile); // ID'si 1 olan kullanıcı

      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      console.error("Update Error:", error);
      Alert.alert("Error", "Failed to update profile");
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.header}>Profile Management</Text>
          </View>

          <View style={styles.formContainer}>
            {/* Profil Resmi */}
            <TouchableOpacity onPress={handleProfileImage}>
              {selectedImage ? (
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.profileImage}
                />
              ) : profile.profileImage ? (
                <Image
                  source={{ uri: profile.profileImage }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons
                    name="person-circle-outline"
                    size={100}
                    color="gray"
                  />
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
    padding: 20,
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
});
