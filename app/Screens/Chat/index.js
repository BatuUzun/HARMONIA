import React, { useState, useEffect, useCallback, useRef } from "react";
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
import styles from "./indexcss";
import { Client } from '@stomp/stompjs'; // ✅ WebSocket Client
import SockJS from 'sockjs-client';     // ✅ SockJS for fallback support

export default function ChatScreen() {
  const { userId } = useLocalSearchParams();
  const [username, setUsername] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [conversationSummaries, setConversationSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [profileImages, setProfileImages] = useState({});
  const router = useRouter();
  const stompClientRef = useRef(null);
  const socketUrl = "http://192.168.1.105:8765/ws-chat";
  const userIdRef = useRef(null);

  // ✅ Connect to WebSocket and listen for new messages
  useEffect(() => {
    if (!userId) return;

    const socket = new SockJS(`${socketUrl}?userId=${userId}`);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("✅ Connected to WebSocket");

        const destination = `/user/${userId}/queue/messages`;
        console.log("🔔 Subscribing to:", destination);

        stompClient.subscribe(destination, (message) => {
          console.log("📨 Real-time message on ChatScreen:", message);

          try {
            const body = JSON.parse(message.body);
            console.log("📩 Parsed body:", body);
            fetchSummaries(); // ✅ Refresh summaries
          } catch (e) {
            console.error("❌ Failed to parse message:", e);
          }
        });

        stompClientRef.current = stompClient;
      },
      onStompError: (frame) => {
        console.error("STOMP error:", frame);
      },
    });

    stompClient.activate();

    return () => {
      stompClient.deactivate();
    };
  }, [userId]);

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
  useEffect(() => {
    if (userId) {
      userIdRef.current = userId;
    }
  }, [userId]);
  
  useFocusEffect(
    useCallback(() => {
      console.log("🧩 ChatScreen Focused — userId:", userIdRef.current);
      setUsername("");
      setSearchResults([]);
      let stompClient;
  
      const connectWebSocket = () => {
        const socket = new SockJS(`${socketUrl}?userId=${userIdRef.current}`);
        stompClient = new Client({
          webSocketFactory: () => socket,
          reconnectDelay: 5000,
          onConnect: () => {
            console.log("✅ WebSocket connected");
  
            const destination = `/user/${userIdRef.current}/queue/messages`;
            console.log("🔔 Subscribing to:", destination);
  
            stompClient.subscribe(destination, (message) => {
              console.log("📨 Real-time message received:", message);
  
              try {
                const body = JSON.parse(message.body);
                console.log("📩 Parsed message body:", body);
                fetchSummaries();
              } catch (e) {
                console.error("❌ Failed to parse WebSocket message:", e);
              }
            });
  
            stompClientRef.current = stompClient;
          },
          onStompError: (frame) => {
            console.error("❌ STOMP error:", frame);
          },
        });
  
        stompClient.activate();
      };
  
      if (userIdRef.current) {
        fetchSummaries();
        connectWebSocket();
      }
  
      return () => {
        if (stompClientRef.current?.connected) {
          console.log("🔌 Disconnecting WebSocket...");
          stompClientRef.current.deactivate();
        }
      };
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
      
      const chattedUserIds = new Set(conversationSummaries.map(cs => cs.opponentId));
      const filtered = results.filter(item =>
        item.id != userId && !chattedUserIds.has(item.id)
      );
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
        placeholder="Create chat with someone..."
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
                    opponentId: item.opponentId,
                    opponentUsername: item.opponentUsername,
                    opponentProfileImage: item.opponentProfileImage,
                    key: `${item.conversationId}-${Date.now()}`,
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
                  {item.lastMessage && item.timestamp && (
  <Text style={styles.timestampText}>
    {new Date(item.timestamp).toLocaleString()}
  </Text>
)}

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
            <TouchableOpacity
              style={styles.resultItem}
              onPress={() =>
                router.push({
                  pathname: "/Screens/Chat/ChatDetailScreen",
                  params: {
                    conversationId: "", // pass empty string or don't include it
                    userId: userIdRef.current || userId,
                    opponentId: item.id,
                    opponentUsername: item.username,
                    opponentProfileImage: item.profileImage,
                    key: `${item.conversationId}-${Date.now()}`,
                    
                  },
                })
              }
              
            >
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
