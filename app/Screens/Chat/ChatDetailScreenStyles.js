import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    padding: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  opponentUsername: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  messageList: {
    flexGrow: 1,
  },
  messageContainer: {
    maxWidth: "70%",
    padding: 10,
    borderRadius: 10,
    marginVertical: 4,
  },
  myMessage: {
    backgroundColor: "#007aff",
    alignSelf: "flex-end",
  },
  theirMessage: {
    backgroundColor: "#333",
    alignSelf: "flex-start",
  },
  messageText: {
    color: "white",
  },
  messageTime: {
    fontSize: 10,
    color: "#ccc",
    marginTop: 5,
    alignSelf: "flex-end",
  },
  messageRowLeft: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  messageRowRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  messageRowRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  messageRowLeft: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
});
