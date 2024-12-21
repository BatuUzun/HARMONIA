import React, { useEffect } from "react";
import { useRouter, Tabs } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function Layout() {
  const router = useRouter();

  // İlk açılışta Home'a yönlendirme
  useEffect(() => {
    router.replace("Screens/Home/Feed");
  }, []);

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
            case "Screens/Activity/Main/index":
              iconName = "pulse-outline";
              break;
            case "Screens/Profile/Profile/index":
              iconName = "person-outline";
              break;
            default:
              iconName = "help-circle-outline";
          }

          return <Ionicons name={iconName} size={28} color={color} />;
        },
        tabBarShowLabel: false, // İkonların altındaki title yazılarını kaldır
        tabBarActiveTintColor: "white",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          backgroundColor: "#1E1E1E",
          height: 90,
          paddingTop: 10, 
          paddingBottom: 10,
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
        name="Screens/Activity/Main/index"
        options={{ title: "Activity" }}
      />
      <Tabs.Screen
        name="Screens/Profile/Profile/index"
        options={{ title: "Profile" }}
      />
    </Tabs>
  );
}
