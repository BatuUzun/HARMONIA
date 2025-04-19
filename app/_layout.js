import React, { useContext, useEffect, useState } from "react";
import { useRouter, usePathname, Tabs, Stack } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { Provider as PaperProvider } from "react-native-paper";

// Wrap the entire app with AuthProvider
export default function RootLayout() {
  return (
    <PaperProvider>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </PaperProvider>
  );
}

// Main Layout component
function Layout() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useContext(AuthContext);
  const [isSpotifyAvailable, setIsSpotifyAvailable] = useState(true);
  const [checkingSpotify, setCheckingSpotify] = useState(true);
  const { userId } = useContext(AuthContext);

  const checkSpotifyAPI = async () => {
    setCheckingSpotify(true);
    try {
      const response = await fetch(
        "https://api.spotify.com/v1/albums/0sNOF9WDwhWunNAHPD3Baj"
      );
      if (response.ok || response.status === 401) {
        setIsSpotifyAvailable(true);
      } else {
        setIsSpotifyAvailable(false);
      }
    } catch (error) {
      console.log("Spotify check failed:", error);
      setIsSpotifyAvailable(false);
    } finally {
      setCheckingSpotify(false);
    }
  };

  useEffect(() => {
    checkSpotifyAPI();
  }, []);

  useEffect(() => {
    if (
      !checkingSpotify &&
      !isSpotifyAvailable &&
      pathname !== "/Screens/Maintenance"
    ) {
      router.replace("/Screens/Maintenance");
    }
  }, [checkingSpotify, isSpotifyAvailable, pathname]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/Screens/Auth");
    }
  }, [isAuthenticated]);

  if (!isAuthenticated || (!checkingSpotify && !isSpotifyAvailable)) {
    return (
      <Stack>
        <Stack.Screen
          name="Screens/Auth/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Screens/Auth/SignUp"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Screens/Auth/VerificationSettings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Screens/Maintenance/index"
          options={{ headerShown: false }}
        />
      </Stack>
    );
  }

  // Show tabs (with bottom navigation) if authenticated
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;

          switch (route.name) {
            case "Screens/Home/Feed/index":
              iconName = "home-outline";
              break;
            case "Screens/Search/Main/index":
              iconName = "search-outline";
              break;
            case "Screens/Review/Entry/index":
              iconName = "add-circle-outline";
              break;
            case "Screens/Profile/Profile/index":
              iconName = "person-outline";
              break;
            default:
              iconName = "help-circle-outline";
          }

          return <Ionicons name={iconName} size={28} color={color} />;
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: "white",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          backgroundColor: "#1E1E1E",
          height: 90,
          paddingTop: 10,
          paddingBottom: 10,
        },
        headerStyle: {
          backgroundColor: "#1E1E1E",
        },
        headerTitleStyle: {
          color: "white",
        },
      })}
    >
      <Tabs.Screen
        name="Screens/Home/Feed/index"
        options={{
          title: "HARMONIA",
          headerRight: () => (
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={26}
              color="white"
              style={{ marginRight: 20 }}
              onPress={() =>
                router.push({
                  pathname: "/Screens/Chat",
                  params: { userId: userId },
                })
              }
            />
          ),
        }}
      />
      <Tabs.Screen
        name="Screens/Search/Main/index"
        options={{ title: "Search" }}
      />
      <Tabs.Screen
        name="Screens/Review/Entry/index"
        options={{ title: "Review" }}
      />
      <Tabs.Screen
        name="Screens/Profile/Profile/index"
        options={{ title: "Profile" }}
      />
      <Tabs.Screen name="Screens/Auth/index" options={{ href: null }} />
      <Tabs.Screen name="Screens/Auth/SignUp" options={{ href: null }} />
      <Tabs.Screen
        name="Screens/Auth/VerificationSettings"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="Screens/AuthenticationSettings/index"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="Screens/Profile/ArtistProfile/index"
        options={{ href: null }}
      />
      <Tabs.Screen name="Screens/Maintenance/index" options={{ href: null }} />
      <Tabs.Screen
        name="Screens/Chat/index"
        options={{
          title: "HARMONIA",
          href: null,
          headerStyle: { backgroundColor: "#1E1E1E" },
          headerTitleStyle: { color: "white" },
          headerTintColor: "white",
        }}
      />
      <Tabs.Screen
        name="Screens/Chat/ChatDetailScreen"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="Screens/Chat/ChatDetailScreenStyles"
        options={{ href: null }}
      />
      <Tabs.Screen name="Screens/Chat/indexcss" options={{ href: null }} />
    </Tabs>
  );
}
