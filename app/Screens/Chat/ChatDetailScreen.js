import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import {
  getMessagesByConversationId,
  getProfileImageBase64,
} from "../../api/backend";
import styles from "./ChatDetailScreenStyles";

export default function ChatDetailScreen() {
  const {
    conversationId,
    userId: rawUserId,
    opponentUsername,
    opponentProfileImage,
  } = useLocalSearchParams();

  const router = useRouter();
  const userIdRef = useRef(rawUserId);
  const hasMoreRef = useRef(true);

  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [opponentImageBase64, setOpponentImageBase64] = useState(null);

  const fetchMessages = async (cursorValue = null) => {
    if (loading || !hasMoreRef.current) {
      console.log(
        "🚫 Skipping fetch — loading:",
        loading,
        "hasMore:",
        hasMoreRef.current
      );
      return;
    }

    setLoading(true);

    try {
      const data = await getMessagesByConversationId(
        conversationId,
        cursorValue
      );

      if (data.length === 0) {
        setHasMore(false);
        hasMoreRef.current = false;
      } else {
        setMessages((prev) => [...prev, ...data]);
        setCursor(data[data.length - 1].timestamp);
        setHasMore(true);
        hasMoreRef.current = true;
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setMessages([]);
      setCursor(null);
      setHasMore(true);
      hasMoreRef.current = true;
      setInitialLoadDone(false);
      setLoading(false);

      fetchMessages(null);
    }, [conversationId])
  );

  useEffect(() => {
    const loadImage = async () => {
      if (opponentProfileImage) {
        const base64 = await getProfileImageBase64(opponentProfileImage);
        setOpponentImageBase64(base64);
      }
    };
    loadImage();
  }, [opponentProfileImage]);

  const renderMessage = ({ item }) => {
    const isMine = String(item.senderId) == String(userIdRef.current);
    console.log(
      "🧾 DEBUG → senderId:",
      item.senderId,
      "userId:",
      userIdRef.current,
      "isMine:",
      isMine
    );

    return (
      <View style={isMine ? styles.messageRowRight : styles.messageRowLeft}>
        <View
          style={[
            styles.messageContainer,
            isMine ? styles.myMessage : styles.theirMessage,
          ]}
        >
          <Text style={styles.messageText}>{item.content}</Text>
          <Text style={styles.messageTime}>
            {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() =>
          router.replace("/Screens/Chat", { userId: userIdRef.current })
        }
        style={{ marginBottom: 10 }}
      >
        <Text style={{ color: "white", fontSize: 22 }}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        {opponentImageBase64 && (
          <Image
            source={{ uri: opponentImageBase64 }}
            style={styles.profileImage}
          />
        )}
        <Text style={styles.opponentUsername}>{opponentUsername}</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        inverted
        onEndReachedThreshold={0.1}
        onEndReached={() => {
          if (initialLoadDone && hasMoreRef.current && !loading) {
            fetchMessages(cursor);
          }
        }}
        ListFooterComponent={
          loading ? <ActivityIndicator size="small" color="#fff" /> : null
        }
      />
    </View>
  );
}
