import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from "@expo-google-fonts/poppins";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import NotificationToast from "../components/NotificationToast";
import store from "../redux/store";
import { COLORS } from "../theme/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Automatically sync native navigation bar icon colors (light vs dark) based on app load state
  useEffect(() => {
    if (Platform.OS === "android") {
      const isAppReady = fontsLoaded || fontError;
      NavigationBar.setButtonStyleAsync(isAppReady ? "dark" : "light").catch(() => { });
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={[styles.splashContainer, { backgroundColor: COLORS.primary }]}>
        <StatusBar style="light" translucent={true} />
        <Image
          source={require("../../assets/images/splash-icon.png")}
          style={styles.splashImage}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Provider store={store}>
          <StatusBar style="light" translucent={true} />
          {/* Global Notification Toast — visible on any screen */}
          <NotificationToast />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: COLORS.primary,
              },
              headerTintColor: COLORS.surface,
              statusBarTranslucent: true,
              headerTitleStyle: {
                color: COLORS.surface,
                fontFamily: "Poppins_600SemiBold",
                fontSize: 20,
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
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="friends" options={{ title: "Squad & Friends", headerBackTitle: "Back" }} />
            <Stack.Screen name="search-users" options={{ title: "Search Users", headerBackTitle: "Back" }} />
            <Stack.Screen name="pending-requests" options={{ title: "Pending Requests", headerBackTitle: "Back" }} />
            <Stack.Screen name="host-game" options={{ title: "Host a Game", headerBackTitle: "Back" }} />
            <Stack.Screen name="join-game" options={{ title: "Discover & Join Games", headerBackTitle: "Back" }} />
          </Stack>
        </Provider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  splashImage: {
    width: 120,
    height: 120,
  },
});
