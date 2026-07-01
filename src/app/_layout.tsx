import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Provider } from "react-redux";
import { StatusBar } from "expo-status-bar";
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import store from "../redux/store";
import { COLORS } from "../theme/theme";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: COLORS.surface,
            },
            headerTintColor: COLORS.primary,
            headerTitleStyle: {
              fontFamily: "Poppins_600SemiBold",
              color: COLORS.textPrimary,
            },
            contentStyle: {
              backgroundColor: COLORS.background,
            },
            animation: "slide_from_right",
          }}
        >
          {/* Main Onboarding & Authentication Stack */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="walkthrough" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="otp" options={{ title: "Verify OTP", headerBackTitle: "Back" }} />
          <Stack.Screen name="personal-details" options={{ title: "Personal Details", headerBackTitle: "Back", headerLeft: () => null }} />
          <Stack.Screen name="preferred-sports" options={{ title: "Preferred Sports", headerBackTitle: "Back", headerLeft: () => null }} />
          <Stack.Screen name="forgot-password" options={{ title: "Forgot Password", headerBackTitle: "Back" }} />
          <Stack.Screen name="reset-password" options={{ title: "Reset Password", headerBackTitle: "Back" }} />
          
          {/* Main App Tabs */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          
          {/* Standalone Screens */}
          <Stack.Screen name="friends" options={{ title: "Squad & Friends", headerBackTitle: "Back" }} />
          <Stack.Screen name="host-game" options={{ title: "Host a Game", headerBackTitle: "Back" }} />
          <Stack.Screen name="join-game" options={{ title: "Discover & Join Games", headerBackTitle: "Back" }} />
        </Stack>
      </Provider>
    </GestureHandlerRootView>
  );
}
