import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../theme/theme";
import { Platform, Image, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/store";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 10;
  const tabHeight = 54 + bottomPadding;
  const user = useSelector((state: RootState) => state.auth.user);
  const profilePic = user?.profile_pic;

  return (
    <Tabs
      screenOptions={{
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1.5,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 10,
          elevation: 8,
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontFamily: "Poppins_500Medium",
          fontSize: 11,
        },
        headerStyle: {
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1.5,
          borderBottomColor: COLORS.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontFamily: "Poppins_600SemiBold",
          fontSize: 18,
          color: COLORS.textPrimary,
        },
        headerTintColor: COLORS.primary,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          headerShown: false, // Custom header on home screen
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "home" : "home-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          headerTitle: "Search & Filter",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "search" : "search-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat/index"
        options={{
          title: "Chat",
          headerTitle: "My Group Chats",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "chatbubbles" : "chatbubbles-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      {/* Hide dynamic chat room from bottom tab navigation */}
      <Tabs.Screen
        name="chat/[roomId]"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="booking/index"
        options={{
          title: "Booking",
          headerTitle: "Discover Turfs",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "calendar" : "calendar-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => {
            if (profilePic) {
              return (
                <View style={[
                  styles.profileIconContainer, 
                  focused && styles.profileIconContainerActive
                ]}>
                  <Image 
                    source={{ uri: profilePic }} 
                    style={styles.profileIcon} 
                  />
                </View>
              );
            }
            return (
              <Ionicons 
                name={focused ? "person" : "person-outline"} 
                size={24} 
                color={color} 
              />
            );
          },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  profileIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  profileIconContainerActive: {
    borderColor: COLORS.primary,
  },
  profileIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});
