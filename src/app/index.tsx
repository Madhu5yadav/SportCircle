import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Image, Text } from "react-native";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StorageService } from "../services/storage";
import { setCredentials, logout } from "../redux/authSlice";
import { COLORS, TYPOGRAPHY } from "../theme/theme";
import api from "../services/api";
import { SocketService } from "../services/socket";

export default function EntryScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = await StorageService.getAccessToken();
        const refreshToken = await StorageService.getRefreshToken();
        
        if (token && refreshToken) {
          // Attempt to load profile from backend to verify token validity
          try {
            const response = await api.get("/profile");
            const profileData = response.data; // Includes user, wallet, settings
            
            // Populate Redux state
            dispatch(
              setCredentials({
                user: profileData.user,
                token,
                refreshToken,
                wallet: profileData.wallet,
                settings: profileData.settings,
              })
            );
            
            // Connect Socket.IO
            SocketService.connect(profileData.user.id, profileData.user.username);
            
            // Navigate based on onboarding details completion
            const hasDetails = !!(profileData.user.first_name && profileData.user.gender);
            if (hasDetails) {
              router.replace("/(tabs)/home");
            } else {
              router.replace("/personal-details");
            }
            return;
          } catch (apiError) {
            console.log("Auto-login token validation failed, logging out", apiError);
            await StorageService.clearAll();
            dispatch(logout());
          }
        }
        
        // No valid token, check if walkthrough shown
        const walkthroughShown = await AsyncStorage.getItem("walkthrough_shown");
        if (walkthroughShown === "true") {
          router.replace("/login");
        } else {
          router.replace("/walkthrough");
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
        router.replace("/login");
      } finally {
        setChecking(false);
      }
    };

    checkAuthStatus();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        {/* Generates a nice logo text or visual using styled components */}
        <Text style={styles.logoText}>Sport<Text style={styles.logoHighlight}>Circle</Text></Text>
        <Text style={styles.tagline}>Host. Join. Play. Repeat.</Text>
      </View>
      <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoText: {
    fontSize: 42,
    fontFamily: "Poppins_700Bold",
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  logoHighlight: {
    color: COLORS.primary,
  },
  tagline: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    letterSpacing: 1,
  },
  loader: {
    position: "absolute",
    bottom: 80,
  },
});
