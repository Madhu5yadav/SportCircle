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
import { COLORS, SPACING, SHADOWS } from "../../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { CONFIG } from "../../constants/config";
import { StorageService } from "../../services/storage";
import { setCredentials } from "../../redux/authSlice";
import { SocketService } from "../../services/socket";

export default function OwnerLoginScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  const [usernameOrMobile, setUsernameOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);

  const handleLogin = async () => {
    if (!usernameOrMobile.trim() || !password.trim()) {
      Alert.alert("Required Fields", "Please enter your credentials.");
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate
      const response = await axios.post(`${CONFIG.API_URL}/login`, {
        username_or_mobile: usernameOrMobile.trim(),
        password: password,
      }, { timeout: 10000 });

      const { access_token, refresh_token } = response.data;

      // 2. Store tokens
      await StorageService.setAccessToken(access_token);
      await StorageService.setRefreshToken(refresh_token);

      // 3. Fetch Profile details
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

      // 6. Navigate to Owner Dashboard
      router.replace("/owner/dashboard");
    } catch (error: any) {
      console.log("Owner login error:", error);
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logoText}>Sport<Text style={styles.logoHighlight}>Circle</Text></Text>
            <Text style={styles.portalBadge}>OWNER PORTAL</Text>
            <Text style={styles.subtitle}>Manage your sports venues and booking schedules.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Username or Mobile</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter username or mobile"
                  placeholderTextColor={COLORS.textSecondary}
                  value={usernameOrMobile}
                  onChangeText={setUsernameOrMobile}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Password</Text>
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
                  <Ionicons name={secureText ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.btn, loading ? styles.btnDisabled : null]} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.surface} />
              ) : (
                <>
                  <Text style={styles.btnText}>Owner Login</Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.surface} style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.footerLink}>
              <Text style={styles.footerText}>Don't have an owner account? </Text>
              <TouchableOpacity onPress={() => router.replace("/owner/register")}>
                <Text style={styles.footerLinkText}>Register Venue</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.btnSecondary, { marginTop: 16 }]} 
              onPress={() => router.replace("/login")}
            >
              <Ionicons name="people-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.btnSecondaryText}>Go to Player App</Text>
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
    flexGrow: 1,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  logoText: {
    fontSize: 42,
    fontFamily: "Poppins_700Bold",
    color: COLORS.textPrimary,
  },
  logoHighlight: {
    color: COLORS.primary,
  },
  portalBadge: {
    fontFamily: "Poppins_700Bold",
    fontSize: 12,
    color: COLORS.surface,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 6,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
    textAlign: "center",
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
  btnSecondary: {
    flexDirection: "row",
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
  },
  footerLink: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
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
