import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useDispatch } from "react-redux";
import { CONFIG } from "../constants/config";
import { setCredentials } from "../redux/authSlice";
import { SocketService } from "../services/socket";
import { StorageService } from "../services/storage";
import { COLORS, SHADOWS, SPACING } from "../theme/theme";

export default function LoginScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  const [usernameOrMobile, setUsernameOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);

  // Forgot password overlay modal states
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [modalMode, setModalMode] = useState<"select" | "mobile">("select");
  const [modalCredential, setModalCredential] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  const handleForgotPasswordPress = () => {
    // Prefill with whatever they typed in the login username/mobile field
    setModalCredential(usernameOrMobile.trim());
    setModalMode("select");
    setShowForgotPasswordModal(true);
  };

  const handleLoginWithOtp = async () => {
    // If in "select" mode, check if the prefilled credential is empty. If so, transition to input mode.
    if (modalMode === "select" && !modalCredential.trim()) {
      setModalMode("mobile");
      return;
    }

    if (!modalCredential.trim()) {
      Alert.alert("Required Field", "Please enter your username or registered mobile number.");
      return;
    }

    setSendingOtp(true);
    try {
      const response = await axios.post(`${CONFIG.API_URL}/login-otp`, {
        username_or_mobile: modalCredential.trim(),
      }, { timeout: 10000 });

      setShowForgotPasswordModal(false);

      const sentMobile = response.data.mobile;
      const displayMobile = sentMobile.replace(/.(?=.{4})/g, "*"); // Mask for privacy: e.g. ******1234

      Alert.alert(
        "OTP Sent",
        `A login OTP code has been simulated for dev/testing.\nSent to: ${displayMobile}\nCode: ${response.data.otp} (Autofilled)`,
        [
          {
            text: "Verify Now",
            onPress: () => {
              router.push({
                pathname: "/otp",
                params: { mobile: sentMobile, simulatedOtp: response.data.otp }
              });
            }
          }
        ]
      );
    } catch (error: any) {
      console.log("Login OTP error detail:", error);
      if (error.response?.status === 404) {
        Alert.alert(
          "Account Not Found",
          "Credential given doesn't exist. Please sign up to create a new account.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign Up",
              onPress: () => {
                setShowForgotPasswordModal(false);
                router.replace("/signup");
              }
            }
          ]
        );
      } else {
        const errorMsg = error.response?.data?.detail || "Failed to send OTP. Please try again.";
        Alert.alert("Error", errorMsg);
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResetPassword = () => {
    setShowForgotPasswordModal(false);
    router.push("/forgot-password");
  };

  const handleLogin = async () => {
    if (!usernameOrMobile.trim() || !password.trim()) {
      Alert.alert("Required Fields", "Please enter your username/mobile and password.");
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate with credentials
      const response = await axios.post(`${CONFIG.API_URL}/login`, {
        username_or_mobile: usernameOrMobile.trim(),
        password: password,
      }, { timeout: 10000 });

      const { access_token, refresh_token } = response.data;

      // 2. Securely store Access & Refresh tokens
      await StorageService.setAccessToken(access_token);
      await StorageService.setRefreshToken(refresh_token);

      // 3. Fetch User profile details
      const profileRes = await axios.get(`${CONFIG.API_URL}/profile`, {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000
      });

      const profileData = profileRes.data;

      // 4. Update Redux store
      dispatch(
        setCredentials({
          user: profileData.user,
          token: access_token,
          refreshToken: refresh_token,
          wallet: profileData.wallet,
          settings: profileData.settings,
        })
      );

      // 5. Connect Socket.IO
      SocketService.connect(profileData.user.id, profileData.user.username);

      // 6. Navigate based on onboarding details
      const hasDetails = !!(profileData.user.first_name && profileData.user.gender);
      if (hasDetails) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/personal-details");
      }
    } catch (error: any) {
      console.log("Login error detail:", error);
      const errorMsg = error.response?.data?.detail || "Login failed. Check your credentials.";
      Alert.alert("Login Failed", errorMsg);
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
          {/* Brand Logo & Header */}
          <View style={styles.header}>
            <Text style={styles.logoText}>Sport<Text style={styles.logoHighlight}>Circle</Text></Text>
            <Text style={styles.subtitle}>Welcome back! Sign in to play sports near you.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Username / Mobile */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Username or Mobile Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Username or 10-digit mobile"
                  placeholderTextColor={COLORS.textSecondary}
                  value={usernameOrMobile}
                  onChangeText={setUsernameOrMobile}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <View style={styles.passwordHeader}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={handleForgotPasswordPress}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry={secureText}
                  value={password}
                  onChangeText={setPassword}
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

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.btn, loading ? styles.btnDisabled : null]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.surface} />
              ) : (
                <>
                  <Text style={styles.btnText}>Login</Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.surface} style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.footerLink}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.replace("/signup")}>
                <Text style={styles.footerLinkText}>Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Overlay Modal */}
      <Modal
        visible={showForgotPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {modalMode === "select" ? (
              <>
                <Text style={styles.modalTitle}>You can either</Text>

                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={handleLoginWithOtp}
                >
                  <Text style={styles.modalBtnText}>Login with OTP</Text>
                </TouchableOpacity>

                <Text style={styles.modalDividerText}>Or</Text>

                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={handleResetPassword}
                >
                  <Text style={styles.modalBtnText}>Reset Password</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowForgotPasswordModal(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Enter Credentials</Text>
                <Text style={styles.modalSubtitle}>
                  Please enter your username or registered mobile number to login via OTP.
                </Text>

                <View style={styles.modalInputContainer}>
                  <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.modalInputIcon} />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Username or registered mobile"
                    placeholderTextColor={COLORS.textSecondary}
                    autoCapitalize="none"
                    value={modalCredential}
                    onChangeText={setModalCredential}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.modalBtn, sendingOtp ? styles.modalBtnDisabled : null]}
                  onPress={handleLoginWithOtp}
                  disabled={sendingOtp}
                >
                  {sendingOtp ? (
                    <ActivityIndicator color={COLORS.surface} />
                  ) : (
                    <Text style={styles.modalBtnText}>Send OTP</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setModalMode("select")}
                  disabled={sendingOtp}
                >
                  <Text style={styles.modalCancelBtnText}>Back</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    flexGrow: 1,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoText: {
    fontSize: 42,
    fontFamily: "Poppins_700Bold",
    color: COLORS.textPrimary,
  },
  logoHighlight: {
    color: COLORS.primary,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
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
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgotText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 6,
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
    flexDirection: "row",
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
  footerLink: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
  },
  footerText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  footerLinkText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(26, 26, 26, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#F2F7FF",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    ...SHADOWS.medium,
  },
  modalTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 20,
    textAlign: "center",
  },
  modalSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  modalBtn: {
    backgroundColor: COLORS.primary,
    width: "100%",
    height: 52,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.soft,
  },
  modalBtnDisabled: {
    backgroundColor: COLORS.cardBackground,
  },
  modalBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.surface,
  },
  modalDividerText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginVertical: 12,
  },
  modalCancelBtn: {
    borderColor: "#A9C6F5",
    borderWidth: 1.5,
    backgroundColor: "#E4EEFD",
    width: "100%",
    height: 52,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  modalCancelBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.primary,
  },
  modalInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 16,
    width: "100%",
    ...SHADOWS.soft,
  },
  modalInputIcon: {
    marginRight: 10,
  },
  modalInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: COLORS.textPrimary,
    height: "100%",
  },
});
