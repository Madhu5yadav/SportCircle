import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LottieView from "lottie-react-native";

import { StorageService } from "../services/storage";
import { setCredentials, logout } from "../redux/authSlice";
import { COLORS } from "../theme/theme";
import api from "../services/api";
import { SocketService } from "../services/socket";

export default function EntryScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [targetRoute, setTargetRoute] = useState<string | null>(null);
  const [animationFinished, setAnimationFinished] = useState(false);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = await StorageService.getAccessToken();
        const refreshToken = await StorageService.getRefreshToken();
        
        if (token && refreshToken) {
          try {
            const response = await api.get("/profile");
            const profileData = response.data;
            
            dispatch(
              setCredentials({
                user: profileData.user,
                token,
                refreshToken,
                wallet: profileData.wallet,
                settings: profileData.settings,
              })
            );
            
            SocketService.connect(profileData.user.id, profileData.user.username);
            
            const hasDetails = !!(profileData.user.first_name && profileData.user.gender);
            if (hasDetails) {
              setTargetRoute("/(tabs)/home");
            } else {
              setTargetRoute("/personal-details");
            }
            return;
          } catch (apiError) {
            console.log("Auto-login token validation failed, logging out", apiError);
            await StorageService.clearAll();
            dispatch(logout());
          }
        }
        
        const walkthroughShown = await AsyncStorage.getItem("walkthrough_shown");
        if (walkthroughShown === "true") {
          setTargetRoute("/login");
        } else {
          setTargetRoute("/walkthrough");
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
        setTargetRoute("/login");
      }
    };

    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (animationFinished && targetRoute) {
      router.replace(targetRoute as any);
    }
  }, [animationFinished, targetRoute]);

  return (
    <View style={styles.container}>
      <LottieView
        source={require("@/assets/Logo.json")}
        autoPlay
        loop={false}
        onAnimationFinish={() => setAnimationFinished(true)}
        style={styles.animation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  animation: {
    width: 280,
    height: 280,
  },
});
