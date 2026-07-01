import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS, SPACING, SHADOWS } from "../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { CONFIG } from "../constants/config";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobile)) {
      Alert.alert("Invalid Input", "Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${CONFIG.API_URL}/forgot-password`, {
        mobile: mobile.trim(),
      });

      Alert.alert(
        "OTP Code Sent",
        "A password reset OTP has been sent to your mobile number.",
        [
          {
            text: "Reset Password",
            onPress: () => {
              router.push({
                pathname: "/reset-password",
                params: { mobile: mobile.trim() }
              });
            }
          }
        ]
      );
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Mobile number is not registered.";
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="key-outline" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              Enter your registered mobile number below. We will send you an OTP to reset your password.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 9876543210"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  value={mobile}
                  onChangeText={setMobile}
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
    </SafeAreaView>
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
