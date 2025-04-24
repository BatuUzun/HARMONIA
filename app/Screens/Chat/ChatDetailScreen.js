import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import {
  getMessagesByConversationId,
  getProfileImageBase64,
} from "../../api/backend";
import styles from "./ChatDetailScreenStyles";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { socketUrl } from "../../constants/apiConstants";

export default function ChatDetailScreen() {
  const {
    conversationId,
    userId: rawUserId,
    opponentId,
    opponentUsername,
    opponentProfileImage,
  } = useLocalSearchParams();

  const router = useRouter();
  const userIdRef = useRef(rawUserId);
  const conversationIdRef = useRef(conversationId);
  const stompClientRef = useRef(null);
  const seenMessageIds = useRef(new Set());
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);

  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [opponentImageBase64, setOpponentImageBase64] = useState(null);
  const [typedMessage, setTypedMessage] = useState("");

  useEffect(() => {
    if (rawUserId) {
      userIdRef.current = rawUserId;
    }
  }, [rawUserId]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    const socket = new SockJS(`${socketUrl}?userId=${userIdRef.current}`);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        const destination = `/user/${userIdRef.current}/queue/messages`;
        stompClient.subscribe(destination, (message) => {
          const body = JSON.parse(message.body);

          if ("messageId" in body && Object.keys(body).length === 1) {
            // 🗑 Handle deletion
            setMessages((prev) => prev.filter((m) => m.id !== body.messageId));
            return;
          }

          const incomingId = String(body.conversationId);
          const expectedId = String(conversationIdRef.current);
          const isMine = String(body.senderId) === String(userIdRef.current);

          const isSameOpponent =
            !expectedId &&
            (String(body.senderId) === String(opponentId) ||
              String(body.receiverId) === String(opponentId));

          const isMatchingConversation =
            incomingId === expectedId || isSameOpponent;

          if (isMatchingConversation && !seenMessageIds.current.has(body.id)) {
            seenMessageIds.current.add(body.id);
            setMessages((prev) => [{ ...body }, ...prev]);

            if (!conversationIdRef.current && incomingId) {
              console.log(
                "🆕 Setting conversationIdRef from first message:",
                incomingId
              );
              conversationIdRef.current = incomingId;
            }
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
  }, [conversationId]);

  const fetchMessages = async (cursorValue = null) => {
    console.log("🟢 fetchMessages", { cursorValue, conversationId });

    if (!conversationId) return;
    if (loadingRef.current || !hasMoreRef.current) {
      console.log("⛔ Skipping fetch: loadingRef or hasMoreRef false");
      return;
    }

    loadingRef.current = true;
    setLoading(true);

    try {
      const data = await getMessagesByConversationId(
        conversationId,
        cursorValue
      );
      console.log("📦 messages fetched:", data.length);

      if (cursorValue === null) {
        seenMessageIds.current = new Set(data.map((msg) => msg.id));
        setMessages(data);
      } else {
        data.forEach((msg) => seenMessageIds.current.add(msg.id));
        setMessages((prev) => [...prev, ...data]);
      }

      if (data.length < 20) {
        console.log("🛑 Fetched less than 20 messages — no more pages");
        setHasMore(false);
        hasMoreRef.current = false;
        return;
      }

      const newCursor = data[data.length - 1].timestamp;
      setCursor(newCursor);
    } catch (err) {
      console.error("❌ Error fetching messages:", err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      console.log("📌 ChatDetailScreen focused - resetting state");

      setMessages([]);
      seenMessageIds.current.clear();
      setCursor(null);
      setHasMore(true);
      hasMoreRef.current = true;
      setInitialLoadDone(false);
      setLoading(false);
      loadingRef.current = false;

      const timeout = setTimeout(() => {
        fetchMessages(null);
      }, 0);

      return () => clearTimeout(timeout);
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

  const handleDeleteMessage = (messageId) => {
    stompClientRef.current.publish({
      destination: "/app/chat.delete",
      body: JSON.stringify(messageId),
    });
  };

  const renderMessage = ({ item }) => {
    const isMine = String(item.senderId) === String(userIdRef.current);

    const handleLongPress = () => {
      if (isMine) {
        Alert.alert("Delete Message", "Do you want to delete this message?", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => handleDeleteMessage(item.id),
          },
        ]);
      }
    };

    return (
      <TouchableOpacity onLongPress={handleLongPress}>
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
      </TouchableOpacity>
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

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 10,
          backgroundColor: "#1a1a1a",
        }}
      >
        <TextInput
          style={{
            flex: 1,
            height: 40,
            borderColor: "#444",
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            backgroundColor: "#fff",
            color: "#000",
          }}
          placeholder="Type a message..."
          placeholderTextColor="#888"
          value={typedMessage}
          onChangeText={setTypedMessage}
        />
        <TouchableOpacity
          disabled={typedMessage.trim() === ""}
          onPress={() => {
            if (typedMessage.trim() === "") return;

            const messagePayload = {
              senderId: parseInt(userIdRef.current),
              receiverId: parseInt(opponentId),
              conversationId: conversationId ? parseInt(conversationId) : null,
              content: typedMessage.trim(),
            };

            stompClientRef.current.publish({
              destination: "/app/chat.send",
              body: JSON.stringify(messagePayload),
            });

            setTypedMessage("");
          }}
          style={{
            marginLeft: 10,
            opacity: typedMessage.trim() === "" ? 0.3 : 1,
          }}
        >
          <Ionicons name="send" size={24} color="#00acee" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
