import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RootState } from "../redux/store";
import { dismissToast } from "../redux/notificationSlice";
import { COLORS, SPACING, SHADOWS } from "../theme/theme";

const TOAST_DURATION = 4500; // auto-dismiss after 4.5 seconds

// Map notification type to an icon
const getNotificationIcon = (type?: string): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case "friend_request":
      return "person-add";
    case "game_request":
    case "game_accepted":
      return "football";
    case "booking_confirm":
    case "booking_reminder":
      return "calendar";
    case "chat_message":
      return "chatbubble";
    case "squad_invite":
      return "people";
    default:
      return "notifications";
  }
};

export default function NotificationToast() {
  const dispatch = useDispatch();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useSelector((state: RootState) => state.notification.toast);

  // Track the current toast _key to detect new toasts
  const [activeToast, setActiveToast] = useState<typeof toast>(null);
  const translateY = useRef(new Animated.Value(-200)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDismissingRef = useRef(false);

  useEffect(() => {
    if (toast && toast._key) {
      // Clear any pending dismiss timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Reset animated values instantly for the new toast
      translateY.setValue(-200);
      opacity.setValue(0);
      isDismissingRef.current = false;

      // Set active toast data
      setActiveToast(toast);

      // Slide in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss timer
      timerRef.current = setTimeout(() => {
        animateOut();
      }, TOAST_DURATION);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast?._key]); // Re-run only when _key changes (new toast)

  const animateOut = () => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveToast(null);
      dispatch(dismissToast());
    });
  };

  const handlePress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    animateOut();
    // Navigate to notifications screen
    setTimeout(() => {
      router.push("/notifications");
    }, 150);
  };

  const handleClose = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    animateOut();
  };

  // Don't render if there's no active toast
  if (!activeToast) return null;

  const topOffset =
    insets.top > 0 ? insets.top + 4 : Platform.OS === "android" ? 40 : 20;
  const iconName = getNotificationIcon(activeToast.type);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topOffset,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toastContent}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        {/* Icon */}
        <View style={styles.iconWrapper}>
          <Ionicons name={iconName} size={22} color={COLORS.surface} />
        </View>

        {/* Text */}
        <View style={styles.textContainer}>
          <Text style={styles.toastLabel}>SportCircle</Text>
          <Text style={styles.title} numberOfLines={1}>
            {activeToast.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {activeToast.message}
          </Text>
        </View>

        {/* Close */}
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 99999,
    elevation: 9999,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.md,
    paddingRight: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primary + "30",
    ...SHADOWS.medium,
  },
  iconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  textContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  toastLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  message: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
    lineHeight: 17,
  },
  closeBtn: {
    padding: 4,
  },
});
