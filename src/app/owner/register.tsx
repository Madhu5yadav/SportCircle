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
import { COLORS, SPACING, SHADOWS } from "../../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { CONFIG } from "../../constants/config";

export default function OwnerRegisterScreen() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);

  const handleRegister = async () => {
    if (!username.trim() || !mobile.trim() || !password.trim()) {
      Alert.alert("Required Fields", "Please fill in all the details.");
      return;
    }

    if (mobile.trim().length !== 10 || isNaN(Number(mobile))) {
      Alert.alert("Invalid Input", "Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      // Sign up with role: owner
      const response = await axios.post(`${CONFIG.API_URL}/signup`, {
        username: username.trim().toLowerCase(),
        mobile: mobile.trim(),
        password: password,
        role: "owner"
      }, { timeout: 10000 });

      // Retrieve generated OTP from response (dev fallback)
      const otpCode = response.data.otp;

      Alert.alert(
        "Verification Required",
        `OTP sent to ${mobile.trim()}. (Development code: ${otpCode})`,
        [
          { 
            text: "Proceed to Verify", 
            onPress: () => router.push({
              pathname: "/otp",
              params: { mobile: mobile.trim(), role: "owner" }
            })
          }
        ]
      );
    } catch (error: any) {
      console.log("Owner registration error:", error);
      const errorMsg = error.response?.data?.detail || "Registration failed. Try a different username or mobile.";
      Alert.alert("Registration Failed", errorMsg);
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
            <Text style={styles.portalBadge}>VENUE OWNER REGISTRATION</Text>
            <Text style={styles.subtitle}>Register your business to begin managing courts and booking requests.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Username */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Business Username</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter business/owner username"
                  placeholderTextColor={COLORS.textSecondary}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Mobile */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>10-Digit Mobile Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter contact mobile number"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  maxLength={10}
                  value={mobile}
                  onChangeText={setMobile}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Create password"
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
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.surface} />
              ) : (
                <>
                  <Text style={styles.btnText}>Register Venue</Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.surface} style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.footerLink}>
              <Text style={styles.footerText}>Already have an owner account? </Text>
              <TouchableOpacity onPress={() => router.replace("/owner/login")}>
                <Text style={styles.footerLinkText}>Login</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.btnSecondary, { marginTop: 16 }]} 
              onPress={() => router.replace("/login")}
            >
              <Ionicons name="people-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.btnSecondaryText}>Back to Player App</Text>
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
    fontSize: 11,
    color: COLORS.surface,
    backgroundColor: COLORS.success,
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
