import React, { useState, useEffect, useContext, useCallback } from "react";
import { useRoute, useFocusEffect } from "@react-navigation/native"; // Import useRoute
import { RefreshControl } from "react-native";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  FlatList,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  PanResponder,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { searchAlbums, getAccessToken } from "../../../api/spotify";
import { Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BACKEND_REVIEW_URL,
  IS_DEVELOPMENT,
} from "../../../constants/apiConstants";
import { AuthContext } from "../../../context/AuthContext";
import styles from "./indexstyle";

/*
  TODOs: 
  - Renkler ve stiller üzerinde geliştirmeler yapılacak. Daha estetik olsun
  - Reviewların text fieldına girilen input çok uzunsa hata dönüyor, bunu düzelt (backendle alakalı)
*/

export default function ReviewScreen() {
  const { userId } = useContext(AuthContext); // Get userId from AuthContext
  const route = useRoute(); // Use the useRoute hook to access the route object
  const { selectedAlbum: selectedAlbumRaw, reviewToUpdate: reviewToUpdateRaw } =
    route.params || {};
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [reviewToUpdate, setReviewToUpdate] = useState(null); // en üstte
  const [rating, setRating] = useState(0);
  const starSize = 40; // Adjust star size as needed
  const starPadding = 10; // Space between stars
  const totalStars = 5; // Total number of stars
  const ratingWidth = totalStars * (starSize + starPadding); // Total width of rating bar
  const [gestureX, setGestureX] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isModalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [offset, setOffset] = useState(0); // Track API pagination
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const screenWidth = Dimensions.get("window").width;
  const [accessToken, setAccessToken] = useState(null);
  const resetForm = () => {
    setSelectedAlbum(null);
    setReviewToUpdate(null);
    setRating(0);
    setReviewText("");
  };

  useEffect(() => {
    const {
      selectedAlbum: selectedAlbumRaw,
      reviewToUpdate: reviewToUpdateRaw,
      isUpdateFlow,
    } = route.params || {};

    if (isUpdateFlow === false) {
      resetForm();
    }

    // Always parse and set the selectedAlbum if provided
    if (selectedAlbumRaw) {
      try {
        const parsedAlbum = JSON.parse(selectedAlbumRaw);
        setSelectedAlbum(parsedAlbum);

        // Only reset form fields if it's not an update flow
        if (!isUpdateFlow) {
          setRating(0);
          setReviewText("");
          setReviewToUpdate(null);
        }
      } catch (e) {
        if (IS_DEVELOPMENT) console.error("Failed to parse selectedAlbum:", e);
      }
    }

    if (reviewToUpdateRaw) {
      try {
        const parsedReview = JSON.parse(reviewToUpdateRaw);
        setReviewToUpdate(parsedReview);
        setRating(parsedReview.rating || 0);
        setReviewText(parsedReview.comment || "");

        // Only fetch from Spotify if we don't have selectedAlbum yet
        if (!selectedAlbumRaw) {
          fetchAlbumInfoFromSpotify(parsedReview.spotifyId);
        }
      } catch (e) {
        if (IS_DEVELOPMENT) console.error("Failed to parse reviewToUpdate:", e);
      }
    }
  }, [route.params]);

  useFocusEffect(
    useCallback(() => {
      // Ekran açıldığında hiçbir şey yapma
      return () => {
        // Ekran kapandığında resetForm yap
        resetForm();
      };
    }, [])
  );

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await getAccessToken();
        setAccessToken(token);
      } catch (error) {
        if (IS_DEVELOPMENT) {
          console.error("Error fetching access token:", error);
        }
      }
    };
    fetchToken();
  }, []);

  const SEARCH_HISTORY_KEY = "searchHistory";

  const handleSearch = async (loadMore = false) => {
    if (!searchQuery.trim() || !accessToken || isLoading) return;

    setIsLoading(true);
    try {
      const results = await searchAlbums(accessToken, searchQuery, offset);

      setSearchResults((prev) => {
        const combinedResults = loadMore ? [...prev, ...results] : results;
        const uniqueResults = combinedResults.filter(
          (item, index, self) =>
            index === self.findIndex((t) => t.id === item.id)
        );
        return uniqueResults;
      });

      if (!loadMore) {
        setOffset(0); // Reset offset for a new search
      }

      // ✅ Save the search query to history (now with delay & no duplicates)
      saveSearchQuery(searchQuery);
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("🚨 Error searching for albums:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };



  const loadMoreResults = () => {
    if (!isLoading && searchQuery.trim()) {
      setOffset((prev) => prev + 10); // Increase offset by 10 for next results
    }
  };

  useEffect(() => {
    if (offset > 0) {
      handleSearch(true); // Load more results when offset changes
    }
  }, [offset]);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event, gestureState) => {
      setGestureX(gestureState.x0); // Save the starting position
    },
    onPanResponderMove: (event, gestureState) => {
      const touchX = gestureState.moveX - gestureX; // Calculate relative movement
      let newRating = (touchX / ratingWidth) * totalStars; // Map to rating scale

      newRating = Math.round(newRating * 2) / 2; // Ensure 0.5 increments
      newRating = Math.min(5, Math.max(0, newRating)); // Keep within 0-5 range
      setRating(newRating);
    },
  });

  const renderStars = () => {
    return [...Array(totalStars)].map((_, index) => {
      const starValue = index + 1;
      let iconName = "star-outline";

      if (rating >= starValue) {
        iconName = "star"; // Full star
      } else if (rating >= starValue - 0.5) {
        iconName = "star-half"; // Half star
      }

      return (
        <TouchableOpacity key={index} onPress={() => setRating(starValue)}>
          <Ionicons name={iconName} size={starSize} color="#FFD700" />
        </TouchableOpacity>
      );
    });
  };

  const saveSearchQuery = async (query) => {
    if (!query.trim()) return; // Boş aramalar kaydedilmesin

    try {
      let history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      history = history ? JSON.parse(history) : [];

      // Eğer aynı isim zaten varsa eskiyi sil
      history = history.filter((item) => item !== query);

      // Yeni arama sorgusunu ekleyip en üste koy
      history.unshift(query);

      // 10 öğeyi aşarsa en eskiyi sil
      if (history.length > 10) {
        history.pop();
      }

      setTimeout(async () => {
        await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
        setSearchHistory(history);
      }, 3000);
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Failed to save search history:", error);
      }
    }
  };

  const deleteSpecificSearch = async (query) => {
    try {
      let history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      history = history ? JSON.parse(history) : [];

      // Seçili olan geçmiş öğesini kaldır
      history = history.filter((item) => item !== query);

      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
      setSearchHistory(history);
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Failed to delete search history item:", error);
      }
    }
  };

  const updateReview = async () => {
    if (!selectedAlbum || !reviewToUpdate) {
      alert("Missing album or review data.");
      return;
    }

    if (rating === 0) {
      alert("Please give a rating between 1 and 5.");
      return;
    }

    try {
      const reviewData = {
        id: reviewToUpdate.id, // id burada gerekli
        userId: userId,
        spotifyId: selectedAlbum.id,
        rating: rating,
        comment: reviewText,
      };

      const response = await fetch(
        `${BACKEND_REVIEW_URL}/review/update/${reviewToUpdate.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reviewData),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update review: ${response.statusText}`);
      }

      alert("Review updated successfully!");
      resetForm();
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Error updating review:", error);
      }
      alert("An error occurred while updating your review.");
    }
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      const delayDebounceFn = setTimeout(() => {
        handleSearch();
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]); // Instantly clear albums when input is empty
    }
  }, [searchQuery]);

  // Handle album selection
  const selectAlbum = async (album) => {
    setSelectedAlbum(album);
    setModalVisible(false);

    let albumName =
      album.name.length > 25 ? album.name.slice(0, 25) + "..." : album.name;

    try {
      let history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      history = history ? JSON.parse(history) : [];

      // Eğer albüm ismi zaten geçmişte varsa, eski olanı sil
      history = history.filter((item) => item !== albumName);

      // Yeni albümü en üste ekle
      history.unshift(albumName);

      // Son 10 öğeyi tut
      if (history.length > 10) {
        history.pop();
      }

      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
      setSearchHistory(history);
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Failed to update search history with album:", error);
      }
    }
  };

  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        if (history) {
          setSearchHistory(JSON.parse(history));
        }
      } catch (error) {
        if (IS_DEVELOPMENT) {
          console.error("❌ Failed to load search history:", error);
        }
      }
    };

    loadSearchHistory();
  }, []);

  const clearSearchHistory = async () => {
    try {
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
      setSearchHistory([]); // Update state immediately
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Failed to clear search history:", error);
      }
    }
  };

  const saveReview = async () => {
    if (!selectedAlbum) {
      alert("Please select an album before saving.");
      return;
    }

    if (rating === 0) {
      alert("Please give a rating between 1 and 5.");
      return;
    }

    try {
      const reviewData = {
        userId: userId,
        spotifyId: selectedAlbum.id,
        rating: rating,
        comment: reviewText,
      };

      const response = await fetch(`${BACKEND_REVIEW_URL}/review/add-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reviewData),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit review: ${response.statusText}`);
      }

      alert("Review saved successfully!");
      resetForm();
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Error saving review:", error);
      }
      alert(
        "An error occurred while saving your review. Please try again later."
      );
    }
  };

  const onRefresh = () => {
    setRefreshing(true);

    // formu sıfırla
    setSelectedAlbum(null);
    setReviewToUpdate(null);
    setRating(0);
    setReviewText("");
    setSearchQuery("");
    setSearchResults([]);

    // 1 saniye sonra refreshing'i false yap
    setTimeout(() => setRefreshing(false), 1000);
  };

  const fetchAlbumInfoFromSpotify = async (spotifyId) => {
    if (!spotifyId || !accessToken) return;

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/albums/${spotifyId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();

      if (data) {
        setSelectedAlbum({
          id: data.id,
          name: data.name,
          release_date: data.release_date,
          images: data.images,
          artists: data.artists,
        });
      }
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Failed to fetch album info from Spotify:", error);
      }
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Album Selection Button */}
      <TouchableOpacity
        onPress={() => {
          if (!reviewToUpdate) setModalVisible(true);
        }}
        disabled={!!reviewToUpdate}
        style={[styles.albumSelector, reviewToUpdate]}
      >
        {selectedAlbum ? (
          <View style={styles.albumInfo}>
            <Image
              source={{ uri: selectedAlbum.images[0]?.url }}
              style={styles.albumImage}
            />
            <View>
              <View style={{ flexShrink: 1 }}>
                <Text
                  style={styles.albumTitle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {selectedAlbum.name}
                </Text>
              </View>
              <Text style={styles.albumYear}>
                {selectedAlbum?.release_date
                  ? selectedAlbum.release_date.slice(0, 4)
                  : "Year Unknown"}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.selectAlbumText}>Select an Album to Review</Text>
        )}
      </TouchableOpacity>

      {/* Date Picker */}
      
      

      {/* Star Rating */}
      <View style={styles.ratingWrapper}>
        <Text style={styles.ratingText}>Rate</Text>
        <View style={styles.ratingContainer} {...panResponder.panHandlers}>
          <View style={styles.starRow}>{renderStars()}</View>
        </View>
      </View>
      <View style={{ position: "relative", marginBottom: 15 }}>
        {/* Review Input */}
        <TextInput
          style={styles.textInput}
          placeholder={
            "Add review for " +
            (selectedAlbum ? selectedAlbum.name : "") +
            "..."
          }
          placeholderTextColor="gray"
          multiline
          value={reviewText}
          onChangeText={(text) => {
            if (text.length <= 1000) {
              setReviewText(text);
            }
          }}
          maxLength={1000}
        />
        <Text style={styles.characterCount}>{reviewText.length}/1000</Text>
      </View>

      {/* Submit/Update Buttons */}
      {reviewToUpdate ? (
        <TouchableOpacity style={styles.updateButton} onPress={updateReview}>
          <Text style={styles.buttonText}>Update</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.saveButton} onPress={saveReview}>
          <Text style={styles.buttonText}>Submit</Text>
        </TouchableOpacity>
      )}

      {/* Album Search Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <Pressable
            onPress={() => setModalVisible(false)}
            style={{
              position: "absolute",
              top: 65,
              left: 0,
              zIndex: 10,
              paddingVertical: 5,
              paddingHorizontal: 15,
            }}
          >
            <Text style={styles.closeButtonText}>Cancel</Text>
          </Pressable>
          {/* Search Bar */}
          <View style={[styles.searchBox, { width: screenWidth - 20 }]}>
            <Ionicons
              name="search-outline"
              size={24}
              color="gray"
              style={styles.icon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for an album..."
              placeholderTextColor="gray"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={styles.clearButton}
              >
                <Ionicons name="close-outline" size={24} color="gray" />
              </TouchableOpacity>
            )}
          </View>

          {/* Recent Searches (Only shown when searchQuery is empty) */}
          {searchQuery.length === 0 && (
            <View style={styles.searchHistoryContainer}>
              {searchHistory.length > 0 && (
                <View style={styles.searchHistoryHeader}>
                  <Text style={styles.searchHistoryTitle}>Recent Searches</Text>

                  <TouchableOpacity
                    onPress={clearSearchHistory}
                    style={styles.clearHistoryButton}
                  >
                    <Text style={styles.clearHistoryButtonText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
              )}

              {searchHistory.length > 0 ? (
                searchHistory.map((query, index) => (
                  <View key={index} style={styles.historyItem}>
                    <TouchableOpacity onPress={() => setSearchQuery(query)}>
                      <Text style={styles.historyText}>{query}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => deleteSpecificSearch(query)}
                    >
                      <Ionicons name="close-outline" size={20} color="gray" />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.noHistoryText}>No recent searches.</Text>
              )}
            </View>
          )}

          {/* Loading Indicator */}
          {loading && <ActivityIndicator size="large" color="white" />}

          {/* Album List */}
          <FlatList
            data={searchResults}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            numColumns={2}
            contentContainerStyle={styles.resultsList}
            columnWrapperStyle={{ justifyContent: "space-between" }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => selectAlbum(item)}
                style={styles.albumItem}
              >
                <Image
                  source={{ uri: item.images[0]?.url }}
                  style={styles.albumThumbnail}
                />
                <Text
                  style={styles.albumName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
            onEndReached={loadMoreResults} // Load more when reaching end
            onEndReachedThreshold={0.5} // Trigger at 50% of list
            ListFooterComponent={
              isLoading ? (
                <ActivityIndicator size="large" color="white" />
              ) : null
            } // Show loading indicator
          />
        </View>
      </Modal>
    </ScrollView>
  );
}


