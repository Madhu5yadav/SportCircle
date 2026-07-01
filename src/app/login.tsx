import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import { COLORS, SPACING, SHADOWS } from "../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { CONFIG } from "../constants/config";
import { StorageService } from "../services/storage";
import { setCredentials } from "../redux/authSlice";
import { SocketService } from "../services/socket";

export default function LoginScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  const [usernameOrMobile, setUsernameOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);

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
      });

      const { access_token, refresh_token } = response.data;

      // 2. Securely store Access & Refresh tokens
      await StorageService.setAccessToken(access_token);
      await StorageService.setRefreshToken(refresh_token);

      // 3. Fetch User profile details
      const profileRes = await axios.get(`${CONFIG.API_URL}/profile`, {
        headers: { Authorization: `Bearer ${access_token}` }
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
                <TouchableOpacity onPress={() => router.push("/forgot-password")}>
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
});
