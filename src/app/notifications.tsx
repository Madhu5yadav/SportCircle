import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import {
  deleteNotification,
  markAllAsRead,
  markAsRead,
  NotificationItem,
  setNotifications,
} from "../redux/notificationSlice";
import { RootState } from "../redux/store";
import api from "../services/api";
import { COLORS, SHADOWS, SPACING } from "../theme/theme";

// ──────────────────── Helpers ────────────────────

const getNotificationIcon = (type: string): keyof typeof Ionicons.glyphMap => {
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

const getIconColor = (type: string): string => {
  switch (type) {
    case "friend_request":
      return "#7C4DFF";
    case "game_request":
    case "game_accepted":
      return COLORS.primary;
    case "booking_confirm":
    case "booking_reminder":
      return "#FF9800";
    case "chat_message":
      return "#00BCD4";
    case "squad_invite":
      return "#4CAF50";
    default:
      return COLORS.primary;
  }
};

type GroupedSection = {
  title: string;
  data: NotificationItem[];
};

const parseUTCDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  if (dateStr.endsWith("Z") || dateStr.includes("+") || /-\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  const isoStr = dateStr.includes(" ") ? dateStr.replace(" ", "T") : dateStr;
  return new Date(`${isoStr}Z`);
};

const groupNotificationsByDate = (
  notifications: NotificationItem[]
): GroupedSection[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);

  const groups: { [key: string]: NotificationItem[] } = {
    Today: [],
    Yesterday: [],
    "Last 7 Days": [],
    Older: [],
  };

  notifications.forEach((n) => {
    const created = parseUTCDate(n.created_at);
    if (created >= today) {
      groups["Today"].push(n);
    } else if (created >= yesterday) {
      groups["Yesterday"].push(n);
    } else if (created >= lastWeek) {
      groups["Last 7 Days"].push(n);
    } else {
      groups["Older"].push(n);
    }
  });

  // Only return non-empty groups
  const order = ["Today", "Yesterday", "Last 7 Days", "Older"];
  return order
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ title: key, data: groups[key] }));
};

