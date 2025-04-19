import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    padding: 20,
  },
  header: {
    fontSize: 24,
    color: "white",
    fontWeight: "bold",
    marginBottom: 10,
    alignSelf: "center",
  },
  userIdText: {
    color: "white",
    fontSize: 16,
    marginBottom: 20,
    alignSelf: "center",
  },
  input: {
    height: 40,
    borderColor: "#666",
    borderWidth: 1,
    borderRadius: 5,
    color: "white",
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  resultItem: {
    padding: 10,
    backgroundColor: "#333",
    marginVertical: 5,
    borderRadius: 5,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  resultText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  messageText: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 2,
  },
  timestampText: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  
});
