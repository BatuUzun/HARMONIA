import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  searchPeople,
  getProfileImageBase64,
  getConversationSummaries,
} from "../../api/backend";
import styles from "./indexcss"; // external CSS-in-JS

export default function ChatScreen() {
  const { userId } = useLocalSearchParams();
  const [username, setUsername] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [conversationSummaries, setConversationSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [profileImages, setProfileImages] = useState({});
  const router = useRouter();

  useEffect(() => {
    if (username.trim() !== "") return;

    const refreshImages = async () => {
      const imageMap = {};
      await Promise.all(
        conversationSummaries.map(async (user) => {
          const base64 = await getProfileImageBase64(user.opponentProfileImage);
          if (base64) {
            imageMap[user.opponentId] = base64;
          }
        })
      );
      setProfileImages(imageMap);
    };

    refreshImages();
  }, [username]);

  useFocusEffect(
    useCallback(() => {
      fetchSummaries();
    }, [])
  );

  const fetchSummaries = async () => {
    setLoading(true);
    try {
      const result = await getConversationSummaries(userId);
      setConversationSummaries(result);

      const imageMap = {};
      await Promise.all(
        result.map(async (user) => {
          const base64 = await getProfileImageBase64(user.opponentProfileImage);
          if (base64) {
            imageMap[user.opponentId] = base64;
          }
        })
      );
      setProfileImages(imageMap);
    } catch (err) {
      console.error("❌ Error fetching conversation summaries", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (username.trim() === "") {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const delayDebounce = setTimeout(() => {
      handleSearch();
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [username]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const results = await searchPeople(username);
      const filtered = results.filter((item) => item.id != userId);
      setSearchResults(filtered);

      const imageMap = {};
      await Promise.all(
        filtered.map(async (user) => {
          const base64 = await getProfileImageBase64(user.profileImage);
          if (base64) {
            imageMap[user.id] = base64;
          }
        })
      );
      setProfileImages(imageMap);
    } catch (error) {
      console.error("Search failed:", error);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {/* Go Back Button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ marginBottom: 10 }}
      >
        <Text style={{ color: "white", fontSize: 16 }}>← Go Back</Text>
      </TouchableOpacity>

      <Text style={styles.header}>Chat Screen</Text>
      <Text style={styles.userIdText}>User ID: {userId}</Text>

      <TextInput
        style={styles.input}
        placeholder="Search by username"
        placeholderTextColor="#999"
        value={username}
        onChangeText={setUsername}
      />

      {username.trim() === "" ? (
        <FlatList
          data={conversationSummaries}
          keyExtractor={(item, index) =>
            item.conversationId?.toString() || index.toString()
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultItem}
              onPress={() =>
                router.push({
                  pathname: "/Screens/Chat/ChatDetailScreen",
                  params: {
                    conversationId: item.conversationId,
                    userId: userId,
                    opponentUsername: item.opponentUsername,
                    opponentProfileImage: item.opponentProfileImage,
                  },
                })
              }
            >
              <View style={styles.resultRow}>
                {profileImages[item.opponentId] && (
                  <Image
                    source={{ uri: profileImages[item.opponentId] }}
                    style={styles.profileImage}
                  />
                )}
                <View>
                  <Text style={styles.resultText}>{item.opponentUsername}</Text>
                  <Text style={styles.messageText}>{item.lastMessage}</Text>
                  <Text style={styles.timestampText}>
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item, index) => (item?.id || index).toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.resultItem}>
              <View style={styles.resultRow}>
                {profileImages[item.id] && (
                  <Image
                    source={{ uri: profileImages[item.id] }}
                    style={styles.profileImage}
                  />
                )}
                <Text style={styles.resultText}>{item.username}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() =>
            !loading &&
            !isSearching &&
            username.trim() !== "" &&
            searchResults.length === 0 ? (
              <Text
                style={{ color: "white", marginTop: 10, textAlign: "center" }}
              >
                No users found
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}
