import React, { useState } from "react";
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
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "expo-router";

export default function AuthenticationSettings() {
  const router = useRouter();

  const [profile, setProfile] = useState({
    name: "",
    familyName: "",
    email: "",
    location: "",
    pronoun: "",
    bio: "",
    spotifyLink: "",
  });

  const handleSaveProfile = () => {
    const { name, familyName, email } = profile;

    // Basic validation
    if (!name || !familyName || !email) {
      Alert.alert("Error", "Name, Family Name, and Email are required.");
      return;
    }

    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    Alert.alert("Profile Saved", "Your profile has been updated.");
  };

  const handleSpotifyLink = () => {
    Alert.alert(
      "Spotify Integration",
      "This will link your Spotify account to your profile.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Link",
          onPress: () => setProfile({ ...profile, spotifyLink: "Linked" }),
        },
      ]
    );
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

          {/* Profile Form */}
          <View style={styles.formContainer}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={profile.name}
              placeholder="Enter your name"
              onChangeText={(text) => setProfile({ ...profile, name: text })}
            />

            <Text style={styles.label}>Family Name</Text>
            <TextInput
              style={styles.input}
              value={profile.familyName}
              placeholder="Enter your family name"
              onChangeText={(text) =>
                setProfile({ ...profile, familyName: text })
              }
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={profile.email}
              placeholder="Enter your email"
              keyboardType="email-address"
              onChangeText={(text) => setProfile({ ...profile, email: text })}
            />

            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={profile.location}
              placeholder="Enter your location"
              onChangeText={(text) => setProfile({ ...profile, location: text })}
            />

            <Text style={styles.label}>Pronoun</Text>
            <TextInput
              style={styles.input}
              value={profile.pronoun}
              placeholder="Enter your pronoun (e.g., He/Him)"
              onChangeText={(text) => setProfile({ ...profile, pronoun: text })}
            />

            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profile.bio}
              placeholder="Write something about yourself"
              multiline
              onChangeText={(text) => setProfile({ ...profile, bio: text })}
            />
          </View>

          {/* Spotify Link Button */}
          <TouchableOpacity
            style={styles.spotifyButton}
            onPress={handleSpotifyLink}
          >
            <Ionicons name="checkmark-circle" size={24} color="white" />
            <Text style={styles.spotifyButtonText}>
              {profile.spotifyLink ? "Spotify Linked" : "Link Spotify"}
            </Text>
          </TouchableOpacity>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveProfile}
          >
            <Text style={styles.saveButtonText}>Save Updates</Text>
          </TouchableOpacity>
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
  spotifyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1DB954",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  spotifyButtonText: {
    color: "white",
    fontSize: 16,
    marginLeft: 10,
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
});
