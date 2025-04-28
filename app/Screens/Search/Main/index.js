import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Keyboard,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack"; // Import Stack Navigator
import {
  getAccessToken,
  searchArtists,
  searchAlbums,
  getTopArtistsByPopularity,
} from "../../../api/spotify";
import { searchPeople } from "../../../api/backend";
import ArtistProfile from "../../Profile/ArtistProfile/index";
import { IS_DEVELOPMENT } from "../../../constants/apiConstants";
import { BACKEND_PROFILE_PICTURE_DOWNLOADER_URL } from "../../../constants/apiConstants";

// Create a Stack Navigator for the SearchScreen
const Stack = createStackNavigator();
const defaultProfileImage = require("../../../../assets/images/default-profile-photo.webp");

const getProfileImageUrl = (fileName) => {
  if (!fileName || fileName === "default.png") {
    return Image.resolveAssetSource(defaultProfileImage).uri;
  }
  return `https://harmonia-profile-images.s3.amazonaws.com/${fileName}`; // veya BACKEND_PROFILE_PICTURE_DOWNLOADER_URL
};

// Wrap the SearchScreen in a Stack Navigator
export default function SearchStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchMain" component={SearchScreen} />
      <Stack.Screen name="ArtistProfile" component={ArtistProfile} />
    </Stack.Navigator>
  );
}

