import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CONFIG } from "../constants/config";
import { COLORS, SHADOWS, SPACING } from "../theme/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [usernameOrMobile, setUsernameOrMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const handleSubmit = async () => {
    const val = usernameOrMobile.trim();
    if (!val) {
      Alert.alert("Required Field", "Please enter your username or registered mobile number.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${CONFIG.API_URL}/forgot-password`, {
        username_or_mobile: val,
      }, { timeout: 10000 });

      const sentMobile = response.data.mobile;
      const displayMobile = sentMobile.replace(/.(?=.{4})/g, "*"); // Mask for privacy: e.g. ******1234

      Alert.alert(
        "OTP Code Sent",
        `A password reset OTP has been sent to your registered mobile number.\nSent to: ${displayMobile}\nCode: ${response.data.otp} (Autofilled)`,
        [
          {
            text: "Reset Password",
            onPress: () => {
              router.push({
                pathname: "/reset-password",
                params: { mobile: sentMobile, simulatedOtp: response.data.otp }
              });
            }
          }
        ]
      );
    } catch (error: any) {
      console.log("Forgot password error:", error);
      if (error.response?.status === 404) {
        Alert.alert(
          "Account Not Found",
          "Credential given doesn't exist. Please sign up to create a new account.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign Up",
              onPress: () => {
                router.replace("/signup");
              }
            }
          ]
        );
      } else {
        const errorMsg = error.response?.data?.detail || "Something went wrong. Please try again.";
        Alert.alert("Error", errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <StatusBar style="light" translucent={true} />
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="key-outline" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              Enter your registered username or mobile number below. We will send you an OTP to reset your password.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Username or Mobile Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Username or registered mobile"
                  placeholderTextColor={COLORS.textSecondary}
                  value={usernameOrMobile}
                  onChangeText={setUsernameOrMobile}
                  autoCapitalize="none"
                  autoFocus
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading ? styles.btnDisabled : null]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.surface} />
              ) : (
                <Text style={styles.btnText}>Send Reset OTP</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    ...SHADOWS.soft,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 26,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  form: {
    marginTop: 10,
  },
  inputWrapper: {
    marginBottom: 24,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 6,
    paddingLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    height: 54,
    ...SHADOWS.soft,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: COLORS.textPrimary,
    height: "100%",
  },
  btn: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  btnDisabled: {
    backgroundColor: COLORS.cardBackground,
  },
  btnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.surface,
  },
});
