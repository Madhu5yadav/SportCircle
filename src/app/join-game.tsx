import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Alert,
  Dimensions
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import { RootState } from "../redux/store";
import api from "../services/api";
import { setGames } from "../redux/gameSlice";

const { width, height } = Dimensions.get("window");

export default function JoinGameScreen() {
  const dispatch = useDispatch();
  const router = useRouter();

  const auth = useSelector((state: RootState) => state.auth);
  const { games } = useSelector((state: RootState) => state.game);
  
  const now = new Date();
  const activeGames = (games || []).filter((g: any) => {
    try {
      if (!g.game_date || !g.start_time) return false;
      const gameStart = new Date(`${g.game_date}T${g.start_time}`);
      return gameStart.getTime() > now.getTime();
    } catch (e) {
      return false;
    }
  });

  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Default region: user's location or Bangalore default
  const [region, setRegion] = useState({
    latitude: auth.user?.latitude || 12.9716,
    longitude: auth.user?.longitude || 77.5946,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  const loadGames = async () => {
    setLoading(true);
    try {
      const res = await api.get("/games");
      dispatch(setGames(res.data));
    } catch (err) {
      console.log("Error loading map games:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
    if (auth.user?.latitude && auth.user?.longitude) {
      setRegion({
        latitude: auth.user.latitude,
        longitude: auth.user.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      });
    }
  }, [auth.user]);

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
          <Text style={[styles.toggleText, viewMode === "map" ? styles.toggleTextActive : null]}>Map View</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toggleBtn, viewMode === "list" ? styles.toggleBtnActive : null]}
          onPress={() => setViewMode("list")}
        >
          <Ionicons name="list" size={16} color={viewMode === "list" ? COLORS.surface : COLORS.primary} />
          <Text style={[styles.toggleText, viewMode === "list" ? styles.toggleTextActive : null]}>List View</Text>
        </TouchableOpacity>
      </View>

      {/* MAP VIEW */}
      {viewMode === "map" && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={region}
            showsUserLocation
            showsMyLocationButton
          >
            {activeGames.map((g) => {
              if (!g.latitude || !g.longitude) return null;
              return (
                <Marker
                  key={g.id}
                  coordinate={{ latitude: g.latitude, longitude: g.longitude }}
                  pinColor={COLORS.primary}
                >
                  <View style={styles.customMarker}>
                    <MaterialCommunityIcons name={getSportIcon(g.sport_type) as any} size={18} color={COLORS.surface} />
                  </View>
                  <Callout tooltip onPress={() => router.push({ pathname: "/(tabs)/explore", params: { gameId: g.id } })}>
                    <View style={styles.calloutCard}>
                      <Text style={styles.calloutTitle}>{g.name}</Text>
                      <Text style={styles.calloutSubtitle}>{g.sport_type} • {g.joined_count}/{g.player_count} Joined</Text>
                      <Text style={styles.calloutAction}>Tap to view details</Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>
        </View>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <FlatList
            data={activeGames}
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
  mapContainer: {
    flex: 1,
  },
  map: {
    width: width,
    height: height - 128,
  },
  customMarker: {
    backgroundColor: COLORS.primary,
    padding: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
    ...SHADOWS.soft,
  },
  calloutCard: {
    width: 180,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  calloutTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  calloutSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  calloutAction: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: COLORS.primary,
    marginTop: 6,
    textAlign: "right",
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
