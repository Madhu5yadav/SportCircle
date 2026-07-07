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
  Platform,
  ScrollView
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { COLORS, SPACING, SHADOWS } from "../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { CONFIG } from "../constants/config";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { mobile, simulatedOtp } = useLocalSearchParams<{ mobile: string; simulatedOtp?: string }>();

  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);
  const [secureConfirmText, setSecureConfirmText] = useState(true);

  // Pre-fill simulated OTP in dev/testing mode
  React.useEffect(() => {
    if (simulatedOtp) {
      setOtpCode(simulatedOtp);
    }
  }, [simulatedOtp]);

  const handleSubmit = async () => {
    if (otpCode.length !== 6) {
      Alert.alert("Invalid OTP", "Please enter a valid 6-digit OTP code.");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Invalid Password", "Password must be at least 8 characters long.");
      return;
    }

    // Password complexity check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      Alert.alert(
        "Weak Password",
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${CONFIG.API_URL}/reset-password`, {
        mobile,
        otp_code: otpCode.trim(),
        new_password: newPassword,
      }, { timeout: 10000 });

      Alert.alert(
        "Success",
        "Your password has been reset successfully. You can now login with your new credentials.",
        [
          {
            text: "Login Now",
            onPress: () => {
              router.replace("/login");
            }
          }
        ]
      );
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Failed to reset password. Check the OTP code.";
      Alert.alert("Reset Failed", errorMsg);
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
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="refresh-outline" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Create a new secure password for your account associated with +91 {mobile}.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* OTP Code */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>OTP Code</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="shield-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit OTP code"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
              </View>
              {simulatedOtp && (
                <Text style={styles.devModeText}>
                  ⚠️ Dev Mode: Simulated OTP is <Text style={styles.devModeCode}>{simulatedOtp}</Text> (Autofilled)
                </Text>
              )}
            </View>

            {/* New Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Min 8 chars, uppercase, digit, symbol"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry={secureText}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setSecureText(!secureText)}>
                  <Ionicons 
                    name={secureText ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={COLORS.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry={secureConfirmText}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setSecureConfirmText(!secureConfirmText)}>
                  <Ionicons 
                    name={secureConfirmText ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={COLORS.textSecondary} 
                  />
                </TouchableOpacity>
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
                <Text style={styles.btnText}>Reset & Save Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
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
    marginBottom: 20,
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
    marginTop: 16,
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
  devModeText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#e65100",
    backgroundColor: "#fff3e0",
    padding: 8,
    borderRadius: 8,
    textAlign: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#ffe0b2",
  },
  devModeCode: {
    fontFamily: "Poppins_700Bold",
    color: "#e65100",
  },
});
