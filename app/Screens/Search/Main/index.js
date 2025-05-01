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
  ScrollView
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
import styles from "./indexstyle";

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

        setTopArtists(allArtists.slice(0, 3));
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
        {searchText.length === 0 && selectedOption === "Artists" && topArtists.length === 3 && (
  <ScrollView
    contentContainerStyle={styles.artistsContainer}
    showsVerticalScrollIndicator={false}
  >
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
        <Text style={styles.artistText}>{topArtists[0].name}</Text>
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
        <Text style={styles.artistText}>{topArtists[1].name}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.artistItem}
        onPress={() => handleArtistClick(topArtists[2])}
      >
        <Image
          source={{ uri: topArtists[2].images[0]?.url }}
          style={styles.artistImage}
        />
        <Text style={styles.artistText}>{topArtists[2].name}</Text>
      </TouchableOpacity>
    </View>
  </ScrollView>
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