// Main SearchScreen component
function SearchScreen() {
  const navigation = useNavigation();
  const [isFocused, setIsFocused] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedOption, setSelectedOption] = useState("Artists");
  const [searchResults, setSearchResults] = useState([]);
  const [accessToken, setAccessToken] = useState(null);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const defaultProfileImage = require("../../../../assets/images/default-profile-photo.webp");
  const options = ["Artists", "Albums", "People"];

  useEffect(() => {
    const fetchTokenAndTopArtists = async () => {
      try {
        const token = await getAccessToken();
        setAccessToken(token);
        const allArtists = await getTopArtistsByPopularity(token);

        if (IS_DEVELOPMENT) {
          console.log("Access Token Fetched:", token);
          console.log("Top Artists Fetched:", allArtists);
        }

        setTopArtists(allArtists.slice(0, 5));
      } catch (error) {
        if (IS_DEVELOPMENT) {
          console.error("Error fetching access token or top artists:", error);
        }
      }
    };

    fetchTokenAndTopArtists();
  }, []);

  useEffect(() => {
    if (selectedOption === "Albums" || selectedOption === "People") {
      loadRecentSearches();
    }
  }, [selectedOption]);

  const handleCancel = () => {
    setSearchText("");
    setIsFocused(false);
    Keyboard.dismiss();
    setSearchResults([]);
    setOffset(0);
  };

  const handleOptionSelect = async (option) => {
    setSelectedOption(option);
    setSearchResults([]); // Clear previous results
    setOffset(0);

    // If there is search text, perform the search immediately
    if (searchText.trim()) {
      setIsLoading(true); // Set loading state
      try {
        await fetchResults(searchText); // Fetch results for the new option
      } catch (error) {
        if (IS_DEVELOPMENT) {
          console.error("Error fetching results:", error);
        }
      } finally {
        setIsLoading(false); // Reset loading state
      }
    }
  };

  const fetchResults = async (text, loadMore = false) => {
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      let results = [];

      if (selectedOption === "Artists") {
        results = await searchArtists(accessToken, text, offset);
      } else if (selectedOption === "Albums") {
        results = await searchAlbums(accessToken, text, offset);
      } else if (selectedOption === "People") {
        const peopleResults = await searchPeople(text);
        const getProfileImageUrl = (fileName) => {
          if (!fileName || fileName === "default.png") {
            return Image.resolveAssetSource(defaultProfileImage).uri;
          }
          return `${BACKEND_PROFILE_PICTURE_DOWNLOADER_URL}/s3/download/${fileName}`;
        };

        results = peopleResults.map((person) => {
          const imageUrl = person.profileImage;
          const finalImageUrl = getProfileImageUrl(imageUrl);

          return {
            id: person.id,
            name: person.username,
            images: [{ url: finalImageUrl }],
          };
        });
      }

      setSearchResults(loadMore ? [...searchResults, ...results] : results);

      if (!loadMore && selectedOption === "People") {
        await saveSearchQuery(text);
      }
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Search Error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (text) => {
    setSearchText(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    setOffset(0);
    fetchResults(text);
  };

  const loadMoreResults = () => {
    if (!isLoading && searchText.trim()) {
      setOffset((prev) => prev + 10);
    }
  };

  const saveSearchQuery = async (query) => {
    if (!query.trim()) return;
    try {
      const historyKey = `searchHistory_${selectedOption}`;
      let history = await AsyncStorage.getItem(historyKey);
      history = history ? JSON.parse(history) : [];
      history = history.filter((item) => item !== query);
      history.unshift(query);
      if (history.length > 10) history.pop();
      setTimeout(async () => {
        await AsyncStorage.setItem(historyKey, JSON.stringify(history));
        setRecentSearches(history);
      }, 3000);
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Failed to save search history:", error);
      }
    }
  };

  const loadRecentSearches = async () => {
    try {
      const historyKey = `searchHistory_${selectedOption}`;
      const history = await AsyncStorage.getItem(historyKey);
      setRecentSearches(history ? JSON.parse(history) : []);
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Failed to load search history:", error);
      }
    }
  };

  const deleteSearchQuery = async (query) => {
    try {
      const historyKey = `searchHistory_${selectedOption}`;
      let history = await AsyncStorage.getItem(historyKey);
      history = history ? JSON.parse(history) : [];

      history = history.filter((item) => item !== query);

      await AsyncStorage.setItem(historyKey, JSON.stringify(history));
      setRecentSearches(history);
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Failed to delete search history item:", error);
      }
    }
  };

  const clearRecentSearches = async () => {
    try {
      const historyKey = `searchHistory_${selectedOption}`;
      await AsyncStorage.removeItem(historyKey);
      setRecentSearches([]);
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Failed to clear search history:", error);
      }
    }
  };

  const handleRecentSearchClick = (query) => {
    setSearchText(query);
    handleSearch(query);
  };

  const handleReset = () => {
    setSearchText("");
    setSearchResults([]);
    setIsFocused(false);
    setOffset(0);
    setSelectedOption("Artists");
  };

  const handleAlbumClick = (album) => {
    saveSearchQuery(album.name);
    navigation.navigate("Screens/Review/Entry/index", {
      selectedAlbum: JSON.stringify(album),
      isUpdateFlow: false,
    });
    handleReset();
  };

  const handleUserClick = (user) => {
    navigation.navigate("Screens/Profile/Profile/index", { userId: user.id });
    handleReset();
  };

  const handleArtistClick = (artist) => {
    if (IS_DEVELOPMENT) {
      console.log("Artist Data:", artist); // Log the artist object
      console.log("Artist ID:", artist.id); // Log the artist ID
      console.log("Artist Name:", artist.name); // Log the artist name
      console.log("Artist Image:", artist.images?.[0]?.url); // Log the artist image URL
    }
    navigation.navigate("ArtistProfile", {
      artistId: artist.id,
      artistName: artist.name,
      artistImage: artist.images?.[0]?.url || null,
    });
    handleReset();
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <View style={styles.topContainer}>
          <View style={styles.searchWrapper}>
            <View
              style={[
                styles.searchContainer,
                isFocused && styles.searchContainerFocused,
              ]}
            >
              <Ionicons
                name="search-outline"
                size={24}
                color={isFocused ? "white" : "gray"}
                style={styles.icon}
              />
              <TextInput
                style={[
                  styles.input,
                  isFocused && { color: "white", backgroundColor: "#444" },
                ]}
                placeholder="Find artists, albums, people..."
                placeholderTextColor="gray"
                value={searchText}
                onFocus={() => setIsFocused(true)}
                onBlur={() => !searchText && setIsFocused(false)}
                onChangeText={(text) => {
                  setSearchText(text);
                  handleSearch(text);
                }}
                returnKeyType="search"
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchText("")}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-outline" size={24} color="gray" />
                </TouchableOpacity>
              )}
            </View>

            {isFocused && (
              <TouchableOpacity
                onPress={handleCancel}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.optionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.option,
                  selectedOption === option && styles.selectedOption,
                ]}
                onPress={() => handleOptionSelect(option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedOption === option && styles.selectedOptionText,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.resultsContainer}>
          {searchText.length === 0 && selectedOption === "Artists" && (
            <View style={styles.artistsContainer}>
              {topArtists.length === 5 && (
                <>
                  <View style={styles.centerArtist}>
                    <TouchableOpacity
                      style={styles.artistItem}
                      onPress={() => handleArtistClick(topArtists[0])}
                    >
                      <View style={styles.crownContainer}>
                        <MaterialCommunityIcons
                          name="crown"
                          size={35}
                          color="#FFD700"
                          style={styles.crownIcon}
                        />
                      </View>
                      <Image
                        source={{ uri: topArtists[0].images[0]?.url }}
                        style={styles.artistImageLarge}
                      />
                      <Text style={styles.artistText}>
                        {topArtists[0].name}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.artistItem}
                      onPress={() => handleArtistClick(topArtists[1])}
                    >
                      <Image
                        source={{ uri: topArtists[1].images[0]?.url }}
                        style={styles.artistImage}
                      />
                      <Text style={styles.artistText}>
                        {topArtists[1].name}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.artistItem}
                      onPress={() => handleArtistClick(topArtists[2])}
                    >
                      <Image
                        source={{ uri: topArtists[2].images[0]?.url }}
                        style={styles.artistImage}
                      />
                      <Text style={styles.artistText}>
                        {topArtists[2].name}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.artistItem}
                      onPress={() => handleArtistClick(topArtists[3])}
                    >
                      <Image
                        source={{ uri: topArtists[3].images[0]?.url }}
                        style={styles.artistImage}
                      />
                      <Text style={styles.artistText}>
                        {topArtists[3].name}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.artistItem}
                      onPress={() => handleArtistClick(topArtists[4])}
                    >
                      <Image
                        source={{ uri: topArtists[4].images[0]?.url }}
                        style={styles.artistImage}
                      />
                      <Text style={styles.artistText}>
                        {topArtists[4].name}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

          {searchText.length === 0 &&
            (selectedOption === "Albums" || selectedOption === "People") &&
            recentSearches.length > 0 && (
              <View style={styles.recentSearchesContainer}>
                <View style={styles.recentSearchesHeader}>
                  <Text style={styles.recentSearchesTitle}>
                    Recent Searches
                  </Text>
                  <TouchableOpacity onPress={clearRecentSearches}>
                    <Text style={styles.clearRecentSearchesText}>
                      Clear All
                    </Text>
                  </TouchableOpacity>
                </View>
                {recentSearches.map((query, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.recentSearchItem}
                    onPress={() => handleRecentSearchClick(query)}
                  >
                    <Text style={styles.recentSearchText}>{query}</Text>
                    <TouchableOpacity onPress={() => deleteSearchQuery(query)}>
                      <Ionicons name="close-outline" size={20} color="gray" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}

          {searchText.length === 0 &&
            (selectedOption === "Albums" || selectedOption === "People") &&
            recentSearches.length === 0 && (
              <Text style={styles.noRecentSearchesText}>
                No recent searches.
              </Text>
            )}

          {searchText.length > 0 && (
            <FlatList
              key={selectedOption}
              data={searchResults}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    if (selectedOption === "Albums") {
                      handleAlbumClick(item);
                    } else if (selectedOption === "People") {
                      handleUserClick(item);
                    } else if (selectedOption === "Artists") {
                      handleArtistClick(item);
                    }
                  }}
                  style={[
                    styles.resultItem,
                    selectedOption === "People"
                      ? styles.peopleResultItem
                      : styles.defaultResultItem,
                  ]}
                >
                  <Image
                    source={{
                      uri:
                        item.images?.[0]?.url ||
                        Image.resolveAssetSource(defaultProfileImage).uri,
                    }}
                    style={[
                      styles.image,
                      selectedOption === "Artists"
                        ? styles.artistImage
                        : selectedOption === "People"
                        ? styles.peopleImage
                        : null,
                    ]}
                  />
                  <View style={styles.resultDetails}>
                    <Text
                      style={styles.resultText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              numColumns={selectedOption === "People" ? 1 : 2}
              contentContainerStyle={styles.resultsList}
              columnWrapperStyle={
                selectedOption === "People"
                  ? null
                  : { justifyContent: "space-between" }
              }
              onEndReached={loadMoreResults}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                isLoading ? (
                  <ActivityIndicator size="large" color="white" />
                ) : null
              }
            />
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

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
    marginBottom: 10, // Ortadaki sanatçıyı ayır
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
    marginBottom: 20,
  },
  artistItem: {
    alignItems: "center",
    width: 100, // Sanatçı kutusu genişliği
  },
  artistImageLarge: {
    width: 150, // Ortadaki en popüler sanatçının görseli büyük
    height: 150,
    borderRadius: 75,
    marginBottom: 0,
  },
  artistImage: {
    width: 120, // Alt sıradaki sanatçıların görselleri
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
    top: -30, // Adjust this value to position the crown above the image
    zIndex: 1, // Ensure the crown is above the image
    alignSelf: "center", // Center the crown horizontally
  },
  crownIcon: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5, // For Android shadow
  },
});
