import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function ChatScreen() {
  const { userId } = useLocalSearchParams();
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Chat Screen</Text>
      <Text style={styles.userIdText}>User ID: {userId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    padding: 20,
  },
  header: {
    fontSize: 24,
    color: "white",
    fontWeight: "bold",
    marginBottom: 10,
  },
  userIdText: {
    color: "white",
    fontSize: 16,
    marginTop: 10,
  },
});
