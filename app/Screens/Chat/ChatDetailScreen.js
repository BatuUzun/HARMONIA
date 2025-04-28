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
  Linking,
} from "react-native";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import {
  getMessagesByConversationId,
  getProfileImageBase64,
} from "../../api/backend";
import { getAccessToken, searchTracks } from "../../api/spotify";
import styles from "./ChatDetailScreenStyles";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { Modal, Platform } from "react-native";
import { WebView } from "react-native-webview";
import {
  socketUrl,
} from "../../constants/apiConstants";

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
  const searchCounter = useRef(0); // 🔥 Add a counter to track latest search
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState(null);

  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [opponentImageBase64, setOpponentImageBase64] = useState(null);
  const [typedMessage, setTypedMessage] = useState("");
  const [showSongSearch, setShowSongSearch] = useState(false);
  const [songQuery, setSongQuery] = useState("");
  const [songResults, setSongResults] = useState([]);
  const [sound, setSound] = useState(null);

  const extractSpotifyTrackId = (url) => {
    const match = url.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  const fetchPreviewFromDeezer = async (trackName, artistName) => {
    try {
      const query = encodeURIComponent(`${trackName} ${artistName}`);
      const response = await fetch(`https://api.deezer.com/search?q=${query}`);
      if (!response.ok) {
        console.log("❌ Deezer API failed:", response.status);
        return null;
      }
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        console.log("🎶 Deezer preview found:", data.data[0].preview);
        return data.data[0].preview;
      }
    } catch (error) {
      console.error("❌ Error fetching from Deezer:", error);
    }
    return null;
  };
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  const fetchTrackInfo = async (url) => {
    const trackId = extractSpotifyTrackId(url);
    if (!trackId) {
      console.log("❌ No valid Spotify track ID found in URL:", url);
      return null;
    }

    try {
      const token = await getAccessToken();
      const response = await fetch(
        `https://api.spotify.com/v1/tracks/${trackId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        console.log(
          `❌ Failed to fetch Spotify track info. Status: ${response.status}`
        );
        return null;
      }

      const data = await response.json();
      console.log("🎵 Spotify track fetched:", {
        name: data.name,
        previewUrl: data.preview_url,
      });

      let previewUrl = data.preview_url;
      if (!previewUrl) {
        console.log("⚠️ No Spotify preview, trying Deezer...");
        previewUrl = await fetchPreviewFromDeezer(
          data.name,
          data.artists?.[0]?.name || ""
        );
      }

      return {
        name: data.name,
        image: data.album.images?.[0]?.url,
        externalUrl: data.external_urls?.spotify,
        previewUrl: previewUrl,
      };
    } catch (error) {
      console.error("❌ Error fetching Spotify track:", error);
      return null;
    }
  };

  const enrichMessagesWithTrackInfo = async (msgs) => {
    const enriched = await Promise.all(
      msgs.map(async (msg) => {
        if (msg.content.includes("open.spotify.com/track/")) {
          const trackInfo = await fetchTrackInfo(msg.content);
          return { ...msg, trackInfo };
        }
        return msg;
      })
    );
    return enriched;
  };
  const [playingUrl, setPlayingUrl] = useState(null);

  const playPreview = async (url) => {
    try {
      if (Platform.OS === "ios" && url.includes("dzcdn.net")) {
        // 🧠 On iOS + Deezer → use WebView
        setWebViewUrl(url);
        setWebViewVisible(true);
        return;
      }

      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      if (url === playingUrl) {
        setPlayingUrl(null);
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync({ uri: url });
      setSound(newSound);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          console.log("✅ Preview finished!");
          setPlayingUrl(null);
          newSound.unloadAsync();
        }
      });

      await newSound.playAsync();
      console.log("Preview URL to play:", url);

      setPlayingUrl(url);
    } catch (err) {
      console.log("Audio play error", err);
    }
  };

  // 🛑 Stop music when unmounting the screen
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // 🛑 Also stop music when unfocusing (navigating away)
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (sound) {
          sound.unloadAsync();
        }
      };
    }, [sound])
  );

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
        stompClient.subscribe(destination, async (message) => {
          const body = JSON.parse(message.body);

          if ("messageId" in body && Object.keys(body).length === 1) {
            setMessages((prev) => prev.filter((m) => m.id !== body.messageId));
            return;
          }

          const incomingId = String(body.conversationId);
          const expectedId = String(conversationIdRef.current);

          const isSameOpponent =
            !expectedId &&
            (String(body.senderId) === String(opponentId) ||
              String(body.receiverId) === String(opponentId));

          const isMatchingConversation =
            incomingId === expectedId || isSameOpponent;

          if (isMatchingConversation && !seenMessageIds.current.has(body.id)) {
            seenMessageIds.current.add(body.id);
            const enrichedMsg = await enrichMessagesWithTrackInfo([body]);
            setMessages((prev) => [...enrichedMsg, ...prev]);

            if (!conversationIdRef.current && incomingId) {
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
    if (!conversationId) return;
    if (loadingRef.current || !hasMoreRef.current) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      const data = await getMessagesByConversationId(
        conversationId,
        cursorValue
      );
      const enriched = await enrichMessagesWithTrackInfo(data);

      if (cursorValue === null) {
        seenMessageIds.current = new Set(data.map((msg) => msg.id));
        setMessages(enriched);
      } else {
        data.forEach((msg) => seenMessageIds.current.add(msg.id));
        setMessages((prev) => [...prev, ...enriched]);
      }

      if (data.length < 20) {
        setHasMore(false);
        hasMoreRef.current = false;
      }

      const newCursor = data[data.length - 1]?.timestamp;
      setCursor(newCursor);
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
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

  const handleSendMessage = () => {
    if (typedMessage.trim() === "") return;

    const messagePayload = {
      senderId: parseInt(userIdRef.current),
      receiverId: parseInt(opponentId),
      conversationId: conversationIdRef.current
        ? parseInt(conversationIdRef.current)
        : null,
      content: typedMessage.trim(),
    };

    stompClientRef.current.publish({
      destination: "/app/chat.send",
      body: JSON.stringify(messagePayload),
    });

    setTypedMessage("");
  };

  const handleSearchSongs = async (query) => {
    if (!query) {
      setSongResults([]); // ✅ Extra safety
      return;
    }
    try {
      const token = await getAccessToken();
      const results = await searchTracks(token, query);
      setSongResults(results);
    } catch (err) {
      console.error("Error searching songs:", err);
      setSongResults([]); // 🔥 In case of error, clear results too
    }
  };

  const handleSelectSong = (song) => {
    const spotifyUrl = song.external_urls?.spotify;
    if (spotifyUrl) {
      setTypedMessage(spotifyUrl);
    } else {
      setTypedMessage(`${song.name} - ${song.artists[0]?.name}`);
    }
    setShowSongSearch(false);
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
            {item.trackInfo ? (
              <View style={{ alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(item.trackInfo.externalUrl)}
                >
                  <Image
                    source={{ uri: item.trackInfo.image }}
                    style={{
                      width: 150,
                      height: 150,
                      borderRadius: 8,
                      marginBottom: 5,
                    }}
                  />
                  <Text
                    style={{
                      color: "white",
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    {item.trackInfo.name}
                  </Text>
                </TouchableOpacity>

                {item.trackInfo.previewUrl && (
                  <TouchableOpacity
                    onPress={() => playPreview(item.trackInfo.previewUrl)}
                    style={{
                      marginTop: 10,
                      backgroundColor: "#00acee",
                      paddingVertical: 8,
                      paddingHorizontal: 25,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontWeight: "bold",
                        fontSize: 16,
                      }}
                    >
                      {playingUrl === item.trackInfo.previewUrl
                        ? "⏹️ Stop Preview"
                        : "▶️ Play Preview"}{" "}
                      {/* 🔥 Text depends on THIS track */}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={styles.messageText}>{item.content}</Text>
            )}
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
        <TouchableOpacity
          onPress={() => setShowSongSearch(true)}
          style={{ marginRight: 10 }}
        >
          <Ionicons name="add" size={28} color="#00acee" />
        </TouchableOpacity>

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
          onPress={handleSendMessage}
          style={{
            marginLeft: 10,
            opacity: typedMessage.trim() === "" ? 0.3 : 1,
          }}
        >
          <Ionicons name="send" size={24} color="#00acee" />
        </TouchableOpacity>
      </View>

      {showSongSearch && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.9)",
            padding: 20,
          }}
        >
          <TextInput
            style={{
              height: 40,
              borderColor: "#ccc",
              borderWidth: 1,
              borderRadius: 8,
              marginBottom: 20,
              paddingHorizontal: 10,
              backgroundColor: "#fff",
              color: "#000",
            }}
            placeholder="Search for a song..."
            placeholderTextColor="#888"
            value={songQuery}
            onChangeText={async (text) => {
              setSongQuery(text);

              const trimmed = text.trim();
              searchCounter.current += 1; // 🧠 Update counter for every change
              const currentSearch = searchCounter.current;

              if (trimmed.length === 0) {
                setSongResults([]); // Clear immediately
              } else {
                try {
                  const token = await getAccessToken();
                  const results = await searchTracks(token, trimmed);

                  // 🔥 Only update results if it's the latest search
                  if (currentSearch === searchCounter.current) {
                    setSongResults(results);
                  } else {
                    console.log(
                      "⏩ Ignored outdated search result for:",
                      trimmed
                    );
                  }
                } catch (err) {
                  console.error("Error searching songs:", err);
                  if (currentSearch === searchCounter.current) {
                    setSongResults([]); // only clear if this is the latest search
                  }
                }
              }
            }}
          />

          <FlatList
            data={songResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelectSong(item)}
                style={{
                  padding: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: "#555",
                }}
              >
                <Text style={{ color: "white" }}>
                  {item.name} - {item.artists[0]?.name}
                </Text>
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity
            onPress={() => setShowSongSearch(false)}
            style={{
              marginTop: 20,
              alignSelf: "center",
            }}
          >
            <Text style={{ color: "#00acee", fontSize: 18 }}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
      <Modal
        visible={webViewVisible}
        animationType="slide"
        onRequestClose={() => setWebViewVisible(false)}
        transparent={false}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {webViewUrl && (
            <WebView
              source={{
                html: `
            <html>
              <body style="background-color: black; display: flex; justify-content: center; align-items: center; height: 100%;">
                <audio controls autoplay style="width: 90%;">
                  <source src="${webViewUrl}" type="audio/mpeg">
                  Your browser does not support the audio element.
                </audio>
              </body>
            </html>
          `,
              }}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
            />
          )}

          <TouchableOpacity
            onPress={() => setWebViewVisible(false)}
            style={{
              position: "absolute",
              top: 40,
              right: 20,
              backgroundColor: "#00acee",
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
