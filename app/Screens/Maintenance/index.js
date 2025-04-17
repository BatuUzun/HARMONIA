import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";

export default function MaintenanceScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image
        source={require("../../../assets/images/luci-black-maintenance-2.png")}
        style={styles.image}
      />
      <Text style={styles.title}>Harmonia is Currently Under Maintenance</Text>
      <Text style={styles.subtitle}>We should be back shortly.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 0,
  },
  image: {
    width: 250,
    height: 250,
    resizeMode: "contain",
    marginBottom: -20,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  subtitle: {
    color: "gray",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 75,
  },
});
