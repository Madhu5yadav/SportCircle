import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  TextInput
} from "react-native";
import { useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS } from "../../../theme/theme";
import { RootState } from "../../../redux/store";
import api from "../../../services/api";
import { setRooms } from "../../../redux/chatSlice";
import { SocketService } from "../../../services/socket";

export default function ChatListScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  
  const auth = useSelector((state: RootState) => state.auth);
  const { rooms } = useSelector((state: RootState) => state.chat);

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const loadRooms = async () => {
    setLoading(true);
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
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.cardBackground} />
              <Text style={styles.emptyTitle}>No Chats Yet</Text>
              <Text style={styles.emptySubtitle}>Join a game or create a squad to start chatting with teammates!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const lastMsg = item.last_message;
            const displayName = item.name || `Group Chat`;
            return (
              <TouchableOpacity
                style={styles.roomItem}
                onPress={() => router.push(`/(tabs)/chat/${item.id}`)}
              >
                <View style={styles.avatarWrapper}>
                  <View style={styles.iconAvatar}>
                    <Ionicons name={getRoomIcon(item.type) as any} size={24} color={COLORS.primary} />
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: item.type === "game" ? COLORS.primary : COLORS.success }]} />
                </View>

                <View style={styles.roomInfo}>
                  <View style={styles.roomHeader}>
                    <Text style={styles.roomName} numberOfLines={1}>{displayName}</Text>
                    {lastMsg && (
                      <Text style={styles.timeText}>
                        {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.lastMsgText} numberOfLines={1}>
                    {lastMsg 
                      ? `${lastMsg.sender_username}: ${lastMsg.content || "[Image/Attachment]"}`
                      : "No messages yet. Send a greeting!"}
                  </Text>
                </View>
              </TouchableOpacity>
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
    marginBottom: SPACING.md,
    alignItems: "center",
    ...SHADOWS.soft,
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
