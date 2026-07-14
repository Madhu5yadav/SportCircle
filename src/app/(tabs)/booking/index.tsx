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
  Dimensions,
  SafeAreaView,
  TextInput,
  Modal,
  Linking
} from "react-native";
import { useLocalSearchParams, Tabs, useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../../../theme/theme";
import { RootState } from "../../../redux/store";
import api from "../../../services/api";
import { updateWallet } from "../../../redux/authSlice";

const { width } = Dimensions.get("window");

export default function BookingScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{ venueId?: string }>();
  const auth = useSelector((state: RootState) => state.auth);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryBooking, setSelectedHistoryBooking] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSport, setSelectedSport] = useState("All");
  const [maxDistance, setMaxDistance] = useState(1000);
  const [activeFilterModal, setActiveFilterModal] = useState<"sport" | "distance" | null>(null);

  // Details States (Carousel, reviews redesign)
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [venueReviews, setVenueReviews] = useState<any[]>([]);
  const [newReviewText, setNewReviewText] = useState("");
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [showWriteReviewModal, setShowWriteReviewModal] = useState(false);

  // Sports list for filter
  const ALL_SPORTS = [
    "Badminton",
    "Basketball",
    "Bowling",
    "Cricket",
    "Football",
    "Golf",
    "Hockey",
    "Kabaddi",
    "Kho Kho",
    "Pickleball",
    "Rugby",
    "Running",
    "Swimming",
    "Table Tennis",
    "Tennis",
    "Volleyball",
    "All"
  ];
  
  // Data States
  const [venues, setVenues] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected Venue
  const [selectedVenue, setSelectedVenue] = useState<any | null>(null);

  const loadVenues = async () => {
    setLoading(true);
    try {
      const queryParams: any = {};
      if (maxDistance !== 1000) {
        queryParams.lat = auth.user?.latitude || 12.9716;
        queryParams.lng = auth.user?.longitude || 77.5946;
        queryParams.max_distance_km = maxDistance;
      }
      const response = await api.get("/venues", { params: queryParams });
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

  const handleBookingCardPress = (booking: any) => {
    setSelectedHistoryBooking(booking);
  };

  const canCancel = (booking: any) => {
    if (booking.status === "cancelled") return false;
    
    const bookedDateStr = booking.booking_date;
    const startTimeStr = booking.start_time;
    
    const bookedDateTime = new Date(`${bookedDateStr}T${startTimeStr}`);
    const now = new Date();
    
    const diffMs = bookedDateTime.getTime() - now.getTime();
    const hoursDiff = diffMs / (1000 * 60 * 60);
    
    return hoursDiff >= 24;
  };

  const handleCancelBooking = (bookingId: number) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking and receive a full refund in your wallet?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.post(`/cancel-booking/${bookingId}`);
              Alert.alert("Success", "Booking cancelled and refunded successfully!");
              loadHistory();
              const walletRes = await api.get("/profile/wallet");
              dispatch(updateWallet(parseFloat(walletRes.data.balance)));
            } catch (err: any) {
              Alert.alert("Cancellation Failed", err.response?.data?.detail || "Could not cancel booking.");
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    loadVenues();
    loadHistory();
  }, [params.venueId, maxDistance]);

  const getVenueImages = (venue: any) => {
    const baseImage = venue.image_url || "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=600";
    const additional = [
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=600",
      "https://images.unsplash.com/photo-1540747737956-3787293a9fc4?q=80&w=600",
      "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=600",
    ];
    return [baseImage, ...additional];
  };

  const getMockReviewsForVenue = (venueId: number) => {
    return [
      { id: 1, username: "akash_gupta", rating: 5, comment: "Absolutely loved the turf quality. Excellent lightings for night games!", date: "2026-07-12" },
      { id: 2, username: "rohit_s", rating: 4, comment: "Nice facilities, locker room is clean. Parking can be a bit tight during peak hours.", date: "2026-07-10" },
      { id: 3, username: "kavya_m", rating: 4.5, comment: "Very easy to book, and the court dimensions are perfect. Will play here again.", date: "2026-07-08" }
    ];
  };

  const handleSelectVenue = async (venue: any) => {
    setSelectedVenue(venue);
    setCarouselIndex(0);

    // Set mock reviews
    setVenueReviews(getMockReviewsForVenue(venue.id));
    setNewReviewText("");
    setNewReviewRating(5);
  };

  const handleSelectSport = (sport: string) => {
    if (!selectedVenue) return;
    router.push({
      pathname: "/select-slots",
      params: {
        venueId: selectedVenue.id.toString(),
        sport: sport,
        venueName: selectedVenue.name,
        pricePerHour: selectedVenue.price_per_hour.toString()
      }
    });
  };

  // Google Map Directions
  const handleShowDirection = () => {
    if (!selectedVenue) return;
    const userLat = auth.user?.latitude || 12.9716;
    const userLng = auth.user?.longitude || 77.5946;
    const destLat = selectedVenue.latitude || 12.9121;
    const destLng = selectedVenue.longitude || 77.6443;
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${destLat},${destLng}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open Google Maps."));
  };

  // Add Review
  const handleAddReview = () => {
    if (!newReviewText.trim()) {
      Alert.alert("Error", "Please write a comment before submitting.");
      return;
    }
    const newRev = {
      id: Date.now(),
      username: auth.user?.username || "You",
      rating: newReviewRating,
      comment: newReviewText.trim(),
      date: new Date().toISOString().split("T")[0]
    };
    setVenueReviews([newRev, ...venueReviews]);
    setNewReviewText("");
    setNewReviewRating(5);
    setShowWriteReviewModal(false);
    Alert.alert("Success", "Thank you for your review!");
  };

  // Carousel dots page selector
  const handleCarouselScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / (width - SPACING.xl * 2));
    if (slide !== carouselIndex) {
      setCarouselIndex(slide);
    }
  };

  // Extract categorised data
  const getRecentlyBooked = () => {
    const list: any[] = [];
    const seenIds = new Set();
    const sortedHistory = [...history].sort((a, b) => b.id - a.id);
    for (const h of sortedHistory) {
      if (h.venue && !seenIds.has(h.venue.id)) {
        seenIds.add(h.venue.id);
        list.push(h.venue);
      }
    }
    return list;
  };

  const recentlyBooked = getRecentlyBooked();
  
  const turfs = venues.filter((v: any) => 
    v.sport.toLowerCase().includes("football") || 
    v.sport.toLowerCase().includes("cricket")
  );

  const badmintonCourts = venues.filter((v: any) => 
    v.sport.toLowerCase().includes("badminton")
  );

  const basketballCourts = venues.filter((v: any) => 
    v.sport.toLowerCase().includes("basketball")
  );

  const matchesSportFilter = (v: any) => {
    if (selectedSport === "All") return true;
    return v.sport.toLowerCase().includes(selectedSport.toLowerCase());
  };

  const matchesSearch = (v: any) => {
    let isMatch = true;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      isMatch = v.name.toLowerCase().includes(q) || 
                v.sport.toLowerCase().includes(q) || 
                v.location.toLowerCase().includes(q);
    }
    const isSportMatch = matchesSportFilter(v);
    return isMatch && isSportMatch;
  };

  const filteredRecentlyBooked = recentlyBooked.filter(matchesSearch);
  const filteredTurfs = turfs.filter(matchesSearch);
  const filteredBadminton = badmintonCourts.filter(matchesSearch);
  const filteredBasketball = basketballCourts.filter(matchesSearch);
  const filteredSearchAll = venues.filter(matchesSearch);

  const renderVenueCard = (item: any) => (
    <TouchableOpacity key={item.id} style={styles.card} onPress={() => handleSelectVenue(item)}>
      <View style={styles.cardImageWrapper}>
        <Image 
          source={{ uri: item.image_url || "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=600" }} 
          style={styles.cardImage} 
        />
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>{item.rating ? item.rating.toFixed(1) : "0.0"}</Text>
          <Ionicons name="star" size={11} color="#FFD700" style={{ marginLeft: 2 }} />
        </View>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={12} color={COLORS.textSecondary} style={{ marginRight: 2 }} />
          <Text style={styles.cardLocation} numberOfLines={1}>{item.location}</Text>
        </View>
        <Text style={styles.cardPrice}>Rs. {item.price_per_hour}/hr</Text>
      </View>
    </TouchableOpacity>
  );

  const renderCategorySection = (title: string, data: any[]) => {
    if (data.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.horizontalScroll}
        >
          {data.map((item) => renderVenueCard(item))}
        </ScrollView>
      </View>
    );
  };

  const renderFilterOptionModal = () => {
    return (
      <Modal
        visible={activeFilterModal !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveFilterModal(null)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setActiveFilterModal(null)}
        >
          <View style={styles.modalContent}>
            {/* Drag Handle */}
            <View style={styles.modalDragHandle} />

            {/* Header */}
            <View style={styles.modalHeaderBorder}>
              <Text style={styles.modalTitle}>
                {activeFilterModal === "sport" && "Select Sport"}
                {activeFilterModal === "distance" && "Select Distance Radius"}
              </Text>
              <TouchableOpacity onPress={() => setActiveFilterModal(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Options List */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalOptionsContainer}>
              {activeFilterModal === "sport" && ALL_SPORTS.map((sport) => {
                const isSelected = selectedSport === sport;
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[styles.modalOptionItem, isSelected ? styles.modalOptionActive : null]}
                    onPress={() => {
                      setSelectedSport(sport);
                      setActiveFilterModal(null);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected ? styles.modalOptionTextActive : null]}>
                      {sport}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}

              {activeFilterModal === "distance" && [
                { label: "5 km", value: 5 },
                { label: "15 km", value: 15 },
                { label: "30 km", value: 30 },
                { label: "50 km", value: 50 },
                { label: "All distances", value: 1000 }
              ].map((item) => {
                const isSelected = maxDistance === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.modalOptionItem, isSelected ? styles.modalOptionActive : null]}
                    onPress={() => {
                      setMaxDistance(item.value);
                      setActiveFilterModal(null);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected ? styles.modalOptionTextActive : null]}>
                      {item.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const availableSports = selectedVenue?.sport.split(",").map((s: string) => s.trim()) || [];

  return (
    <View style={styles.container}>
      {/* Configure Expo-Router header dynamically */}
      <Tabs.Screen
        options={{
          headerTitle: selectedVenue ? "Venue Details" : "Booking",
          headerLeft: selectedVenue ? () => (
            <TouchableOpacity 
              onPress={() => setSelectedVenue(null)} 
              style={styles.headerBackBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
            </TouchableOpacity>
          ) : undefined,
          headerRight: selectedVenue ? undefined : () => (
            <TouchableOpacity 
              onPress={() => setShowHistoryModal(true)} 
              style={styles.headerIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="calendar-number-outline" size={24} color={COLORS.surface} />
            </TouchableOpacity>
          )
        }}
      />

      {/* EXPLORE TURFS VIEW */}
      {!selectedVenue && (
        <View style={{ flex: 1 }}>
          {/* Search bar below header */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBarWrapper}>
              <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Find Venues"
                placeholderTextColor={COLORS.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(!showFilters)}>
                <Ionicons 
                  name="options-outline" 
                  size={20} 
                  color={showFilters ? COLORS.primary : COLORS.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Pills Row */}
          {showFilters && (
            <View style={styles.filterPillsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
                <TouchableOpacity style={styles.filterPill} onPress={() => setActiveFilterModal("sport")}>
                  <Text style={styles.filterPillText}>Sport: {selectedSport}</Text>
                  <Ionicons name="chevron-down" size={14} color={COLORS.textPrimary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.filterPill} onPress={() => setActiveFilterModal("distance")}>
                  <Text style={styles.filterPillText}>
                    {maxDistance > 500 ? "Distance: All" : `Distance: ${maxDistance}km`}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={COLORS.textPrimary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {loading ? (
            <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
          ) : (searchQuery.trim().length > 0 || selectedSport !== "All") ? (
            // Search results layout (shows vertical list if searching or sport filtered)
            filteredSearchAll.length > 0 ? (
              <FlatList
                data={filteredSearchAll}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.venueCard} onPress={() => handleSelectVenue(item)}>
                    <Image source={{ uri: item.image_url || "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=600" }} style={styles.venueImg} />
                    <View style={styles.venueInfo}>
                      <View style={styles.venueHeader}>
                        <Text style={styles.venueName}>{item.name}</Text>
                        <View style={styles.ratingBadgeVertical}>
                          <Ionicons name="star" size={14} color="#FFD700" />
                          <Text style={styles.ratingTextVertical}>{item.rating}</Text>
                        </View>
                      </View>
                      <Text style={styles.venueSport}><MaterialCommunityIcons name="soccer" /> {item.sport}</Text>
                      <Text style={styles.venueLoc} numberOfLines={1}><Ionicons name="location-outline" /> {item.location}</Text>
                      
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
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={COLORS.cardBackground} />
                <Text style={styles.emptyTitle}>No Venues Found</Text>
                <Text style={styles.emptySubtitle}>We couldn't find any venues matching your criteria.</Text>
              </View>
            )
          ) : (
            // Categorised horizontal scrolling layout
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
              {renderCategorySection("Recently Booked", filteredRecentlyBooked)}
              {renderCategorySection("Turfs near you", filteredTurfs)}
              {renderCategorySection("Badminton courts near you", filteredBadminton)}
              {renderCategorySection("Basketball courts near you", filteredBasketball)}
              
              {(venues.length === 0 || (filteredRecentlyBooked.length === 0 && filteredTurfs.length === 0 && filteredBadminton.length === 0 && filteredBasketball.length === 0)) && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="football-outline" size={48} color={COLORS.cardBackground} />
                  <Text style={styles.emptyTitle}>No Venues Available</Text>
                  <Text style={styles.emptySubtitle}>No venues match the selected filters.</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* DETAILED VENUE VIEW */}
      {selectedVenue && (
        <ScrollView contentContainerStyle={styles.detailContainer} showsVerticalScrollIndicator={false}>

          {/* Horizontally Scrollable Pictures Carousel */}
          <View style={styles.carouselContainer}>
            <ScrollView 
              horizontal 
              pagingEnabled 
              showsHorizontalScrollIndicator={false}
              onScroll={handleCarouselScroll}
              scrollEventThrottle={16}
            >
              {getVenueImages(selectedVenue).map((imgUrl, idx) => (
                <Image key={idx} source={{ uri: imgUrl }} style={styles.detailImg} />
              ))}
            </ScrollView>
            {/* Carousel Dots Indicators */}
            <View style={styles.dotsIndicator}>
              {getVenueImages(selectedVenue).map((_, idx) => (
                <View 
                  key={idx} 
                  style={[
                    styles.dot, 
                    carouselIndex === idx ? styles.activeDot : null
                  ]} 
                />
              ))}
            </View>
          </View>
          
          {/* Main Venue Details Card */}
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailName}>{selectedVenue.name}</Text>
              <View style={styles.detailRating}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.ratingTextVertical}>{selectedVenue.rating}</Text>
              </View>
            </View>
            
            <Text style={styles.detailSport}><MaterialCommunityIcons name="soccer" /> {selectedVenue.sport}</Text>
            
            {/* Location row with Directions button */}
            <View style={styles.detailLocContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLoc}><Ionicons name="location-outline" /> {selectedVenue.location}</Text>
              </View>
              <TouchableOpacity style={styles.directionBtn} onPress={handleShowDirection}>
                <Ionicons name="map-outline" size={16} color={COLORS.surface} />
                <Text style={styles.directionBtnText}>Directions</Text>
              </TouchableOpacity>
            </View>
            
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

            {/* Sport Selection (if multiple sports offered) */}
            {availableSports.length > 1 ? (
              <View>
                <Text style={styles.detailSectionTitle}>Select Sport to Book</Text>
                <View style={styles.sportsSelectionRow}>
                  {availableSports.map((sport: string) => {
                    return (
                      <TouchableOpacity
                        key={sport}
                        style={styles.sportOptionBtn}
                        onPress={() => handleSelectSport(sport)}
                      >
                        <Text style={styles.sportOptionText}>
                          {sport}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 20 }}>
                <TouchableOpacity 
                  style={styles.bookActionBtnWide} 
                  onPress={() => handleSelectSport(selectedVenue.sport)}
                >
                  <Text style={styles.bookActionBtnText}>Select Booking Slots</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Redesigned Testimonials Reviews Carousel (No longer inside a card) */}
          <View style={styles.reviewsTestimonialSection}>
            <View style={styles.reviewsSectionHeader}>
              <Text style={styles.reviewsTitle}>Player Reviews</Text>
              <TouchableOpacity onPress={() => setShowWriteReviewModal(true)} style={styles.writeReviewLink}>
                <Ionicons name="create-outline" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={styles.writeReviewLinkText}>Write Review</Text>
              </TouchableOpacity>
            </View>

            {venueReviews.length > 0 ? (
              <View style={styles.verticalReviewsList}>
                {venueReviews.map((rev) => (
                  <View key={rev.id} style={styles.verticalReviewItem}>
                    <View style={styles.testimonialHeader}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{rev.username[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.testimonialUser} numberOfLines={1}>@{rev.username}</Text>
                        <View style={styles.starsRow}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Ionicons 
                              key={i} 
                              name={i < rev.rating ? "star" : "star-outline"} 
                              size={10} 
                              color="#FFD700" 
                            />
                          ))}
                        </View>
                      </View>
                      <Text style={styles.testimonialDate}>{rev.date}</Text>
                    </View>
                    <Text style={styles.testimonialComment}>
                      "{rev.comment}"
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noReviewsText}>No reviews yet. Be the first to review!</Text>
            )}
          </View>
        </ScrollView>
      )}

      {/* MY BOOKINGS HISTORY MODAL */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>My Bookings</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close-circle" size={28} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          
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
            renderItem={({ item }) => {
              const cancelable = canCancel(item);
              return (
                <TouchableOpacity 
                  style={styles.historyCard}
                  activeOpacity={0.8}
                  onPress={() => handleBookingCardPress(item)}
                >
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
                    <View>
                      <Text style={styles.historyPriceLabel}>Amount Paid</Text>
                      <Text style={styles.historyPrice}>Rs. {item.amount_paid}</Text>
                    </View>
                    
                    {cancelable && (
                      <TouchableOpacity 
                        style={styles.cancelBookingBtn} 
                        onPress={() => handleCancelBooking(item.id)}
                      >
                        <Text style={styles.cancelBookingText}>Cancel Booking</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* BOOKING DETAILS MODAL */}
      <Modal
        visible={selectedHistoryBooking !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedHistoryBooking(null)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setSelectedHistoryBooking(null)}
        >
          <View style={styles.bookingDetailModalContent}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeaderBorder}>
              <Text style={styles.modalTitle}>Booking Details</Text>
              <TouchableOpacity onPress={() => setSelectedHistoryBooking(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedHistoryBooking && (
              <ScrollView contentContainerStyle={styles.bookingDetailScrollBody}>
                {/* Venue Name */}
                <View style={styles.detailHeaderRow}>
                  <Text style={styles.detailVenueName}>{selectedHistoryBooking.venue.name}</Text>
                  <Text style={[
                    styles.statusTag, 
                    selectedHistoryBooking.status === "confirmed" ? styles.statusConfirmed : styles.statusCancelled,
                    { alignSelf: "flex-start" }
                  ]}>
                    {selectedHistoryBooking.status.toUpperCase()}
                  </Text>
                </View>

                {/* Sport info */}
                <View style={styles.detailRow}>
                  <Ionicons name="football-outline" size={18} color={COLORS.primary} />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Sport</Text>
                    <Text style={styles.detailValue}>{selectedHistoryBooking.venue.sport}</Text>
                  </View>
                </View>

                {/* Location */}
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Location</Text>
                    <Text style={styles.detailValue}>{selectedHistoryBooking.venue.location}</Text>
                  </View>
                </View>

                {/* Timing */}
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Timings</Text>
                    <Text style={styles.detailValue}>
                      {selectedHistoryBooking.booking_date} | {selectedHistoryBooking.start_time.slice(0, 5)} - {selectedHistoryBooking.end_time.slice(0, 5)}
                    </Text>
                  </View>
                </View>

                {/* Payment Time */}
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Payment Time</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedHistoryBooking.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Payment Platform */}
                <View style={styles.detailRow}>
                  <Ionicons name="card-outline" size={18} color={COLORS.primary} />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Payment Method</Text>
                    <Text style={styles.detailValue}>SportCircle Wallet</Text>
                  </View>
                </View>

                {/* Amount Paid */}
                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={18} color={COLORS.primary} />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Amount Paid</Text>
                    <Text style={styles.detailPrice}>Rs. {selectedHistoryBooking.amount_paid}</Text>
                  </View>
                </View>

                {/* Cancellation Action inside Details */}
                {canCancel(selectedHistoryBooking) ? (
                  <TouchableOpacity
                    style={styles.cancelDetailBtn}
                    onPress={() => {
                      const bookingId = selectedHistoryBooking.id;
                      setSelectedHistoryBooking(null);
                      handleCancelBooking(bookingId);
                    }}
                  >
                    <Text style={styles.cancelDetailBtnText}>Cancel Booking</Text>
                  </TouchableOpacity>
                ) : (
                  selectedHistoryBooking.status === "confirmed" ? (
                    <View style={styles.noCancelContainer}>
                      <Ionicons name="alert-circle-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={styles.noCancelText}>No cancellation available</Text>
                    </View>
                  ) : null
                )}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FILTER OPTION MODAL (SPORT & DISTANCE) */}
      {renderFilterOptionModal()}

      {/* WRITE A REVIEW MODAL DIALOG */}
      <Modal
        visible={showWriteReviewModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWriteReviewModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setShowWriteReviewModal(false)}
        >
          <View style={styles.writeReviewModalContent}>
            {/* Drag Handle */}
            <View style={styles.modalDragHandle} />

            {/* Header */}
            <View style={styles.modalHeaderBorder}>
              <Text style={styles.modalTitle}>Write a Review</Text>
              <TouchableOpacity onPress={() => setShowWriteReviewModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Star Selector */}
            <Text style={styles.ratingLabel}>Select Rating</Text>
            <View style={styles.starSelectionRowModal}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setNewReviewRating(star)} style={styles.starBtn}>
                  <Ionicons 
                    name={star <= newReviewRating ? "star" : "star-outline"} 
                    size={32} 
                    color="#FFD700" 
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment Input */}
            <Text style={styles.ratingLabel}>Your Comments</Text>
            <TextInput
              style={styles.reviewInputModal}
              placeholder="Share your playing experience at this venue..."
              placeholderTextColor={COLORS.textSecondary}
              value={newReviewText}
              onChangeText={setNewReviewText}
              multiline
              numberOfLines={4}
            />

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitReviewBtnModal} onPress={handleAddReview}>
              <Text style={styles.submitReviewBtnTextModal}>Submit Review</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerIconBtn: {
    marginRight: 16,
    padding: 4,
  },
  headerBackBtn: {
    marginLeft: 16,
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingHorizontal: SPACING.md,
    height: 48,
    ...SHADOWS.soft,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  filterBtn: {
    padding: 4,
  },
  filterPillsRow: {
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  filterPillsScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E4ECFA",
    ...SHADOWS.soft,
  },
  filterPillText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  categoriesContainer: {
    paddingBottom: 40,
  },
  sectionContainer: {
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.xl,
    marginBottom: 10,
  },
  horizontalScroll: {
    paddingHorizontal: SPACING.xl,
    gap: 14,
    paddingBottom: 6,
  },
  card: {
    width: 160,
    backgroundColor: "#DDE8F9",
    borderRadius: 16,
    overflow: "hidden",
    ...SHADOWS.soft,
  },
  cardImageWrapper: {
    position: "relative",
    width: "100%",
    height: 100,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26, 26, 26, 0.65)",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  ratingText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  cardContent: {
    padding: 10,
    gap: 4,
  },
  cardName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardLocation: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
    flex: 1,
  },
  cardPrice: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
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
  ratingBadgeVertical: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  ratingTextVertical: {
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
  carouselContainer: {
    position: "relative",
    width: width - SPACING.xl * 2,
    height: 180,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: COLORS.cardBackground,
  },
  detailImg: {
    width: width - SPACING.xl * 2,
    height: 180,
    resizeMode: "cover",
  },
  dotsIndicator: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  activeDot: {
    backgroundColor: "#FFFFFF",
    width: 18,
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
  detailLocContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  detailLoc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  directionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 4,
  },
  directionBtnText: {
    color: COLORS.surface,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
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
  sportsSelectionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sportOptionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  sportOptionText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  bookActionBtnWide: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  bookActionBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.surface,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 80,
    width: "100%",
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
  cancelBookingBtn: {
    backgroundColor: COLORS.error + "15",
    borderColor: COLORS.error,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelBookingText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.error,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  modalCloseBtn: {
    padding: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    maxHeight: "75%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalDragHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#E4ECFA",
    borderRadius: 2.5,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 15,
  },
  modalHeaderBorder: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalOptionsContainer: {
    gap: 10,
  },
  modalOptionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F4F7FD",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4ECFA",
  },
  modalOptionActive: {
    backgroundColor: "#E4ECFA",
    borderColor: COLORS.primary + "30",
  },
  modalOptionText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  modalOptionTextActive: {
    color: COLORS.primary,
    fontFamily: "Poppins_600SemiBold",
  },
  reviewsTestimonialSection: {
    marginTop: 24,
    marginBottom: 10,
  },
  reviewsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  reviewsTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  writeReviewLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  writeReviewLinkText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  testimonialScroll: {
    gap: 14,
    paddingBottom: 10,
  },
  testimonialCard: {
    width: 260,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  testimonialHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  testimonialUser: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  testimonialDate: {
    fontFamily: "Poppins_400Regular",
    fontSize: 9,
    color: COLORS.textSecondary,
  },
  testimonialComment: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
  noReviewsText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginVertical: 10,
  },
  writeReviewModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  ratingLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  starSelectionRowModal: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    justifyContent: "center",
  },
  starBtn: {
    padding: 4,
  },
  reviewInputModal: {
    backgroundColor: "#F4F7FD",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 14,
    minHeight: 100,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  submitReviewBtnModal: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  submitReviewBtnTextModal: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.surface,
  },
  verticalReviewsList: {
    gap: 12,
    marginTop: 4,
  },
  verticalReviewItem: {
    backgroundColor: COLORS.surface,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  bookingDetailModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    width: "100%",
    position: "absolute",
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  bookingDetailScrollBody: {
    paddingBottom: 20,
  },
  detailHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  detailVenueName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F7FD",
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  detailPrice: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.primary,
    marginTop: 2,
  },
  cancelDetailBtn: {
    backgroundColor: COLORS.error,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
    ...SHADOWS.medium,
  },
  cancelDetailBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.surface,
  },
  noCancelContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F4F7FD",
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noCancelText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
