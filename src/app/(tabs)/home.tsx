import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { updateWallet } from "../../redux/authSlice";
import { setGames } from "../../redux/gameSlice";
import { setNotifications } from "../../redux/notificationSlice";
import { RootState } from "../../redux/store";
import api from "../../services/api";
import { COLORS, SPACING } from "../../theme/theme";

const { width } = Dimensions.get("window");
const CAROUSEL_WIDTH = width - SPACING.xl * 2;

// Unsplash sports photos for stunning visuals
const SPONSOR_BANNERS = [
  { 
    id: 1, 
    title: "Thala's Wicketkeeping Special", 
    subtitle: "CSK fan jersey & gear: Flat 20% off at Chennai Sports!", 
    tag: "Chennai Special",
    image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800",
    url: "https://www.chennaisuperkings.com/shop",
    sport: "Cricket",
    location: "Chennai"
  },
  { 
    id: 2, 
    title: "Puma India x Virat Kohli", 
    subtitle: "Flat 25% off on Virat's running shoes in local Chennai stores.", 
    tag: "Limited Offer",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800",
    url: "https://in.puma.com/in/en/collaborations/collaborations-sports/puma-x-one8",
    sport: "Running",
    location: "Chennai"
  },
  { 
    id: 3, 
    title: "PV Sindhu's Yonex Smash", 
    subtitle: "Yonex badminton rackets & shuttlecocks at 15% off today.", 
    tag: "Best Seller",
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=800",
    url: "https://www.yonex.com/badminton",
    sport: "Badminton",
    location: "India"
  },
  { 
    id: 4, 
    title: "Sachin's Cricket Academy", 
    subtitle: "Join Chennai junior camps. Get free custom cricket kits!", 
    tag: "Trending",
    image: "https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?q=80&w=800",
    url: "https://www.sachintendulkar.com/",
    sport: "Cricket",
    location: "Chennai"
  },
  { 
    id: 5, 
    title: "LeBron's Chennai Tour", 
    subtitle: "Buy Nike basketball sneakers & get free accessories.", 
    tag: "Exclusive",
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=800",
    url: "https://www.nike.com/in/w/lebron-james-shoes-5e1x6zy7ok",
    sport: "Basketball",
    location: "Chennai"
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const auth = useSelector((state: RootState) => state.auth);
  const game = useSelector((state: RootState) => state.game);
  const unreadNotifications = useSelector((state: RootState) => state.notification.unreadCount);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Custom Data States
  const [nearbyGames, setNearbyGames] = useState<any[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<any[]>([]);
  const [recommendedGames, setRecommendedGames] = useState<any[]>([]);
  const [nearbyTurfs, setNearbyTurfs] = useState<any[]>([]);
  const [preferredSports, setPreferredSports] = useState<string[]>([]);

  const getDynamicBanners = () => {
    const isChennaiUser = currentAddress?.toLowerCase().includes("chennai") || 
      (auth.user?.latitude && Math.abs(auth.user.latitude - 13.0827) < 0.5);

    return [...SPONSOR_BANNERS].sort((a, b) => {
      const aMatchesSport = preferredSports.some(sp => sp.toLowerCase() === a.sport.toLowerCase());
      const bMatchesSport = preferredSports.some(sp => sp.toLowerCase() === b.sport.toLowerCase());
      
      if (aMatchesSport && !bMatchesSport) return -1;
      if (!aMatchesSport && bMatchesSport) return 1;

      const aMatchesLoc = isChennaiUser && a.location === "Chennai";
      const bMatchesLoc = isChennaiUser && b.location === "Chennai";

      if (aMatchesLoc && !bMatchesLoc) return -1;
      if (!aMatchesLoc && bMatchesLoc) return 1;

      return 0;
    });
  };
  const [suggestedPlayers, setSuggestedPlayers] = useState<any[]>([]);
  const [currentAddress, setCurrentAddress] = useState("Acquiring location...");

  const fetchGPSLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = location.coords;
        const response = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (response && response.length > 0) {
          const { city, region, district } = response[0];
          const displayCity = city || district || "Unknown City";
          const displayRegion = region || "";
          setCurrentAddress(`${displayCity}${displayRegion ? `, ${displayRegion}` : ""}`);
        } else {
          setCurrentAddress("Unknown Location");
        }
      } else {
        setCurrentAddress("Location Denied");
      }
    } catch (error) {
      console.log("Error fetching GPS location:", error);
      if (auth.user?.latitude && auth.user?.longitude) {
        try {
          const response = await Location.reverseGeocodeAsync({
            latitude: auth.user.latitude,
            longitude: auth.user.longitude,
          });
          if (response && response.length > 0) {
            const { city, region, district } = response[0];
            setCurrentAddress(`${city || district || "Bengaluru"}${region ? `, ${region}` : ""}`);
            return;
          }
        } catch (e) {
          // ignore
        }
      }
      setCurrentAddress("Bengaluru, KA");
    }
  };

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

      const now = new Date();
      const isGameFuture = (g: any) => {
        try {
          if (!g.game_date || !g.start_time) return false;
          const gameStart = new Date(`${g.game_date}T${g.start_time}`);
          return gameStart.getTime() > now.getTime();
        } catch (e) {
          return false;
        }
      };

      const futureGames = allGames.filter(isGameFuture);

      // Separate games for display
      setNearbyGames(futureGames.filter((g: any) => !g.is_joined));
      setUpcomingGames(futureGames.filter((g: any) => g.is_joined));
      // Recommended games based on user preferred sports
      try {
        const profileRes = await api.get("/profile");
        const prefSports = profileRes.data.preferred_sports || [];
        setPreferredSports(prefSports);
        setRecommendedGames(futureGames.filter((g: any) => prefSports.includes(g.sport_type) && !g.is_joined));
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
      const normalizedSuggestions = (suggestionsRes.data || []).map((p: any) => ({
        ...p,
        id: p.id || p.friend_id
      }));
      setSuggestedPlayers(normalizedSuggestions);

      // 4. Fetch notifications and store in Redux
      const notifsRes = await api.get("/notifications");
      dispatch(setNotifications(notifsRes.data));

    } catch (error) {
      console.log("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchGPSLocation();
  }, [auth.user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboardData(), fetchGPSLocation()]);
    setRefreshing(false);
  }, [auth.user]);

  const handleBannerScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    setBannerIndex(Math.round(index));
  };

  useEffect(() => {
    if (loading && !refreshing) return;

    const timer = setTimeout(() => {
      const banners = getDynamicBanners();
      if (banners.length === 0) return;
      const nextIndex = (bannerIndex + 1) % banners.length;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * CAROUSEL_WIDTH,
        animated: true,
      });
      setBannerIndex(nextIndex);
    }, 4000); // Auto scroll every 4 seconds

    return () => clearTimeout(timer);
  }, [bannerIndex, loading, refreshing, preferredSports, currentAddress]);

  const handleAddFriend = async (friendId: number) => {
    try {
      await api.post("/friend-request", { friend_id: friendId });
      Alert.alert("Friend Request Sent!", "They will appear in your friends list once accepted.");
      setSuggestedPlayers(suggestedPlayers.filter(p => (p.friend_id || p.id) !== friendId));
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
    <View style={styles.safeContainer} >
      <StatusBar style="light" translucent={true} />
      {/* Top Header */}
      <View style={[styles.header, {
        height: 60 + insets.top,
        paddingTop: insets.top + 10,
      }]}>
        <Text style={styles.brandLogo}>SPORT CIRCLE</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/notifications")}>
            <Ionicons name="notifications-outline" size={24} color="#ffffff" />
            {unreadNotifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { marginLeft: 16 }]} onPress={() => router.push("/friends")}>
            <Ionicons name="heart-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingText}>
            Welcome back! {auth.user?.first_name || auth.user?.username || "Name"}
          </Text>
          <View style={styles.locationContainer}>
            <Ionicons name="location-sharp" size={16} color={COLORS.textPrimary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {currentAddress}
            </Text>
          </View>
        </View>

        {loading && !refreshing ? (
          renderSkeletons()
        ) : (
          <>
            {/* Sponsor Banner Carousel */}
            <View style={styles.carouselContainer}>
              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleBannerScroll}
                style={styles.bannerScroll}
              >
                {getDynamicBanners().map((banner) => (
                  <TouchableOpacity 
                    key={banner.id} 
                    style={styles.bannerCard}
                    activeOpacity={0.9}
                    onPress={() => {
                      if (banner.url) {
                        Linking.openURL(banner.url).catch((err) => {
                          console.log("Could not open URL:", err);
                        });
                      }
                    }}
                  >
                    <Image source={{ uri: banner.image }} style={styles.bannerImg} />
                    <View style={styles.bannerOverlay}>
                      <View style={styles.bannerTag}>
                        <Text style={styles.bannerTagText}>{banner.tag}</Text>
                      </View>
                      <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
                      <Text style={styles.bannerSubtitle} numberOfLines={2}>{banner.subtitle}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Banner dots */}
              <View style={styles.bannerDots}>
                {getDynamicBanners().map((_, idx) => (
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

            {/* Host Game Button */}
            <View style={styles.hostBtnContainer}>
              <TouchableOpacity style={styles.hostBtn} onPress={() => router.push("/host-game")}>
                <Text style={styles.hostBtnText}>HOST A GAME</Text>
                <FontAwesome5 name="angle-double-right" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* Upcoming Games */}
            {upcomingGames.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>Upcoming Games</Text>
                {upcomingGames.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.upcomingGameCard}
                    onPress={() => router.push({ pathname: "/(tabs)/explore", params: { gameId: g.id } })}
                  >
                    <View style={styles.upcomingGameTopRow}>
                      <Text style={styles.upcomingGameTime}>{g.game_date}, {g.start_time.slice(0, 5)} - {g.end_time.slice(0, 5)}</Text>
                      <View style={styles.joinedPill}>
                        <Text style={styles.joinedPillText}>Joined</Text>
                      </View>
                    </View>
                    <View style={styles.upcomingGameMiddleRow}>
                      <Text style={styles.upcomingGameSport}>{g.sport_type}</Text>
                      <Text style={styles.upcomingGameSlots}>{g.player_count - g.joined_count < 0 ? `Waiting List: ${g.joined_count - g.player_count}` : `${g.player_count - g.joined_count} Slots Left`}</Text>
                    </View>
                    <View style={styles.upcomingGameBottomRow}>
                      <Ionicons name="location-sharp" size={14} color={COLORS.textPrimary} />
                      <Text style={styles.upcomingGameVenue}>{g.location}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Games near you */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeading}>Games near you</Text>
                <TouchableOpacity onPress={() => router.push("/join-game")}>
                  <Ionicons name="arrow-forward" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              {nearbyGames.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No nearby games scheduled yet.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                  {nearbyGames.slice(0, 3).map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={styles.nearbyGameCard}
                      onPress={() => router.push({ pathname: "/(tabs)/explore", params: { gameId: g.id } })}
                    >
                      <View style={styles.nearbyGameTopRow}>
                        <Text style={styles.nearbyGameSport}>{g.sport_type}</Text>
                        <Text style={styles.nearbyGameHyphen}>-</Text>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Text style={styles.nearbyGamePlayers}>{g.joined_count}/{g.player_count}</Text>
                          {(g.waiting_count ?? 0) > 0 && (
                            <Text style={{ color: "#4CAF50", fontFamily: "Poppins_600SemiBold", fontSize: 11, marginLeft: 4 }}>
                              ({g.waiting_count} waiting{(g.waiting_count ?? 0) > 1 ? "s" : ""})
                            </Text>
                          )}
                        </View>
                        <Ionicons name="people" size={16} color={COLORS.textPrimary} style={{ marginLeft: 4, marginRight: 'auto' }} />
                        <TouchableOpacity style={styles.joinBtn} onPress={() => router.push({ pathname: "/(tabs)/explore", params: { gameId: g.id } })}>
                          <Text style={styles.joinBtnText}>Join</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.nearbyGameTime}>{g.game_date}, {g.start_time.slice(0, 5)} - {g.end_time.slice(0, 5)}</Text>
                      <View style={styles.nearbyGameBottomRow}>
                        <Ionicons name="location-sharp" size={14} color={COLORS.textPrimary} />
                        <Text style={styles.nearbyGameVenue} numberOfLines={1}>{g.location}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Venues nearby you */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeading}>Venues nearby you</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/booking")}>
                  <Ionicons name="arrow-forward" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              {nearbyTurfs.length === 0 ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                  {nearbyTurfs.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.venueCard}
                      onPress={() => router.push({ pathname: "/(tabs)/booking", params: { venueId: t.id } })}
                    >
                      <View style={styles.venueImgContainer}>
                        <Image source={{ uri: t.image_url || "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=250" }} style={styles.venueImg} />
                        <View style={styles.venueRating}>
                          <Text style={styles.venueRatingText}>{t.rating}</Text>
                          <Ionicons name="star" size={10} color="#FFD700" style={{ marginLeft: 2 }} />
                        </View>
                      </View>
                      <View style={styles.venueInfo}>
                        <Text style={styles.venueName} numberOfLines={1}>{t.name}</Text>
                        <View style={styles.venueLocRow}>
                          <Ionicons name="location-sharp" size={12} color={COLORS.textPrimary} />
                          <Text style={styles.venueLocText} numberOfLines={1}>{t.location}</Text>
                        </View>
                        <Text style={styles.venuePrice}>Rs. {t.price_per_hour}/hr</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Players You Might Know */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeading}>Players you might know</Text>
                <TouchableOpacity onPress={() => router.push("/friends")}>
                  <Ionicons name="arrow-forward" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={styles.playersContainer}>
                {suggestedPlayers.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                    {suggestedPlayers.map((player) => (
                      <View key={player.friend_id || player.id} style={styles.playerCard}>
                        <TouchableOpacity 
                          style={{ alignItems: "center" }}
                          onPress={() => router.push({ pathname: "/user-profile", params: { userId: player.friend_id || player.id } })}
                        >
                          <Image source={{ uri: player.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }} style={styles.playerAvatar} />
                          <Text style={styles.playerName} numberOfLines={1}>{player.username}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.addFriendBtn} onPress={() => handleAddFriend(player.friend_id || player.id)}>
                          <Text style={styles.addFriendBtnText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.emptySuggestionsContainer}>
                    <Ionicons name="people-outline" size={20} color={COLORS.textSecondary} />
                    <Text style={styles.emptySuggestionsText}>No other user exists</Text>
                  </View>
                )}
              </View>
            </View>

          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.background, // Light blueish background like mockup
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
  },
  brandLogo: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: "#ffffff",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionBtn: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
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
  greetingSection: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  greetingText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  locationText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 6,
  },
  carouselContainer: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  bannerScroll: {
    borderRadius: 16,
    overflow: "hidden",
  },
  bannerCard: {
    width: CAROUSEL_WIDTH,
    height: 150,
  },
  bannerImg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    borderRadius: 16,
    resizeMode: "cover",
  },
  bannerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    padding: SPACING.lg,
    justifyContent: "flex-end",
    borderRadius: 16,
  },
  bannerTag: {
    backgroundColor: "#FFD700",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  bannerTagText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 9,
    color: "#000000",
    textTransform: "uppercase",
  },
  bannerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  bannerSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#E4ECFA",
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  bannerDots: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D3D3D3",
    marginHorizontal: 4,
  },
  bannerDotActive: {
    backgroundColor: "#8CA2EB",
  },
  hostBtnContainer: {
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  hostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#DDE8F9",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
  },
  hostBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.primary,
  },
  section: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionHeading: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  horizontalScroll: {
    paddingBottom: 8,
  },
  upcomingGameCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  upcomingGameTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  upcomingGameTime: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  joinedPill: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  joinedPillText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
  },
  upcomingGameMiddleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  upcomingGameSport: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  upcomingGameSlots: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  upcomingGameBottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  upcomingGameVenue: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 6,
  },
  nearbyGameCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: SPACING.md,
    marginRight: SPACING.md,
    width: 260,
  },
  nearbyGameTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  nearbyGameSport: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  nearbyGameHyphen: {
    marginHorizontal: 8,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  nearbyGamePlayers: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  joinBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  joinBtnText: {
    color: "#ffffff",
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  nearbyGameTime: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  nearbyGameBottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nearbyGameVenue: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginLeft: 6,
    flex: 1,
  },
  venueCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    marginRight: SPACING.md,
    width: 180,
    overflow: "hidden",
  },
  venueImgContainer: {
    width: "100%",
    height: 100,
    position: "relative",
  },
  venueImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  venueRating: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  venueRatingText: {
    color: "#ffffff",
    fontFamily: "Poppins_700Bold",
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
  venueInfo: {
    padding: SPACING.md,
  },
  venueName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  venueLocRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  venueLocText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textPrimary,
    marginLeft: 4,
    flex: 1,
  },
  venuePrice: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  playersContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: SPACING.lg,
    borderRadius: 16,
  },
  playerCard: {
    alignItems: "center",
    marginRight: SPACING.xl,
    width: 64,
  },
  playerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  playerName: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  addFriendBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  addFriendBtnText: {
    color: "#ffffff",
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
  },
  emptyCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptySuggestionsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.xl,
    flexDirection: "row",
    gap: 8,
  },
  emptySuggestionsText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  skeletonContainer: {
    padding: SPACING.xl,
    gap: 16,
  },
  skeletonBanner: {
    height: 160,
    backgroundColor: COLORS.cardBackground + "40",
    borderRadius: 16,
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
    borderRadius: 16,
  },
});
