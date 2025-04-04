import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import axios from "axios";
import { BACKEND_CREDENTIALS_URL } from "../../constants/apiConstants";
import { AuthContext } from "../../context/AuthContext";

export default function VerificationScreen() {
  const router = useRouter();
  const { login } = useContext(AuthContext);
  const { email, password } = useLocalSearchParams();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (email) {
      sendVerificationCode();
    }
  }, [email]);

  // Send Verification Code
  const sendVerificationCode = async () => {
    if (emailSent) {
      return;
    }

    if (!email) {
      Alert.alert("Error", "Email is required for verification.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${BACKEND_CREDENTIALS_URL}/email-sender/send-verification-code/`,
        {
          params: { email, code },
        }
      );
      console.log("✅ Code Sent:", response.data);
      setVerificationCode(response.data);
      setEmailSent(true);
      console.log("Success", "Verification code has been sent to your email.");
    } catch (error) {
      console.error(
        "❌ Error Sending Code:",
        error.response?.data || error.message
      );
      Alert.alert("Error", "Failed to send verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code || code.length !== 6) {
      Alert.alert("Error", "Please enter a valid 6-digit code.");
      return;
    }

    try {
      // 1. Verify the email first
      const verifyResponse = await axios.put(
        `${BACKEND_CREDENTIALS_URL}/credentials/verify-email`,
        null,
        { params: { email, code } }
      );

      if (verifyResponse.data === true) {
        // 2. Then login to get the token
        const loginResponse = await axios.post(
          `${BACKEND_CREDENTIALS_URL}/credentials/check-login-credentials`,
          {
            email: email,
            password: password, // Make sure password is passed from login screen
            rememberMe: true,
          }
        );

        const result = loginResponse.data;

        if (result.token && result.userId) {
          // 3. Complete the login process
          await login(result.token, result.userId);
          router.replace("/Screens/Home/Feed");
        } else {
          throw new Error("Token or userId missing in response");
        }
      } else {
        Alert.alert("Error", "Invalid code. Please try again.");
      }
    } catch (error) {
      console.error("Verification error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <Text style={styles.title}>Enter Verification Code</Text>
        <Text style={styles.welcomeText}>
          We have sent a verification code to:
        </Text>
        <Text style={styles.mailText}>{email}</Text>
        <Text style={styles.welcomeText}>
          Please don't forget to check your spam folder!
        </Text>
        <TextInput
          style={styles.input}
          placeholder="6-digit code"
          value={code}
          onChangeText={setCode}
          keyboardType="numeric"
          maxLength={6}
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.disabledButton]}
          onPress={verifyCode}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? "Verifying..." : "Verify Code"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton]}
          onPress={sendVerificationCode}
          disabled={isLoading}
        >
          <Text style={styles.resendButtonText}>
            {isLoading ? "Resending..." : "Resend Code"}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}

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
    marginBottom: 10,
    textAlign: "center",
  },
  welcomeText: {
    fontSize: 18,
    color: "#BBBBBB",
    marginBottom: 20,
    textAlign: "center",
  },
  mailText: {
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "bold",
  },
  input: {
    backgroundColor: "#2E2E2E",
    color: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    textAlign: "center",
    fontSize: 18,
  },
  button: {
    backgroundColor: "#169147",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 5,
    marginTop: 10,
    marginHorizontal: 100,
  },
  resendButton: {
    padding: 15,
    alignItems: "center",
    marginBottom: 70,
  },
  resendButtonText: {
    color: "white",
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: "#555555",
  },
  buttonText: {
    color: "white",
    fontSize: 20,
  },
});
