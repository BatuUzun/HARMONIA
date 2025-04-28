import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import styles from "./indexcss";
import {
  getFollowedUsers,
  getReviewActivities,
  getReviewLikeActivities,
  getReviewCommentActivities,
  getProfileImageBase64,
  getAlbumInfoBySpotifyId,
} from "../../api/backend";
import { AuthContext } from "../../context/AuthContext";

const TABS = ["Reviews", "Likes", "Comments"];

export default function ActivityScreen() {
  const { userId } = useContext(AuthContext);
  const [followedUserIds, setFollowedUserIds] = useState([]);
  const [selectedTab, setSelectedTab] = useState("Reviews");
  const [isAlbumDataFetched, setIsAlbumDataFetched] = useState(false);

  const [reviewCursor, setReviewCursor] = useState(null);
  const [reviewLikeCursor, setReviewLikeCursor] = useState(null);
  const [commentCursor, setCommentCursor] = useState(null);

  const [reviewActivities, setReviewActivities] = useState([]);
  const [likeActivities, setLikeActivities] = useState([]);
  const [commentActivities, setCommentActivities] = useState([]);

  const [profileImages, setProfileImages] = useState({});
  const [albumInfoMap, setAlbumInfoMap] = useState({});

  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMap, setHasMoreMap] = useState({
    Reviews: true,
    Likes: true,
    Comments: true,
  });

  const [refreshing, setRefreshing] = useState(false);

  const [isDataFetched, setIsDataFetched] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const ids = await getFollowedUsers(userId);
      setFollowedUserIds(ids);
      if (ids.length > 0) {
        setReviewActivities([]);
        setLikeActivities([]);
        setCommentActivities([]);
        setReviewCursor(null);
        setReviewLikeCursor(null);
        setCommentCursor(null);
        setHasMoreMap({
          Reviews: true,
          Likes: true,
          Comments: true,
        });
        await fetchData("Reviews", null, ids);
      }
    } catch (e) {
      console.error("❌ Refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchFollowed = async () => {
      const ids = await getFollowedUsers(userId);

      setFollowedUserIds(ids);
      if (ids.length > 0) {
        fetchData("Reviews", null, ids);
      }

      setIsDataFetched(true);
    };
    fetchFollowed();
  }, []);

  const updateHasMore = (tab, value) => {
    setHasMoreMap((prev) => ({ ...prev, [tab]: value }));
  };

  const fetchData = async (type, cursor, ids = followedUserIds) => {
    if (loadingMore || ids.length === 0 || !hasMoreMap[type]) {
      console.log(`[fetchData] Skipped fetching for type=${type}`);
      return;
    }

    console.log(`[fetchData] Start fetching ${type}, initial cursor=${cursor}`);

    setLoadingMore(true);
    try {
      let currentCursor = cursor ?? "2100-01-01T00:00:00Z";

      while (currentCursor !== null) {
        console.log(
          `[fetchData] Fetching ${type} with cursor=${currentCursor}`
        );
        let response;
        let filtered = [];
        let nextCursor = null;

        if (type === "Reviews") {
          response = await getReviewActivities(ids, currentCursor);
          filtered = response.activities || [];
          nextCursor = response.nextCursor ?? null; // ✅ fix here
          setReviewActivities((prev) => [...prev, ...filtered]);
          setReviewCursor(nextCursor);
        } else if (type === "Likes") {
          response = await getReviewLikeActivities(ids, currentCursor);
          filtered = response.activities || [];
          nextCursor = response.nextCursor ?? null; // ✅ fix here
          setLikeActivities((prev) => [...prev, ...filtered]);
          setReviewLikeCursor(nextCursor);
        } else if (type === "Comments") {
          response = await getReviewCommentActivities(ids, currentCursor);
          filtered = response.activities || [];
          nextCursor = response.nextCursor ?? null; // ✅ fix here
          setCommentActivities((prev) => [...prev, ...filtered]);
          setCommentCursor(nextCursor);
        }

        console.log(
          `[fetchData] Fetched ${filtered.length} activities for ${type}`
        );
        console.log(`[fetchData] Next cursor = ${nextCursor}`);

        preloadAssets(filtered);

        if (!nextCursor) {
          console.log(`[fetchData] No next cursor for ${type}, finished.`);
          updateHasMore(type, false);
          currentCursor = null;
        } else {
          currentCursor = nextCursor;
        }
      }
    } catch (e) {
      console.error("❌ Fetch error:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const preloadAssets = async (items) => {
    const imgs = items
      .flatMap((a) => [
        a.userProfile?.profileImage,
        a.details?.reviewAuthorProfile?.profileImage,
      ])
      .filter((img) => img && !profileImages[img]);

    await Promise.all(
      imgs.map(async (fileName) => {
        const base64 = await getProfileImageBase64(fileName);
        if (base64) {
          setProfileImages((prev) => ({ ...prev, [fileName]: base64 }));
        }
      })
    );

    const spotifyIds = items
      .flatMap((a) =>
        a.details?.review?.spotifyId
          ? [a.details.review.spotifyId]
          : a.details?.spotifyId
          ? [a.details.spotifyId]
          : []
      )
      .filter(
        (id, idx, self) => id && !albumInfoMap[id] && self.indexOf(id) === idx
      );

    await Promise.all(
      spotifyIds.map(async (id) => {
        const album = await getAlbumInfoBySpotifyId(id);
        if (album) {
          setAlbumInfoMap((prev) => ({ ...prev, [id]: album }));
        }
      })
    );

    setIsAlbumDataFetched(true); // ✅ Spotify verileri de yüklendiğinde
  };

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const reachedBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;

    if (!reachedBottom || loadingMore || !hasMoreMap[selectedTab]) return;

    if (selectedTab === "Reviews") fetchData("Reviews", reviewCursor);
    else if (selectedTab === "Likes") fetchData("Likes", reviewLikeCursor);
    else if (selectedTab === "Comments") fetchData("Comments", commentCursor);
  };

  const renderActivities = () => {
    const list =
      selectedTab === "Reviews"
        ? reviewActivities
        : selectedTab === "Likes"
        ? likeActivities
        : commentActivities;

    return list.map((item, index) => {
      const username = item.userProfile?.username || `User ${item.userId}`;
      const profileImg = item.userProfile?.profileImage;
      const isComment = item.type === "reviewComment";
      const actionText =
        selectedTab === "Reviews"
          ? "made a review"
          : isComment
          ? "commented on a review"
          : "liked a review";

      const review = item.details?.review ?? item.details;
      const album = albumInfoMap[review?.spotifyId];
      const albumName = album?.name || "Unknown Album";
      const artistNames = album?.artists?.map((a) => a.name).join(", ");
      const reviewText = review?.comment
        ? `“${review.comment}” — ${review.rating} ★`
        : `Rating: ${review?.rating || "N/A"} ★`;
      const albumImgUrl = album?.images?.[0]?.url;

      const nestedProfile = item.details?.reviewAuthorProfile;
      const nestedImg = nestedProfile?.profileImage;
      const nestedName = nestedProfile?.username || `User ${review?.userId}`;
      const commentText = item.details?.reviewComment?.comment;

      return (
        <View key={index} style={styles.activityRow}>
          {profileImg && profileImages[profileImg] && (
            <Image
              source={{ uri: profileImages[profileImg] }}
              style={styles.avatar}
            />
          )}
          <View style={styles.activityContent}>
            <Text style={styles.username}>
              • {username} {actionText}
            </Text>
            <Text style={styles.description}>{`${albumName} by ${
              artistNames || "Unknown Artist"
            }`}</Text>
            <Text
              style={[
                styles.description,
                { fontStyle: "italic", marginBottom: 4 },
              ]}
            >
              {reviewText}
            </Text>
            {commentText && (
              <Text style={styles.description}>💬 "{commentText}"</Text>
            )}
            {nestedImg && profileImages[nestedImg] && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 5,
                }}
              >
                <Image
                  source={{ uri: profileImages[nestedImg] }}
                  style={[
                    styles.avatar,
                    { width: 24, height: 24, marginRight: 8 },
                  ]}
                />
                <Text style={styles.text}>{nestedName}'s review</Text>
              </View>
            )}
            {albumImgUrl && (
              <Image source={{ uri: albumImgUrl }} style={styles.albumCover} />
            )}
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        </View>
      );
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#000" }}
      contentContainerStyle={styles.container}
      onScroll={handleScroll}
      scrollEventThrottle={400}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#fff"
        />
      }
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          marginVertical: 10,
        }}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => {
              setSelectedTab(tab);
              if (
                (tab === "Reviews" && reviewActivities.length === 0) ||
                (tab === "Likes" && likeActivities.length === 0) ||
                (tab === "Comments" && commentActivities.length === 0)
              ) {
                updateHasMore(tab, true);
                fetchData(tab, null);
              }
            }}
          >
            <Text
              style={[
                styles.text,
                selectedTab === tab && {
                  fontWeight: "bold",
                  textDecorationLine: "underline",
                },
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!isDataFetched || !isAlbumDataFetched ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
      ) : followedUserIds.length === 0 ? (
        <Text style={styles.text}>You’re not following anyone yet.</Text>
      ) : selectedTab === "Reviews" && reviewActivities.length === 0 ? (
        <Text style={styles.text}>
          No review activity found by people you follow.
        </Text>
      ) : selectedTab === "Likes" && likeActivities.length === 0 ? (
        <Text style={styles.text}>
          No like activity found by people you follow.
        </Text>
      ) : selectedTab === "Comments" && commentActivities.length === 0 ? (
        <Text style={styles.text}>
          No comment activity found by people you follow.
        </Text>
      ) : (
        renderActivities()
      )}

      {loadingMore && (
        <ActivityIndicator color="#fff" style={{ marginVertical: 20 }} />
      )}
    </ScrollView>
  );
}
