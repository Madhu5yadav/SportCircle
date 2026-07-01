import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  FlatList, 
  ActivityIndicator,
  Alert,
  Dimensions
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../../../theme/theme";
import { RootState } from "../../../redux/store";
import api from "../../../services/api";
import { updateWallet } from "../../../redux/authSlice";

const { width } = Dimensions.get("window");

export default function BookingScreen() {
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{ venueId?: string }>();
  const auth = useSelector((state: RootState) => state.auth);

  // Tabs
  const [activeTab, setActiveTab] = useState<"explore" | "history">("explore");
  
  // Data States
  const [venues, setVenues] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Slot Selection states
  const [selectedVenue, setSelectedVenue] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  const loadVenues = async () => {
    setLoading(true);
    try {
      const response = await api.get("/venues");
      setVenues(response.data);
      
      // Auto-open selected venue if passed from home screen
      if (params.venueId) {
        const matching = response.data.find((v: any) => v.id === parseInt(params.venueId!));
        if (matching) handleSelectVenue(matching);
      }
    } catch (err) {
      console.log("Error loading venues:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await api.get("/booking-history");
      setHistory(response.data);
    } catch (err) {
      console.log("Error loading bookings:", err);
    }
  };

  useEffect(() => {
    loadVenues();
    loadHistory();
    // Default booking date to today
    const today = new Date().toISOString().split("T")[0];
    setBookingDate(today);
  }, [params.venueId]);

  const handleSelectVenue = async (venue: any) => {
    setSelectedVenue(venue);
    setSelectedSlot(null);
    loadSlots(venue.id, bookingDate);
  };

  const loadSlots = async (venueId: number, dateStr: string) => {
    setSlotsLoading(true);
    try {
      const res = await api.get(`/venue/${venueId}/slots?booking_date=${dateStr}`);
      setSlots(res.data);
    } catch (err) {
      console.log("Error loading slots:", err);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleBookSlot = async () => {
    if (!selectedVenue || !selectedSlot) {
      Alert.alert("Selection Required", "Please select an available slot.");
      return;
    }

    const price = parseFloat(selectedVenue.price_per_hour);
    const balance = auth.wallet?.balance || 0;
    
    if (balance < price) {
      Alert.alert(
        "Insufficient Balance", 
        `Booking costs Rs. ${price}, but your wallet balance is Rs. ${balance}. Please add money.`,
        [
          { text: "Cancel" },
          { text: "Add Funds", onPress: () => setActiveTab("explore") } // Mock routing to profile deposit
        ]
      );
      return;
    }

    setBookingLoading(true);
    try {
      await api.post("/book-venue", {
        venue_id: selectedVenue.id,
        booking_date: bookingDate,
        start_time: selectedSlot.start_time + ":00",
        end_time: selectedSlot.end_time + ":00",
        amount_paid: price
      });

      Alert.alert("Booking Confirmed!", `Successfully booked slot at ${selectedVenue.name} for Rs. ${price}!`);
      
      // Update wallet balance in store
      const walletRes = await api.get("/profile/wallet");
      dispatch(updateWallet(parseFloat(walletRes.data.balance)));

      // Reload
      setSelectedSlot(null);
      loadSlots(selectedVenue.id, bookingDate);
      loadHistory();
      
    } catch (err: any) {
      Alert.alert("Booking Failed", err.response?.data?.detail || "Transaction failed.");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Tabs Selector */}
      {!selectedVenue && (
        <View style={styles.tabHeader}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === "explore" ? styles.tabBtnActive : null]}
            onPress={() => setActiveTab("explore")}
          >
            <Text style={[styles.tabText, activeTab === "explore" ? styles.tabTextActive : null]}>Find Turfs</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === "history" ? styles.tabBtnActive : null]}
            onPress={() => setActiveTab("history")}
          >
            <Text style={[styles.tabText, activeTab === "history" ? styles.tabTextActive : null]}>My Bookings</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* EXPLORE TURFS TAB */}
      {activeTab === "explore" && !selectedVenue && (
        loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <FlatList
            data={venues}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.venueCard} onPress={() => handleSelectVenue(item)}>
                <Image source={{ uri: item.image_url || "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=600" }} style={styles.venueImg} />
                <View style={styles.venueInfo}>
                  <View style={styles.venueHeader}>
                    <Text style={styles.venueName}>{item.name}</Text>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                  </View>
                  <Text style={styles.venueSport}><MaterialCommunityIcons name="soccer" /> {item.sport}</Text>
                  <Text style={styles.venueLoc} numberOfLines={1}><Ionicons name="location-outline" /> {item.location}</Text>
                  
                  {/* Facilities tags */}
                  {item.facilities && (
                    <View style={styles.facilitiesRow}>
                      {item.facilities.split(",").map((fac: string, idx: number) => (
                        <View key={idx} style={styles.facTag}>
                          <Text style={styles.facText}>{fac.trim()}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  <View style={styles.venueFooter}>
                    <Text style={styles.priceText}>Rs. {item.price_per_hour} <Text style={styles.hrLabel}>/ hour</Text></Text>
                    <Text style={styles.bookBtnText}>Check Slots →</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )
      )}

      {/* DETAILED BOOKING VIEW (SLOTS SELECTOR) */}
      {selectedVenue && (
        <ScrollView contentContainerStyle={styles.detailContainer} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedVenue(null)}>
            <Ionicons name="arrow-back" size={16} />
            <Text style={styles.backBtnText}> Back to List</Text>
          </TouchableOpacity>

          <Image source={{ uri: selectedVenue.image_url || "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=600" }} style={styles.detailImg} />
          
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailName}>{selectedVenue.name}</Text>
              <View style={styles.detailRating}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.ratingText}>{selectedVenue.rating}</Text>
              </View>
            </View>
            
            <Text style={styles.detailSport}><MaterialCommunityIcons name="soccer" /> {selectedVenue.sport}</Text>
            <Text style={styles.detailLoc}><Ionicons name="location-outline" /> {selectedVenue.location}</Text>
            
            {/* Facilities details */}
            <Text style={styles.detailSectionTitle}>Facilities Offered</Text>
            <View style={styles.facilitiesWrap}>
              {selectedVenue.facilities?.split(",").map((fac: string, idx: number) => (
                <View key={idx} style={styles.facFullBadge}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.facFullText}>{fac.trim()}</Text>
                </View>
              ))}
            </View>

            {/* Select Slot Timeline */}
            <Text style={styles.detailSectionTitle}>Select Slot ({bookingDate})</Text>
            {slotsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((slot, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.slotBox,
                      !slot.available ? styles.slotBooked : null,
                      selectedSlot?.start_time === slot.start_time ? styles.slotSelected : null
                    ]}
                    disabled={!slot.available}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Text style={[
                      styles.slotTimeText,
                      !slot.available ? styles.slotTimeBookedText : null,
                      selectedSlot?.start_time === slot.start_time ? styles.slotTimeSelectedText : null
                    ]}>
                      {slot.start_time}
                    </Text>
                    <Text style={styles.slotAvailText}>
                      {slot.available ? "Available" : "Booked"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Price & Checkout Footer */}
            {selectedSlot && (
              <View style={styles.checkoutPanel}>
                <View>
                  <Text style={styles.checkoutLabel}>Total Price</Text>
                  <Text style={styles.checkoutPrice}>Rs. {selectedVenue.price_per_hour}</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.bookActionBtn, bookingLoading ? styles.btnDisabled : null]}
                  onPress={handleBookSlot}
                  disabled={bookingLoading}
                >
                  {bookingLoading ? (
                    <ActivityIndicator color={COLORS.surface} />
                  ) : (
                    <Text style={styles.bookActionText}>Book Slot</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* BOOKING HISTORY TAB */}
      {activeTab === "history" && !selectedVenue && (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color={COLORS.cardBackground} />
              <Text style={styles.emptyTitle}>No Booking History</Text>
              <Text style={styles.emptySubtitle}>You haven't booked any venues yet. Find near turfs and court slots!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyVenue}>{item.venue.name}</Text>
                <Text style={[styles.statusTag, item.status === "confirmed" ? styles.statusConfirmed : styles.statusCancelled]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.historySport}><MaterialCommunityIcons name="soccer" /> {item.venue.sport}</Text>
              <View style={styles.historyDetails}>
                <View style={styles.historyDetailItem}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.historyDetailText}>{item.booking_date}</Text>
                </View>
                <View style={styles.historyDetailItem}>
                  <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.historyDetailText}>{item.start_time.slice(0,5)} - {item.end_time.slice(0,5)}</Text>
                </View>
              </View>
              <View style={styles.historyFooter}>
                <Text style={styles.historyPriceLabel}>Amount Paid</Text>
                <Text style={styles.historyPrice}>Rs. {item.amount_paid}</Text>
              </View>
            </View>
          )}
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
  tabHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabBtnActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontFamily: "Poppins_600SemiBold",
  },
  listContainer: {
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  venueCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  venueImg: {
    width: "100%",
    height: 150,
    resizeMode: "cover",
  },
  venueInfo: {
    padding: SPACING.lg,
  },
  venueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  venueName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  ratingText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.textPrimary,
    marginLeft: 4,
  },
  venueSport: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
  },
  venueLoc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  facilitiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginVertical: 12,
  },
  facTag: {
    backgroundColor: COLORS.background,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  facText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  venueFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 6,
  },
  priceText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  hrLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  bookBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
  detailContainer: {
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    ...SHADOWS.soft,
  },
  backBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  detailImg: {
    width: "100%",
    height: 180,
    borderRadius: 24,
    resizeMode: "cover",
  },
  detailCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: SPACING.lg,
    marginTop: 16,
    ...SHADOWS.soft,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  detailRating: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  detailSport: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 4,
  },
  detailLoc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  detailSectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
  },
  facilitiesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  facFullBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 4,
  },
  facFullText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotBox: {
    width: (width - SPACING.xl * 2 - SPACING.lg * 2 - 24) / 3,
    height: 48,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  slotBooked: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    opacity: 0.5,
  },
  slotSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  slotTimeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  slotTimeBookedText: {
    color: COLORS.textSecondary,
    textDecorationLine: "line-through",
  },
  slotTimeSelectedText: {
    color: COLORS.surface,
  },
  slotAvailText: {
    fontSize: 9,
    fontFamily: "Poppins_400Regular",
    color: COLORS.textSecondary,
  },
  checkoutPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  checkoutLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  checkoutPrice: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: COLORS.primary,
  },
  bookActionBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    ...SHADOWS.medium,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  bookActionText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
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
  historyCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyVenue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  statusTag: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  statusConfirmed: {
    backgroundColor: COLORS.success + "20",
    color: COLORS.success,
  },
  statusCancelled: {
    backgroundColor: COLORS.error + "20",
    color: COLORS.error,
  },
  historySport: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  historyDetails: {
    flexDirection: "row",
    gap: 16,
    marginVertical: 10,
  },
  historyDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyDetailText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  historyFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  historyPriceLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  historyPrice: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
});
