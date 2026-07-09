import React, { useState, useEffect, useCallback } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  Alert,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { COLORS, SPACING, SHADOWS } from "../../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { RootState } from "../../redux/store";
import { logout } from "../../redux/authSlice";
import { StorageService } from "../../services/storage";
import api from "../../services/api";

export default function OwnerDashboardScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);

  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVenues = async () => {
    try {
      const response = await api.get("/venues/owner");
      setVenues(response.data);
    } catch (error: any) {
      console.log("Error loading owner venues:", error);
      Alert.alert("Error", "Could not fetch your venues.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVenues();
  }, []);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to log out from the Owner Portal?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await StorageService.clearAll();
          dispatch(logout());
          router.replace("/owner/login");
        }
      }
    ]);
  };

  const handleDeleteVenue = (venueId: number, venueName: string) => {
    Alert.alert("Delete Venue", `Are you sure you want to delete "${venueName}"? This action is irreversible.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/venue/${venueId}`);
            setVenues(venues.filter(v => v.id !== venueId));
            Alert.alert("Success", "Venue deleted successfully.");
          } catch (e) {
            Alert.alert("Error", "Could not delete the venue.");
          }
        }
      }
    ]);
  };

  const renderVenueCard = ({ item }: { item: any }) => (
    <View style={styles.venueCard}>
      <Image 
        source={{ uri: item.image_url || "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=300" }} 
        style={styles.venueImg} 
      />
      <View style={styles.venueInfo}>
        <View style={styles.venueHeader}>
          <Text style={styles.venueName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.sportBadge}>
            <Text style={styles.sportText}>{item.sport}</Text>
          </View>
        </View>
        
        <Text style={styles.venueLoc} numberOfLines={1}>
          <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} /> {item.location}
        </Text>

        <Text style={styles.venuePrice}>Rs. {item.price_per_hour}/hr</Text>

        {item.offer_details ? (
          <View style={styles.offerBadge}>
            <Ionicons name="pricetag-outline" size={12} color={COLORS.success} />
            <Text style={styles.offerText} numberOfLines={1}>{item.offer_details}</Text>
          </View>
        ) : null}

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => router.push({ pathname: "/owner/add-venue", params: { venueId: item.id } })}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDeleteVenue(item.id, item.name)}
          >
            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logoText}>Sport<Text style={{ color: COLORS.surface }}>Circle</Text></Text>
          <Text style={styles.welcomeText}>Welcome, @{auth.user?.username || "Owner"}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.surface} />
        </TouchableOpacity>
      </View>

      {/* Stats Board */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{venues.length}</Text>
          <Text style={styles.statLabel}>Total Venues</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{venues.reduce((acc, curr) => acc + (curr.bookings?.length || 0), 0)}</Text>
          <Text style={styles.statLabel}>Bookings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{venues.filter(v => !!v.offer_details).length}</Text>
          <Text style={styles.statLabel}>Active Offers</Text>
        </View>
      </View>

      {/* List content */}
      <View style={styles.body}>
        <Text style={styles.bodyTitle}>Your Registered Venues</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : venues.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={60} color={COLORS.cardBackground} />
            <Text style={styles.emptyTitle}>No venues posted yet</Text>
            <Text style={styles.emptySubtitle}>Tap the "+" button below to add your first court or turf!</Text>
          </View>
        ) : (
          <FlatList
            data={venues}
            renderItem={renderVenueCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
            }
          />
        )}
      </View>

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => router.push("/owner/add-venue")}
      >
        <Ionicons name="add" size={30} color={COLORS.surface} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === "android" ? 20 : 10,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...SHADOWS.medium,
  },
  logoText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: "#FFD700",
  },
  welcomeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.surface,
    marginTop: 2,
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: SPACING.xl,
    marginTop: -16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    alignItems: "center",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  statVal: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: COLORS.primary,
  },
  statLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  body: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: 24,
  },
  bodyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  listContainer: {
    paddingBottom: 100,
  },
  venueCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  venueImg: {
    width: "100%",
    height: 140,
    resizeMode: "cover",
  },
  venueInfo: {
    padding: SPACING.md,
  },
  venueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  venueName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  sportBadge: {
    backgroundColor: COLORS.primary + "12",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sportText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.primary,
  },
  venueLoc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  venuePrice: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  offerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  offerText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.success,
    marginLeft: 4,
    maxWidth: 240,
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 12,
    paddingTop: 10,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.2,
  },
  editBtn: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "06",
  },
  editBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 4,
  },
  deleteBtn: {
    borderColor: "#FF3B30",
    backgroundColor: "#FF3B30" + "06",
  },
  deleteBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: "#FF3B30",
    marginLeft: 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 0.8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
});
