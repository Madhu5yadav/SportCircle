import React, { useState, useEffect } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useDispatch } from "react-redux";
import { COLORS, SPACING, SHADOWS } from "../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { CONFIG } from "../constants/config";
import { StorageService } from "../services/storage";
import { setCredentials } from "../redux/authSlice";
import { SocketService } from "../services/socket";

export default function OTPScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { mobile, simulatedOtp } = useLocalSearchParams<{ mobile: string; simulatedOtp?: string }>();

  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(30);

  // Pre-fill simulated OTP in dev/testing mode
  useEffect(() => {
    if (simulatedOtp) {
      setOtpCode(simulatedOtp);
    }
  }, [simulatedOtp]);

  // Countdown timer for resending OTP
  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleVerify = async () => {
    if (otpCode.length !== 6) {
      Alert.alert("Invalid Code", "Please enter a valid 6-digit OTP code.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${CONFIG.API_URL}/verify-otp`, {
        mobile,
        otp_code: otpCode,
      }, { timeout: 10000 });

      const { tokens, verified } = response.data;
      if (verified && tokens) {
        // Securely store Access & Refresh tokens
        await StorageService.setAccessToken(tokens.access_token);
        await StorageService.setRefreshToken(tokens.refresh_token);

        // Fetch User profile to populate details
        const profileRes = await axios.get(`${CONFIG.API_URL}/profile`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          timeout: 10000
        });

        const profileData = profileRes.data;

        // Populate Redux store
        dispatch(
          setCredentials({
            user: profileData.user,
            token: tokens.access_token,
            refreshToken: tokens.refresh_token,
            wallet: profileData.wallet,
            settings: profileData.settings
          })
        );

        // Connect Socket.IO
        SocketService.connect(profileData.user.id, profileData.user.username);

        const hasDetails = !!(profileData.user.first_name && profileData.user.gender);

        Alert.alert("Success", "Mobile number verified successfully!", [
          {
            text: "Continue",
            onPress: () => {
              if (hasDetails) {
                router.replace("/(tabs)/home");
              } else {
                router.replace("/personal-details");
              }
            }
          }
        ]);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "OTP verification failed. Please check the code.";
      Alert.alert("Verification Failed", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await axios.post(`${CONFIG.API_URL}/send-otp`, { mobile }, { timeout: 10000 });
      const newOtp = response.data.otp;
      
      if (newOtp) {
        setOtpCode(newOtp);
        Alert.alert(
          "OTP Sent",
          `A new OTP code has been simulated for dev/testing.\nCode: ${newOtp} (Autofilled)`
        );
      } else {
        Alert.alert("OTP Sent", "A new OTP code has been sent to your mobile number.");
      }
      setTimer(30);
    } catch (error: any) {
      Alert.alert("Failed to Send", "Could not resend OTP. Please try again.");
    } finally {
      setResending(false);
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
              <Ionicons name="shield-checkmark-outline" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Enter OTP Code</Text>
            <Text style={styles.subtitle}>
              We have sent a 6-digit verification code to{"\n"}
              <Text style={styles.boldText}>+91 {mobile}</Text>
            </Text>
          </View>

          {/* OTP Input */}
          <View style={styles.form}>
            <TextInput
              style={[styles.otpInput, { letterSpacing: 15 }]}
              placeholder="0 0 0 0 0 0"
              placeholderTextColor={COLORS.cardBackground}
              maxLength={6}
              keyboardType="numeric"
              value={otpCode}
              onChangeText={setOtpCode}
              textAlign="center"
              autoFocus
            />

            {simulatedOtp && (
              <Text style={styles.devModeText}>
                ⚠️ Dev Mode: Simulated OTP is <Text style={styles.devModeCode}>{simulatedOtp}</Text> (Autofilled)
              </Text>
            )}

            <TouchableOpacity 
              style={[styles.btn, loading ? styles.btnDisabled : null]}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.surface} />
              ) : (
                <Text style={styles.btnText}>Verify & Proceed</Text>
              )}
            </TouchableOpacity>

            {/* Resend Timer / Link */}
            <View style={styles.resendContainer}>
              {timer > 0 ? (
                <Text style={styles.timerText}>Resend code in {timer}s</Text>
              ) : (
                <TouchableOpacity onPress={handleResend} disabled={resending}>
                  {resending ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Text style={styles.resendLink}>Resend OTP Code</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
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
  boldText: {
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.textPrimary,
  },
  form: {
    marginTop: 10,
  },
  otpInput: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 16,
    height: 64,
    fontSize: 24,
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.primary,
    marginBottom: 30,
    ...SHADOWS.soft,
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
  resendContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  timerText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  resendLink: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
  },
  devModeText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#e65100",
    backgroundColor: "#fff3e0",
    padding: 10,
    borderRadius: 8,
    textAlign: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ffe0b2",
  },
  devModeCode: {
    fontFamily: "Poppins_700Bold",
    color: "#e65100",
  },
});
