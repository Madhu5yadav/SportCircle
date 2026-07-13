import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import { RootState } from "../redux/store";
import api from "../services/api";
import { setGames } from "../redux/gameSlice";

const { width } = Dimensions.get("window");

export default function JoinGameWebScreen() {
  const dispatch = useDispatch();
  const router = useRouter();

  const auth = useSelector((state: RootState) => state.auth);
  const { games } = useSelector((state: RootState) => state.game);

  const [viewMode, setViewMode] = useState<"map" | "list">("list"); // Default to list on web
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedWebGame, setSelectedWebGame] = useState<any | null>(null);

  const loadGames = async () => {
    setLoading(true);
    try {
      const res = await api.get("/games");
      dispatch(setGames(res.data));
    } catch (err) {
      console.log("Error loading web games:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  const handleAction = async (gameId: number, isJoined: boolean) => {
    setActionLoading(gameId);
    try {
      if (isJoined) {
        await api.post(`/leave-game/${gameId}`);
        Alert.alert("Left Game", "You successfully withdrew from this match.");
      } else {
        await api.post(`/join-game/${gameId}`);
        Alert.alert("Joined!", "You successfully registered for this match.");
      }
      loadGames();
    } catch (err: any) {
      Alert.alert("Failed", err.response?.data?.detail || "Action failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const getSportIcon = (sport: string) => {
    switch (sport.toLowerCase()) {
      case "football": return "soccer";
      case "basketball": return "basketball";
      case "badminton": return "badminton";
      case "cricket": return "cricket";
      case "volleyball": return "volleyball";
      default: return "sports-club";
    }
  };

  return (
    <View style={styles.container}>
      {/* View Switcher bar */}
      <View style={styles.toggleBar}>
        <TouchableOpacity 
          style={[styles.toggleBtn, viewMode === "map" ? styles.toggleBtnActive : null]}
          onPress={() => setViewMode("map")}
        >
          <Ionicons name="map" size={16} color={viewMode === "map" ? COLORS.surface : COLORS.primary} />
          <Text style={[styles.toggleText, viewMode === "map" ? styles.toggleTextActive : null]}>Interactive Radar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toggleBtn, viewMode === "list" ? styles.toggleBtnActive : null]}
          onPress={() => setViewMode("list")}
        >
          <Ionicons name="list" size={16} color={viewMode === "list" ? COLORS.surface : COLORS.primary} />
          <Text style={[styles.toggleText, viewMode === "list" ? styles.toggleTextActive : null]}>List View</Text>
        </TouchableOpacity>
      </View>

      {/* WEB MAP VIEW (No react-native-maps dependency) */}
      {viewMode === "map" && (
        <View style={styles.webMapContainer}>
          <View style={styles.radarLayout}>
            {/* Visual Radar background grid */}
            <View style={styles.radarCircleBig} />
            <View style={styles.radarCircleMedium} />
            <View style={styles.radarCircleSmall} />
            <View style={styles.radarLineHorizontal} />
            <View style={styles.radarLineVertical} />
            <View style={styles.radarCenterDot} />

            <Text style={styles.radarOverlayText}>GPS Radar: Match Coordinates</Text>

            {/* Positioned Markers */}
            {games.map((g, index) => {
              // Convert simple random displacement for visual effect
              const offsetAngle = (index * 45) * (Math.PI / 180);
              const distanceOffset = 60 + (index * 25) % 100;
              const xPos = distanceOffset * Math.cos(offsetAngle);
              const yPos = distanceOffset * Math.sin(offsetAngle);

              return (
                <TouchableOpacity 
                  key={g.id} 
                  style={[styles.webMarker, { transform: [{ translateX: xPos }, { translateY: yPos }] }]}
                  onPress={() => setSelectedWebGame(g)}
                >
                  <MaterialCommunityIcons name={getSportIcon(g.sport_type) as any} size={16} color={COLORS.surface} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick Details overlay for selected game */}
          {selectedWebGame && (
            <View style={styles.webDetailOverlay}>
              <View style={styles.overlayHeader}>
                <Text style={styles.overlayTitle}>{selectedWebGame.name}</Text>
                <TouchableOpacity onPress={() => setSelectedWebGame(null)}>
                  <Ionicons name="close" size={18} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.overlayText}>{selectedWebGame.sport_type} • {selectedWebGame.location}</Text>
              <Text style={styles.overlaySlots}>{selectedWebGame.joined_count}/{selectedWebGame.player_count} Slots</Text>
              <TouchableOpacity 
                style={styles.overlayBtn} 
                onPress={() => {
                  setSelectedWebGame(null);
                  router.push({ pathname: "/(tabs)/explore", params: { gameId: selectedWebGame.id } });
                }}
              >
                <Text style={styles.overlayBtnText}>View Details</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <FlatList
            data={games}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="map-outline" size={48} color={COLORS.cardBackground} />
                <Text style={styles.emptyTitle}>No Games Found</Text>
                <Text style={styles.emptySubtitle}>There are no matches scheduled around your coordinates.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isJoined = item.is_joined;
              const slotsRemaining = item.player_count - item.joined_count;
              return (
                <View style={styles.gameCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.sportBadge}>
                      <Text style={styles.sportBadgeText}>{item.sport_type}</Text>
                    </View>
                    <Text style={styles.gameFee}>
                      {parseFloat(item.entry_fee.toString()) === 0 ? "Free" : `Rs. ${item.entry_fee}`}
                    </Text>
                  </View>
                  
                  <Text style={styles.gameName}>{item.name}</Text>
                  <TouchableOpacity onPress={() => router.push({ pathname: "/user-profile", params: { userId: item.host_id } })}>
                    <Text style={[styles.gameHost, { color: COLORS.primary }]}>Host: @{item.host_username}</Text>
                  </TouchableOpacity>
                  <Text style={styles.gameLoc} numberOfLines={1}><Ionicons name="location-outline" /> {item.location}</Text>
                  <Text style={styles.gameDate}><Ionicons name="calendar-outline" /> {item.game_date} • {item.start_time.slice(0,5)}</Text>
                  
                  <View style={styles.gameFooter}>
                    <Text style={styles.slotsInfo}>{item.joined_count}/{item.player_count} Players ({slotsRemaining} slots remaining)</Text>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn, 
                        isJoined ? styles.btnLeave : styles.btnJoin,
                        actionLoading === item.id ? styles.btnDisabled : null
                      ]}
                      onPress={() => handleAction(item.id, !!isJoined)}
                      disabled={actionLoading === item.id}
                    >
                      {actionLoading === item.id ? (
                        <ActivityIndicator color={COLORS.surface} size="small" />
                      ) : (
                        <Text style={styles.actionBtnText}>{isJoined ? "Leave" : "Join"}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  toggleBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    justifyContent: "center",
    gap: 12,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 6,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  toggleTextActive: {
    color: COLORS.surface,
  },
  webMapContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  radarLayout: {
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    ...SHADOWS.medium,
  },
  radarCircleBig: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderColor: COLORS.background,
    borderWidth: 1.5,
    position: "absolute",
  },
  radarCircleMedium: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderColor: COLORS.background,
    borderWidth: 1.5,
    position: "absolute",
  },
  radarCircleSmall: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderColor: COLORS.background,
    borderWidth: 1.5,
    position: "absolute",
  },
  radarLineHorizontal: {
    width: "100%",
    height: 1.5,
    backgroundColor: COLORS.background,
    position: "absolute",
  },
  radarLineVertical: {
    height: "100%",
    width: 1.5,
    backgroundColor: COLORS.background,
    position: "absolute",
  },
  radarCenterDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    position: "absolute",
  },
  radarOverlayText: {
    position: "absolute",
    bottom: 20,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  webMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    ...SHADOWS.soft,
  },
  webDetailOverlay: {
    position: "absolute",
    bottom: 40,
    width: 280,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: SPACING.md,
    ...SHADOWS.medium,
  },
  overlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overlayTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  overlayText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  overlaySlots: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 4,
  },
  overlayBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  overlayBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.surface,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  gameCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sportBadge: {
    backgroundColor: COLORS.cardBackground + "40",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  sportBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.primary,
  },
  gameFee: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.success,
  },
  gameName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  gameHost: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  gameLoc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  gameDate: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  gameFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    marginTop: 12,
  },
  slotsInfo: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textPrimary,
    maxWidth: 160,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
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
    fontSize: 12,
    color: COLORS.surface,
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
