import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  ScrollView,
  Alert
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../../theme/theme";
import { RootState } from "../../redux/store";
import api from "../../services/api";
import { setGames } from "../../redux/gameSlice";

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "All"];
const SPORTS = ["Cricket", "Football", "Basketball", "Badminton", "Volleyball", "Tennis", "All"];
const TIME_SLOTS = ["Morning", "Afternoon", "Evening", "Night", "All"];

export default function ExploreScreen() {
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{ gameId?: string }>();
  
  const auth = useSelector((state: RootState) => state.auth);
  const { games } = useSelector((state: RootState) => state.game);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState("All");
  const [selectedSkill, setSelectedSkill] = useState("All");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("All");
  const [maxDistance, setMaxDistance] = useState<number>(20); // km

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // If a specific game ID is passed, highlight or filter for it
  useEffect(() => {
    if (params.gameId) {
      setSearchQuery(`Game ID: ${params.gameId}`);
      // Find game and auto-scroll/focus
    }
  }, [params.gameId]);

  const loadGames = async () => {
    setLoading(true);
    try {
      const response = await api.get("/games", {
        params: {
          lat: auth.user?.latitude || 12.9716,
          lng: auth.user?.longitude || 77.5946,
          max_distance_km: maxDistance
        }
      });
      dispatch(setGames(response.data));
    } catch (error) {
      console.log("Error fetching games in explore:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, [selectedSport, maxDistance]);

  const handleJoinLeaveGame = async (gameId: number, isJoined: boolean) => {
    setActionLoading(gameId);
    try {
      if (isJoined) {
        // Leave game
        await api.post(`/leave-game/${gameId}`);
        Alert.alert("Success", "You left the game.");
      } else {
        // Join game
        await api.post(`/join-game/${gameId}`);
        Alert.alert("Joined!", "You have successfully joined the game. You have been added to the game group chat.");
      }
      // Reload games to sync state
      await loadGames();
    } catch (error: any) {
      Alert.alert("Failed", error.response?.data?.detail || "Action failed.");
    } finally {
      setActionLoading(null);
    }
  };

  // Filter local results based on state
  const filteredResults = games.filter((game) => {
    // Search query match
    const matchesSearch = 
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (params.gameId && searchQuery.includes(game.id.toString()));

    // Sport filter
    const matchesSport = selectedSport === "All" || game.sport_type.toLowerCase() === selectedSport.toLowerCase();

    // Skill filter
    // For description matching skill level or default matches
    const matchesSkill = selectedSkill === "All" || 
      (game.description && game.description.toLowerCase().includes(selectedSkill.toLowerCase())) ||
      game.name.toLowerCase().includes(selectedSkill.toLowerCase());

    // Time slot match
    const gameHour = parseInt(game.start_time.split(":")[0]);
    let gameSlot = "Night";
    if (5 <= gameHour && gameHour < 12) gameSlot = "Morning";
    else if (12 <= gameHour && gameHour < 17) gameSlot = "Afternoon";
    else if (17 <= gameHour && gameHour < 21) gameSlot = "Evening";

    const matchesTime = selectedTimeSlot === "All" || gameSlot === selectedTimeSlot;

    return matchesSearch && matchesSport && matchesSkill && matchesTime;
  });

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search games, sports, venues..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters Drawer (Scrollable Row) */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {/* Sports Selector */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Sport:</Text>
            {SPORTS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.filterTag, selectedSport === s ? styles.tagActive : null]}
                onPress={() => setSelectedSport(s)}
              >
                <Text style={[styles.tagText, selectedSport === s ? styles.tagTextActive : null]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {/* Time Slot Selector */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Time Slot:</Text>
            {TIME_SLOTS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.filterTag, selectedTimeSlot === t ? styles.tagActive : null]}
                onPress={() => setSelectedTimeSlot(t)}
              >
                <Text style={[styles.tagText, selectedTimeSlot === t ? styles.tagTextActive : null]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Games List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Searching games...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={COLORS.cardBackground} />
              <Text style={styles.emptyTitle}>No Games Found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search keywords or filter settings.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isJoined = item.is_joined;
            const slotsLeft = item.player_count - item.joined_count;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.gameName}>{item.name}</Text>
                    <View style={styles.sportInfo}>
                      <MaterialCommunityIcons name="soccer" size={14} color={COLORS.primary} />
                      <Text style={styles.sportText}>{item.sport_type}</Text>
                    </View>
                  </View>
                  <View style={styles.feeBadge}>
                    <Text style={styles.feeText}>
                      {parseFloat(item.entry_fee.toString()) === 0 ? "Free" : `Rs. ${item.entry_fee}`}
                    </Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.cardBody}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>{item.game_date}  •  {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailText} numberOfLines={1}>{item.location}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>Host: @{item.host_username}</Text>
                  </View>
                </View>

                {/* Footer Controls */}
                <View style={styles.cardFooter}>
                  <View style={styles.slotsWrapper}>
                    <Ionicons name="people-outline" size={16} color={COLORS.textPrimary} />
                    <Text style={styles.slotsText}>
                      {item.joined_count}/{item.player_count} Joined ({slotsLeft} left)
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      isJoined ? styles.btnLeave : styles.btnJoin,
                      actionLoading === item.id ? styles.btnDisabled : null
                    ]}
                    onPress={() => handleJoinLeaveGame(item.id, !!isJoined)}
                    disabled={actionLoading === item.id}
                  >
                    {actionLoading === item.id ? (
                      <ActivityIndicator size="small" color={COLORS.surface} />
                    ) : (
                      <Text style={styles.actionBtnText}>{isJoined ? "Leave" : "Join Game"}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
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
    height: 48,
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
  filtersWrapper: {
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  filterScroll: {
    paddingHorizontal: SPACING.xl,
  },
  filterGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterGroupLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  filterTag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tagText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tagTextActive: {
    color: COLORS.surface,
    fontFamily: "Poppins_600SemiBold",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  listContainer: {
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  gameName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  sportInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  sportText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  feeBadge: {
    backgroundColor: COLORS.cardBackground + "40",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  feeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  cardBody: {
    marginVertical: 14,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  slotsWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  slotsText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnJoin: {
    backgroundColor: COLORS.primary,
  },
  btnLeave: {
    backgroundColor: COLORS.error,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  actionBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.surface,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 80,
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
    marginTop: 4,
    paddingHorizontal: 40,
  },
});
