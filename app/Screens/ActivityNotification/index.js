import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function ActivityScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>No recent activity</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    color: "white",
    fontSize: 18,
  },
});