// ──────────────────── Screen ────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const notifications = useSelector(
    (state: RootState) => state.notification.notifications
  );
  const unreadCount = useSelector(
    (state: RootState) => state.notification.unreadCount
  );
  const auth = useSelector((state: RootState) => state.auth);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications");
      dispatch(setNotifications(res.data));
    } catch (error) {
      console.log("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    };
    load();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.put("/notifications/read");
      dispatch(markAllAsRead());
    } catch (error) {
      console.log("Error marking all as read:", error);
    }
  };

  const handleDeleteNotification = async (id: number) => {
    try {
      await api.delete(`/notification/${id}`);
      dispatch(deleteNotification(id));
    } catch (error) {
      console.log("Error deleting notification:", error);
    }
  };

  const renderRightActions = (id: number) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDeleteNotification(id)}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={22} color={COLORS.surface} />
      </TouchableOpacity>
    );
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    // Mark individual as read
    if (!item.is_read) {
      try {
        await api.put(`/notification/${item.id}/read`);
        dispatch(markAsRead(item.id));
      } catch (error) {
        console.log("Error marking notification as read:", error);
      }
    }

    // Navigate based on type
    switch (item.type) {
      case "friend_request":
        router.push("/pending-requests");
        break;
      case "game_request":
      case "game_accepted":
        router.push("/(tabs)/explore");
        break;
      case "booking_confirm":
      case "booking_reminder":
        router.push("/(tabs)/booking");
        break;
      case "chat_message":
        router.push("/(tabs)/chat");
        break;
      case "squad_invite":
        router.push("/friends");
        break;
      default:
        break;
    }
  };

  const groupedSections = groupNotificationsByDate(notifications);

  // Build a flat list with section headers interleaved
  type ListItem =
    | { kind: "header"; title: string; key: string }
    | { kind: "notification"; item: NotificationItem; key: string };

  const flatData: ListItem[] = [];
  groupedSections.forEach((section) => {
    flatData.push({
      kind: "header",
      title: section.title,
      key: `header-${section.title}`,
    });
    section.data.forEach((item) => {
      flatData.push({
        kind: "notification",
        item,
        key: `notif-${item.id}`,
      });
    });
  });

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.kind === "header") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{item.title}</Text>
        </View>
      );
    }

    const notif = item.item;
    const isSquadInvite = notif.type === "squad_invite";
    const iconName = getNotificationIcon(notif.type);
    const iconColor = getIconColor(notif.type);

    // Extract squad_id and clean message if squad_invite
    let cleanMessage = notif.message;
    let squadId: number | null = null;
    if (isSquadInvite) {
      const squadIdMatch = notif.message.match(/\[squad_id:(\d+)\]/);
      squadId = squadIdMatch ? parseInt(squadIdMatch[1]) : null;
      cleanMessage = notif.message.replace(/\s*\[squad_id:\d+\]/, "");
    }

    const handleRespond = async (action: "accept" | "reject") => {
      if (!squadId) return;
      try {
        if (action === "accept") {
          // Check if user is already in a squad
          const squadsRes = await api.get("/squads");
          const acceptedSquad = (squadsRes.data || []).find((sq: any) => {
            const selfMember = sq.members.find((m: any) => m.user_id === auth.user?.id);
            return selfMember && selfMember.status === "accepted";
          });

          if (acceptedSquad) {
            // User is already in an active squad! Show Alert with leave button!
            Alert.alert(
              "Switch Squad?",
              `You are already a member of '${acceptedSquad.name}'. Leave '${acceptedSquad.name}' and join this squad?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Leave & Join",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      // 1. Leave previous squad
                      await api.delete(`/leave-squad/${acceptedSquad.id}`);
                      // 2. Accept new squad
                      await api.post(`/squads/invitation/${squadId}/respond`, { action: "accept" });
                      Alert.alert("Success", "Left previous squad and joined the new squad!");
                      // 3. Remove notification completely
                      await api.delete(`/notification/${notif.id}`);
                      dispatch(deleteNotification(notif.id));
                      onRefresh();
                      router.push("/friends");
                    } catch (e) {
                      Alert.alert("Error", "Could not switch squads.");
                    }
                  }
                }
              ]
            );
            return;
          }
        }

        // Direct action
        await api.post(`/squads/invitation/${squadId}/respond`, { action });
        Alert.alert("Success", `Squad invitation ${action}ed!`);

        // Remove notification completely from database & redux
        await api.delete(`/notification/${notif.id}`);
        dispatch(deleteNotification(notif.id));
        onRefresh();

        if (action === "accept") {
          router.push("/friends");
        }
      } catch (err) {
        Alert.alert("Error", "Could not respond to invitation.");
      }
    };

    return (
      <Swipeable
        renderRightActions={() => renderRightActions(notif.id)}
        containerStyle={styles.swipeableContainer}
      >
        <TouchableOpacity
          style={[
            styles.notifCard,
            !notif.is_read && styles.notifCardUnread,
            isSquadInvite && { alignItems: "flex-start" }
          ]}
          onPress={() => handleNotificationPress(notif)}
          activeOpacity={0.7}
        >
          {/* Icon */}
          <View style={[styles.notifIconWrapper, { backgroundColor: iconColor + "18" }]}>
            <Ionicons name={iconName} size={22} color={iconColor} />
          </View>

          {/* Content */}
          <View style={styles.notifContent}>
            <Text style={styles.notifTitle} numberOfLines={2}>
              {notif.title}
            </Text>
            <Text style={styles.notifMessage} numberOfLines={3}>
              {cleanMessage}
            </Text>
            
            {isSquadInvite && squadId && (
              <View style={styles.notifActionsRow}>
                <TouchableOpacity
                  style={[styles.smallBtn, styles.acceptBtn]}
                  onPress={() => handleRespond("accept")}
                >
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallBtn, styles.rejectBtn]}
                  onPress={() => handleRespond("reject")}
                >
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.notifTime}>
              {formatTimeAgo(notif.created_at)}
            </Text>
          </View>

          {/* Unread dot */}
          {!notif.is_read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent={true} />
      {/* Header */}
      <View style={[styles.header, {
        height: 60 + insets.top,
        paddingTop: insets.top
      }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.surface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={handleMarkAllRead}
            >
              <Ionicons
                name="checkmark-done"
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrapper}>
            <Ionicons
              name="notifications-off-outline"
              size={56}
              color={COLORS.cardBackground}
            />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            When you receive notifications, they'll appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
        />
      )}
    </View>
  );
}

// ──────────────────── Utility ────────────────────

function formatTimeAgo(dateStr: string): string {
  const date = parseUTCDate(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

// ──────────────────── Styles ────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    ...SHADOWS.medium,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 20,
    color: COLORS.surface,
  },
  headerRight: {
    width: 38,
    alignItems: "flex-end",
  },
  markAllBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: COLORS.primary,
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  notifCardUnread: {
    borderColor: COLORS.primary + "40",
    backgroundColor: "#F0F6FF",
  },
  swipeableContainer: {
    marginBottom: SPACING.sm,
    borderRadius: 16,
    overflow: "hidden",
  },
  deleteAction: {
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    width: 60,
    height: "100%",
    borderRadius: 16,
  },
  notifIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  notifContent: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  notifTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  notifMessage: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  notifTime: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.cardBackground + "40",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  emptyTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  notifActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  smallBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
  },
  acceptBtn: {
    backgroundColor: COLORS.primary,
  },
  acceptBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.surface,
  },
  rejectBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  rejectBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.error,
  },
});
