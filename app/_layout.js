// app > _layout.js
import React, { useContext, useEffect } from "react";
import { useRouter, Tabs, Stack } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthProvider, AuthContext } from "./context/AuthContext";

// Wrap the entire app with AuthProvider
export default function RootLayout() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}

// Main Layout component
function Layout() {
  const router = useRouter();
  const { isAuthenticated } = useContext(AuthContext);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/Screens/Auth");
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
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
        options={{ title: "HARMONIA" }}
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
    </Tabs>
  );
}
