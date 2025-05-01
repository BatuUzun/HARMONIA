// indexstyle.js
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  topContainer: {
    backgroundColor: "#1E1E1E",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E2E2E",
    borderRadius: 15,
    paddingHorizontal: 10,
    height: 40,
    flex: 1,
  },
  searchContainerFocused: {
    backgroundColor: "#444",
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "white",
    fontSize: 16,
    backgroundColor: "#2E2E2E",
    borderRadius: 8,
    paddingRight: 35,
  },
  clearButton: {
    position: "absolute",
    right: 10,
  },
  cancelButton: {
    marginLeft: 10,
  },
  cancelText: {
    color: "white",
    fontSize: 16,
  },
  optionsContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 10,
    marginBottom: 0,
  },
  option: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
  },
  selectedOption: {
    backgroundColor: "white",
  },
  optionText: {
    color: "gray",
    fontSize: 16,
  },
  selectedOptionText: {
    color: "black",
    fontWeight: "bold",
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: "black",
    paddingTop: 10,
  },
  resultsList: {
    paddingHorizontal: 20,
  },
  resultItem: {
    alignItems: "center",
    marginBottom: 20,
    flex: 1,
  },
  defaultResultItem: {
    flexDirection: "column",
  },
  resultDetails: {
    flex: 1,
    justifyContent: "space-between",
    flexDirection: "row",
    alignItems: "center",
  },
  peopleResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  image: {
    width: 150,
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
  },
  artistImage: {
    borderRadius: 100,
  },
  peopleImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 0,
  },
  resultText: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
    flexShrink: 1,
    marginLeft: 10,
  },
  recentSearchesContainer: {
    paddingHorizontal: 20,
  },
  recentSearchesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  recentSearchesTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  clearRecentSearchesText: {
    color: "white",
    fontSize: 14,
  },
  recentSearchItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  recentSearchText: {
    color: "white",
    fontSize: 14,
  },
  noRecentSearchesText: {
    color: "gray",
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },
  artistsContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  centerArtist: {
    alignItems: "center",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
    marginBottom: 20,
  },
  artistItem: {
    alignItems: "center",
    width: 100,
  },
  artistImageLarge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 0,
  },
  artistImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 5,
  },
  artistText: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
  },
  crownContainer: {
    position: "absolute",
    top: -30,
    zIndex: 1,
    alignSelf: "center",
  },
  crownIcon: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
});

export default styles;
