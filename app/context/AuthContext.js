// app > context > AuthContext.js
import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null); // Add userId state

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await AsyncStorage.getItem("userToken");
      const storedUserId = await AsyncStorage.getItem("userId");
      if (token && storedUserId) {
        setIsAuthenticated(true);
        setUserId(storedUserId);
      } else {
        setIsAuthenticated(false);
        setUserId(null);
      }
    };
    checkLoginStatus();
  }, []);

  const login = async (token, userId) => {
    await AsyncStorage.setItem("userToken", token);
    await AsyncStorage.setItem("userId", userId.toString()); // Store userId
    setIsAuthenticated(true);
    setUserId(userId); // Set userId
  };

  const logout = async () => {
    await AsyncStorage.removeItem("userToken");
    await AsyncStorage.removeItem("userId"); // Remove userId
    setIsAuthenticated(false);
    setUserId(null); // Reset userId
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
