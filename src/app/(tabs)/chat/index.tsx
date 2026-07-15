import React, { useState, useEffect, useCallback } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  TextInput,
  Alert
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useRouter, useFocusEffect } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { setRooms } from "../../../redux/chatSlice";
import { RootState } from "../../../redux/store";
import api from "../../../services/api";
import { SocketService } from "../../../services/socket";
import { COLORS, SHADOWS, SPACING } from "../../../theme/theme";

const capitalizeFirstLetter = (str?: string) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const getLastMessageContent = (lastMsg: any, currentUserId?: number) => {
  if (!lastMsg) return "No messages yet. Send a greeting!";
  const sender = lastMsg.sender_id === currentUserId 
    ? "You" 
    : capitalizeFirstLetter(lastMsg.sender_username);
  
  let body = "";
  if (lastMsg.type === "shared_profile") {
    body = "shared a profile";
  } else if (lastMsg.type === "shared_game") {
    body = "shared a game";
  } else if (lastMsg.type === "shared_venue") {
    body = "shared a venue";
  } else if (lastMsg.type === "payment") {
    body = "sent a payment request";
  } else if (lastMsg.type === "poll") {
    body = "created a poll";
  } else if (lastMsg.type === "image") {
    body = "sent an image";
  } else {
    let rawContent = lastMsg.content || "[attachment]";
    if (lastMsg.type === "text" && rawContent.startsWith('{"is_reply":true')) {
      try {
        const parsed = JSON.parse(rawContent);
        rawContent = parsed.text;
      } catch (e) {}
    }
    body = rawContent;
  }
  
  return `${sender}: ${body}`;
};

const parseUTCDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  if (dateStr.endsWith("Z") || dateStr.includes("+") || /-\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  const isoStr = dateStr.includes(" ") ? dateStr.replace(" ", "T") : dateStr;
  return new Date(`${isoStr}Z`);
};

export default function ChatListScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  const auth = useSelector((state: RootState) => state.auth);
  const { rooms } = useSelector((state: RootState) => state.chat);

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadRooms = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await api.get("/chat");
      const roomsData = response.data;
      dispatch(setRooms(roomsData));

      // Auto-join socket rooms for real-time notifications
      roomsData.forEach((room: any) => {
        SocketService.joinChat(room.id);
      });
    } catch (error) {
      console.log("Error fetching chat rooms:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRooms(false);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRooms(true);
  }, []);

  const handleDeleteRoom = async (roomId: number) => {
    const room = rooms.find((r: any) => r.id === roomId);
    if (room && room.type === "game" && !isGameExpired(room)) {
      Alert.alert(
        "Active Game Chat",
        "This game is active, so the chat cannot be deleted. If you still want to delete the chat, you must leave the game first.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Delete Chat",
      "Are you sure you want to delete this chat? This will remove you from the game/squad.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/chat/exit/${roomId}`);
              dispatch(setRooms(rooms.filter((r: any) => r.id !== roomId)));
            } catch (err) {
              Alert.alert("Error", "Could not delete/exit chat room.");
            }
          }
        }
      ]
    );
  };

  const renderRightActions = (roomId: number) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDeleteRoom(roomId)}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={22} color={COLORS.surface} />
      </TouchableOpacity>
    );
  };

  const isGameExpired = (room: any) => {
    if (room.type !== "game") return false;
    if (!room.game_date || !room.start_time) return false;
    try {
      const now = new Date();
      const [yr, mo, dy] = room.game_date.split("-").map(Number);
      const [hr, min, sec] = room.start_time.split(":").map(Number);
      const gameStart = new Date(yr, mo - 1, dy, hr, min, sec || 0);
      if (isNaN(gameStart.getTime())) return false;
      const blockTime = new Date(gameStart.getTime() + 10 * 60 * 1000);
      return now > blockTime;
    } catch (e) {
      return false;
    }
  };

  const getRoomIcon = (type: string) => {
    switch (type) {
      case "game": return "football-outline";
      case "squad": return "people-outline";
      default: return "chatbubble-ellipses-outline";
    }
  };

  const filteredRooms = rooms.filter((room: any) => {
    const roomName = room.name || `Chat #${room.id}`;
    return roomName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading && rooms.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.cardBackground} />
              <Text style={styles.emptyTitle}>No Chats Yet</Text>
              <Text style={styles.emptySubtitle}>Join a game or create a squad to start chatting with teammates!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const lastMsg = item.last_message;
            const isDirect = item.type === "direct";
            const displayName = isDirect ? capitalizeFirstLetter(item.name) : (item.name || `Group Chat`);
            
            return (
              <Swipeable
                renderRightActions={() => renderRightActions(item.id)}
                containerStyle={styles.swipeableContainer}
              >
                <TouchableOpacity
                  style={[styles.roomItem, isGameExpired(item) && styles.roomItemExpired]}
                  onPress={() => router.push(`/(tabs)/chat/${item.id}`)}
                >
                  <View style={styles.avatarWrapper}>
                    {isDirect ? (
                      <Image 
                        source={{ uri: item.other_user_profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }} 
                        style={styles.profileAvatar}
                      />
                    ) : (
                      <View style={styles.iconAvatar}>
                        <Ionicons name={getRoomIcon(item.type) as any} size={24} color={COLORS.primary} />
                      </View>
                    )}
                    <View style={[styles.typeBadge, { backgroundColor: item.type === "game" ? COLORS.primary : COLORS.success }]} />
                  </View>

                  <View style={styles.roomInfo}>
                    <View style={styles.roomHeader}>
                      <Text style={styles.roomName} numberOfLines={1}>{displayName}</Text>
                      {lastMsg && (
                        <Text style={styles.timeText}>
                          {parseUTCDate(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.lastMsgText} numberOfLines={1}>
                      {getLastMessageContent(lastMsg, auth.user?.id)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Swipeable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchHeader: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  listContainer: {
    padding: SPACING.xl,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  roomItem: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: SPACING.md,
    alignItems: "center",
    ...SHADOWS.soft,
  },
  swipeableContainer: {
    marginBottom: SPACING.md,
    borderRadius: 20,
    overflow: "hidden",
  },
  deleteAction: {
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    width: 70,
    height: "100%",
    borderRadius: 20,
  },
  roomItemExpired: {
    opacity: 0.55,
    backgroundColor: "#F5F5F5",
    borderColor: "#EAEAEA",
  },
  avatarWrapper: {
    position: "relative",
  },
  iconAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  typeBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  roomInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  roomHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roomName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.textPrimary,
    maxWidth: 200,
  },
  timeText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  lastMsgText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 100,
  },
  emptyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 40,
  },
});
