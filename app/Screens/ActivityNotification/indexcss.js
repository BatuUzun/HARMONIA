import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#000",
    flexGrow: 1,
  },
  text: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
  },
  username: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#fff",
  },
  description: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#ccc",
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: "#888",
    marginTop: 6,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#444",
  },
  albumCover: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginTop: 8,
    borderColor: "#555",
    borderWidth: 1,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  activityContent: {
    flex: 1,
  },
});
