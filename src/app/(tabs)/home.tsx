import React, { useState, useEffect, useCallback } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  FlatList, 
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  SafeAreaView
} from "react-native";
import { useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons, FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY, SIZES } from "../../theme/theme";
import { RootState } from "../../redux/store";
import api from "../../services/api";
import { setGames } from "../../redux/gameSlice";
import { setFriends } from "../../redux/friendSlice";
import { updateWallet } from "../../redux/authSlice";

const { width } = Dimensions.get("window");
const CAROUSEL_WIDTH = width - SPACING.xl * 2;

// Unsplash sports photos for stunning visuals
const SPONSOR_BANNERS = [
  { id: 1, title: "Summer Football Cup '26", subtitle: "Register your squad & win Rs. 25,000!", image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=600&auto=format&fit=crop" },
  { id: 2, title: "Badminton Doubles Clash", subtitle: "20% off booking fees this weekend", image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600&auto=format&fit=crop" },
  { id: 3, title: "Weekly Cricket League", subtitle: "Host a match & earn double rewards", image: "https://images.unsplash.com/photo-1531415080290-bc98545ab2ef?q=80&w=600&auto=format&fit=crop" },
];

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  
  const auth = useSelector((state: RootState) => state.auth);
  const game = useSelector((state: RootState) => state.game);
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);
  
  // Custom Data States
  const [nearbyGames, setNearbyGames] = useState<any[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<any[]>([]);
  const [recommendedGames, setRecommendedGames] = useState<any[]>([]);
  const [nearbyTurfs, setNearbyTurfs] = useState<any[]>([]);
  const [suggestedPlayers, setSuggestedPlayers] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Get Games
      const gamesRes = await api.get("/games", {
        params: {
          lat: auth.user?.latitude || 12.9716, // Default Bangalore fallback
          lng: auth.user?.longitude || 77.5946,
          max_distance_km: 15.0
        }
      });
      const allGames = gamesRes.data;
      dispatch(setGames(allGames));

      // Separate games for display
      setNearbyGames(allGames.filter((g: any) => !g.is_joined));
      setUpcomingGames(allGames.filter((g: any) => g.is_joined));
      
      // Recommended games based on user preferred sports
      try {
        const profileRes = await api.get("/profile");
        const prefSports = profileRes.data.preferred_sports || [];
        setRecommendedGames(allGames.filter((g: any) => prefSports.includes(g.sport_type) && !g.is_joined));
        
        // Sync Redux wallet balance in case of updates
        dispatch(updateWallet(parseFloat(profileRes.data.wallet.balance)));
      } catch (err) {
        console.log("Could not load preferred sports for recommendation filters", err);
      }

      // 2. Fetch venues
      const venuesRes = await api.get("/venues", {
        params: {
          lat: auth.user?.latitude || 12.9716,
          lng: auth.user?.longitude || 77.5946,
          max_distance_km: 10.0
        }
      });
      setNearbyTurfs(venuesRes.data.slice(0, 4));

      // 3. Fetch friend suggestions (users that are not friends yet)
      const suggestionsRes = await api.get("/friends", { params: { suggestions: true } });
      // We will fallback to dummy player lists if database suggestions is empty
      setSuggestedPlayers(
        suggestionsRes.data.length > 0
          ? suggestionsRes.data
          : [
              { id: 101, username: "rahul_s", profile_pic: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150" },
              { id: 102, username: "amit_sharma", profile_pic: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=150" },
              { id: 103, username: "karan_m", profile_pic: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150" }
            ]
      );

      // 4. Fetch notifications count
      const notifsRes = await api.get("/notifications");
      setUnreadNotifications(notifsRes.data.filter((n: any) => !n.is_read).length);
      
    } catch (error) {
      console.log("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [auth.user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [auth.user]);

  const handleBannerScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    setBannerIndex(Math.round(index));
  };

  const handleAddFriend = async (friendId: number) => {
    try {
      await api.post("/friend-request", { friend_id: friendId });
      Alert.alert("Friend Request Sent!", "They will appear in your friends list once accepted.");
      setSuggestedPlayers(suggestedPlayers.filter(p => p.id !== friendId));
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.detail || "Could not send friend request.");
    }
  };

  // SKELETON LOADER COMPONENT
  const renderSkeletons = () => (
    <View style={styles.skeletonContainer}>
      <View style={[styles.skeletonBanner, { width: CAROUSEL_WIDTH }]} />
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonCard} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandLogo}>Sport<Text style={{ color: COLORS.primary }}>Circle</Text></Text>
          <View style={styles.locationContainer}>
            <Ionicons name="location-sharp" size={14} color={COLORS.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {auth.user?.first_name 
                ? `Bengaluru, KA`
                : "Acquiring location..."}
            </Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          {/* Favorite Friends Launcher */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/friends")}>
            <Ionicons name="people" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          
          {/* Notifications Launcher */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: "/friends", params: { tab: "requests" } })}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.textPrimary} />
            {unreadNotifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        renderSkeletons()
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        >
          {/* Sponsor Banner Carousel */}
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleBannerScroll}
              style={styles.bannerScroll}
            >
              {SPONSOR_BANNERS.map((banner) => (
                <View key={banner.id} style={styles.bannerCard}>
                  <Image source={{ uri: banner.image }} style={styles.bannerImg} />
                  <View style={styles.bannerOverlay}>
                    <Text style={styles.bannerTitle}>{banner.title}</Text>
                    <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            
            {/* Banner dots */}
            <View style={styles.bannerDots}>
              {SPONSOR_BANNERS.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.bannerDot,
                    idx === bannerIndex ? styles.bannerDotActive : null,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Quick host game trigger */}
          <View style={styles.quickLaunchContainer}>
            <TouchableOpacity style={styles.hostTriggerBtn} onPress={() => router.push("/host-game")}>
              <View style={styles.hostTriggerIconWrapper}>
                <Ionicons name="add-circle-sharp" size={32} color={COLORS.surface} />
              </View>
              <View style={{ marginLeft: SPACING.md }}>
                <Text style={styles.hostTriggerTitle}>Host a Game</Text>
                <Text style={styles.hostTriggerSub}>Set up matches, rules, and invite players</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Upcoming Games (Joined) */}
          {upcomingGames.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Your Upcoming Games</Text>
              {upcomingGames.map((g) => (
                <TouchableOpacity 
                  key={g.id} 
                  style={styles.gameCard}
                  onPress={() => router.push({ pathname: "/(tabs)/explore", params: { gameId: g.id } })}
                >
                  <View style={styles.gameHeader}>
                    <View style={styles.sportBadge}>
                      <Text style={styles.sportBadgeText}>{g.sport_type}</Text>
                    </View>
                    <Text style={styles.gameDate}>{g.game_date} @ {g.start_time.slice(0,5)}</Text>
                  </View>
                  <Text style={styles.gameName}>{g.name}</Text>
                  <Text style={styles.gameLoc}><Ionicons name="location-outline" size={14} /> {g.location}</Text>
                  <View style={styles.gameFooter}>
                    <Text style={styles.gameSlots}>
                      Joined: {g.joined_count}/{g.player_count} players
                    </Text>
                    <Text style={styles.upcomingBadge}>Joined</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Nearby Games */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeading}>Nearby Live Games</Text>
              <TouchableOpacity onPress={() => router.push("/join-game")}>
                <Text style={styles.viewAll}>Map View</Text>
              </TouchableOpacity>
            </View>
            
            {nearbyGames.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No nearby games scheduled yet.</Text>
                <TouchableOpacity onPress={() => router.push("/host-game")}>
                  <Text style={styles.emptyLink}>Host one yourself!</Text>
                </TouchableOpacity>
              </View>
            ) : (
              nearbyGames.slice(0, 3).map((g) => (
                <TouchableOpacity 
                  key={g.id} 
                  style={styles.gameCard}
                  onPress={() => router.push({ pathname: "/(tabs)/explore", params: { gameId: g.id } })}
                >
                  <View style={styles.gameHeader}>
                    <View style={styles.sportBadge}>
                      <Text style={styles.sportBadgeText}>{g.sport_type}</Text>
                    </View>
                    <Text style={styles.gameFee}>{parseFloat(g.entry_fee) === 0 ? "Free" : `Rs. ${g.entry_fee}`}</Text>
                  </View>
                  <Text style={styles.gameName}>{g.name}</Text>
                  <Text style={styles.gameLoc} numberOfLines={1}>
                    <Ionicons name="location-outline" size={14} /> {g.location}
                  </Text>
                  <View style={styles.gameFooter}>
                    <Text style={styles.gameSlots}>
                      Slots: {g.player_count - g.joined_count} remaining
                    </Text>
                    <Text style={styles.joinActionText}>Details →</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Recommended Games */}
          {recommendedGames.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Recommended For You</Text>
              {recommendedGames.slice(0, 3).map((g) => (
                <TouchableOpacity 
                  key={g.id} 
                  style={styles.gameCard}
                  onPress={() => router.push({ pathname: "/(tabs)/explore", params: { gameId: g.id } })}
                >
                  <View style={styles.gameHeader}>
                    <View style={styles.sportBadge}>
                      <Text style={styles.sportBadgeText}>{g.sport_type}</Text>
                    </View>
                    <Text style={styles.recommendedTag}>Matching Interest</Text>
                  </View>
                  <Text style={styles.gameName}>{g.name}</Text>
                  <Text style={styles.gameLoc} numberOfLines={1}><Ionicons name="location-outline" size={14} /> {g.location}</Text>
                  <View style={styles.gameFooter}>
                    <Text style={styles.gameSlots}>
                      {g.joined_count}/{g.player_count} Joined
                    </Text>
                    <Text style={styles.joinActionText}>Join Match</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Nearby Turfs */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeading}>Featured Turfs & Grounds</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/booking")}>
                <Text style={styles.viewAll}>Book Slot</Text>
              </TouchableOpacity>
            </View>
            
            {nearbyTurfs.length === 0 ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.turfScroll}>
                {nearbyTurfs.map((t) => (
                  <TouchableOpacity 
                    key={t.id} 
                    style={styles.turfCard}
                    onPress={() => router.push({ pathname: "/(tabs)/booking", params: { venueId: t.id } })}
                  >
                    <Image source={{ uri: t.image_url || "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=250" }} style={styles.turfImg} />
                    <View style={styles.turfInfo}>
                      <Text style={styles.turfName} numberOfLines={1}>{t.name}</Text>
                      <Text style={styles.turfSport}>{t.sport}</Text>
                      <View style={styles.turfFooter}>
                        <Text style={styles.turfPrice}>Rs. {t.price_per_hour}/hr</Text>
                        <View style={styles.turfRating}>
                          <Ionicons name="star" size={12} color="#FFD700" />
                          <Text style={styles.ratingText}>{t.rating}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Players You Might Know */}
          <View style={[styles.section, { marginBottom: 100 }]}>
            <Text style={styles.sectionHeading}>Players You Might Know</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerScroll}>
              {suggestedPlayers.map((player) => (
                <View key={player.id} style={styles.playerCard}>
                  <Image source={{ uri: player.profile_pic || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150" }} style={styles.playerAvatar} />
                  <Text style={styles.playerName} numberOfLines={1}>@{player.username}</Text>
                  <TouchableOpacity style={styles.addFriendBtn} onPress={() => handleAddFriend(player.id)}>
                    <Ionicons name="person-add-outline" size={14} color={COLORS.surface} />
                    <Text style={styles.addFriendBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {/* Floating Host Action Button */}
      <TouchableOpacity 
        style={styles.floatingActionBtn}
        onPress={() => router.push("/host-game")}
      >
        <Ionicons name="add" size={28} color={COLORS.surface} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? 40 : 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    ...SHADOWS.soft,
  },
  brandLogo: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  locationText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
    maxWidth: 160,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: COLORS.surface,
    fontSize: 9,
    fontFamily: "Poppins_700Bold",
  },
  carouselContainer: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  bannerScroll: {
    borderRadius: 24,
    overflow: "hidden",
  },
  bannerCard: {
    width: CAROUSEL_WIDTH,
    height: 160,
    position: "relative",
  },
  bannerImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  bannerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(29, 94, 201, 0.65)", // Custom primary overlay
    padding: SPACING.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  bannerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.surface,
  },
  bannerSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.surface,
    marginTop: 2,
  },
  bannerDots: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.cardBackground,
    marginHorizontal: 3,
  },
  bannerDotActive: {
    width: 14,
    backgroundColor: COLORS.primary,
  },
  quickLaunchContainer: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  hostTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 24,
    ...SHADOWS.medium,
  },
  hostTriggerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  hostTriggerTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.surface,
  },
  hostTriggerSub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.background,
    marginTop: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  viewAll: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
  gameCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  gameHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sportBadge: {
    backgroundColor: COLORS.cardBackground + "60",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  sportBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.primary,
  },
  gameDate: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
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
    marginBottom: 4,
  },
  gameLoc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  gameFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  gameSlots: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  upcomingBadge: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  recommendedTag: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.primary,
  },
  joinActionText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.soft,
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyLink: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 6,
  },
  turfScroll: {
    paddingBottom: 8,
  },
  turfCard: {
    width: 170,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginRight: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.soft,
  },
  turfImg: {
    width: "100%",
    height: 100,
    resizeMode: "cover",
  },
  turfInfo: {
    padding: SPACING.sm,
  },
  turfName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  turfSport: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  turfFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  turfPrice: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.textPrimary,
  },
  turfRating: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.textPrimary,
    marginLeft: 2,
  },
  playerScroll: {
    paddingBottom: 8,
  },
  playerCard: {
    width: 110,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: SPACING.md,
    alignItems: "center",
    marginRight: SPACING.md,
    ...SHADOWS.soft,
  },
  playerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
  },
  playerName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: "center",
    width: "100%",
  },
  addFriendBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  addFriendBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: COLORS.surface,
    marginLeft: 2,
  },
  floatingActionBtn: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  skeletonContainer: {
    padding: SPACING.xl,
    gap: 16,
  },
  skeletonBanner: {
    height: 160,
    backgroundColor: COLORS.cardBackground + "40",
    borderRadius: 24,
  },
  skeletonTitle: {
    height: 24,
    width: 140,
    backgroundColor: COLORS.cardBackground + "40",
    borderRadius: 8,
  },
  skeletonCard: {
    height: 110,
    backgroundColor: COLORS.cardBackground + "40",
    borderRadius: 20,
  },
});
