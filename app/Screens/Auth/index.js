// app > Screens > Auth > index.js
import React, { useState, useContext } from "react"; // Add useContext
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { AuthContext } from "../../context/AuthContext"; // Import AuthContext
import {
  BACKEND_CREDENTIALS_URL,
  IS_DEVELOPMENT,
} from "../../constants/apiConstants";

export default function Login() {
  const router = useRouter();
  const { login } = useContext(AuthContext); // Use AuthContext
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Function to validate email format
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    if (!validateEmail(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    if (password.length === 0) {
      Alert.alert("Error", "Please enter your password.");
      return;
    }

    try {
      const response = await fetch(
        `${BACKEND_CREDENTIALS_URL}/credentials/check-login-credentials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            password: password,
            rememberMe: true,
          }),
        }
      );

      const result = await response.json();
      if (response.ok) {
        if (IS_DEVELOPMENT) {
          console.log("Login successful:", result);
        }
        if (!result.isVerified) {
          // Kullanıcı doğrulanmamışsa VerificationSettings ekranına yönlendir
          router.replace({
            pathname: "/Screens/Auth/VerificationSettings",
            params: { email, password },
          });
        } else {
          // Kullanıcı doğrulanmışsa Home ekranına yönlendir
          await login(result.token, result.userId);
          router.replace("Screens/Home/Feed"); //todo
        }
      } else {
        if (IS_DEVELOPMENT) {
          const error = await response.text();
          console.error("Login error:", error);
        }
        Alert.alert("Error", error || "Invalid credentials. Try again.");
      }
    } catch (error) {
      if (IS_DEVELOPMENT) {
        console.error("Login Error:", error);
      }
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Login</Text>

        {/* Email Input */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Password Input */}
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        {/* Login Button */}
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        {/* Sign Up Link */}
        <TouchableOpacity onPress={() => router.push("./Auth/SignUp")}>
          <Text style={styles.link}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#1E1E1E",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#2E2E2E",
    color: "white",
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#1DB954",
    padding: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  checkboxText: {
    color: "white",
    marginLeft: 8,
  },
  link: {
    color: "#1DB954",
    textAlign: "center",
    marginTop: 10,
  },
});
