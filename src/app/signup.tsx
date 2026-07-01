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
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { CONFIG } from "../constants/config";

// Validation Schema
const signupSchema = yup.object({
  username: yup
    .string()
    .required("Username is required")
    .min(3, "Username must be at least 3 characters"),
  mobile: yup
    .string()
    .required("Mobile number is required")
    .matches(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits"),
  password: yup
    .string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(/[A-Z]/, "Must contain at least one uppercase letter")
    .matches(/[a-z]/, "Must contain at least one lowercase letter")
    .matches(/[0-9]/, "Must contain at least one number")
    .matches(/[^A-Za-z0-9]/, "Must contain at least one special character"),
  confirmPassword: yup
    .string()
    .required("Please confirm your password")
    .oneOf([yup.ref("password")], "Passwords must match"),
});

export default function SignupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);
  const [secureConfirmText, setSecureConfirmText] = useState(true);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(signupSchema),
    defaultValues: {
      username: "",
      mobile: "",
      password: "",
      confirmPassword: "",
    }
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const response = await axios.post(`${CONFIG.API_URL}/signup`, {
        username: data.username.trim(),
        mobile: data.mobile.trim(),
        password: data.password,
      });

      Alert.alert(
        "Verification Required", 
        "A verification OTP has been sent to your mobile number.",
        [
          { 
            text: "Verify Now", 
            onPress: () => router.push({ pathname: "/otp", params: { mobile: data.mobile } }) 
          }
        ]
      );
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Signup failed. Please try again.";
      Alert.alert("Signup Failed", errorMsg);
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
          {/* Logo & Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join SportCircle today and start playing!</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Username */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="username"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., madhu_yadav"
                      placeholderTextColor={COLORS.textSecondary}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      autoCapitalize="none"
                    />
                  )}
                />
              </View>
              {errors.username && <Text style={styles.errorText}>{errors.username.message}</Text>}
            </View>

            {/* Mobile */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="mobile"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 9876543210"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="numeric"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
              </View>
              {errors.mobile && <Text style={styles.errorText}>{errors.mobile.message}</Text>}
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="Min 8 chars, A-Z, a-z, 0-9, @..."
                      placeholderTextColor={COLORS.textSecondary}
                      secureTextEntry={secureText}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      autoCapitalize="none"
                    />
                  )}
                />
                <TouchableOpacity onPress={() => setSecureText(!secureText)}>
                  <Ionicons 
                    name={secureText ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={COLORS.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="Re-enter password"
                      placeholderTextColor={COLORS.textSecondary}
                      secureTextEntry={secureConfirmText}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      autoCapitalize="none"
                    />
                  )}
                />
                <TouchableOpacity onPress={() => setSecureConfirmText(!secureConfirmText)}>
                  <Ionicons 
                    name={secureConfirmText ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={COLORS.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>}
            </View>

            {/* Submit */}
            <TouchableOpacity 
              style={[styles.btn, loading ? styles.btnDisabled : null]} 
              onPress={handleSubmit(onSubmit)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.surface} />
              ) : (
                <>
                  <Text style={styles.btnText}>Register & Send OTP</Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.surface} style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>

            {/* Link to Login */}
            <View style={styles.footerLink}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace("/login")}>
                <Text style={styles.footerLinkText}>Login</Text>
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
    paddingVertical: SPACING.xxl,
  },
  header: {
    alignItems: "center",
    marginVertical: 20,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 28,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  form: {
    marginTop: 20,
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
  errorText: {
    color: COLORS.error,
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    marginTop: 4,
    paddingLeft: 4,
  },
  btn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
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
