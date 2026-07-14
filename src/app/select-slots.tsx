import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  Modal
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import { RootState } from "../redux/store";
import api from "../services/api";
import { updateWallet } from "../redux/authSlice";

const { width } = Dimensions.get("window");

export default function SelectSlotsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ 
    venueId: string; 
    sport: string; 
    venueName: string; 
    pricePerHour: string;
  }>();
  
  const auth = useSelector((state: RootState) => state.auth);

  // States
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<any[]>([]);
  const [bookingDuration, setBookingDuration] = useState(1);
  const [selectedBlockIdx, setSelectedBlockIdx] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState("All");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Multi-step booking flow states
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [bookingFlowStep, setBookingFlowStep] = useState<"select_type" | "select_game" | "request_access" | "select_payment_option" | "select_players" | "select_payment_method">("select_type");
  const [myJoinedGames, setMyJoinedGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const [bookingAccessStatus, setBookingAccessStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [accessRequestLoading, setAccessRequestLoading] = useState(false);
  const [paymentOption, setPaymentOption] = useState<"full" | "split">("full");
  const [selectedPlayersForSplit, setSelectedPlayersForSplit] = useState<number[]>([]);
  const [pendingPayableAmount, setPendingPayableAmount] = useState(0);

  const SESSIONS = ["All", "Morning", "Afternoon", "Evening", "Night"];

  // Generate 7 days from today
  const getDaysArray = () => {
    const days = [];
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({
        dayName: i === 0 ? "Today" : weekdays[d.getDay()],
        dateNum: d.getDate(),
        fullDateStr: d.toISOString().split("T")[0] // YYYY-MM-DD
      });
    }
    return days;
  };
  const datesList = getDaysArray();

  const loadSlots = async (vId: number, dateStr: string) => {
    setSlotsLoading(true);
    try {
      const res = await api.get(`/venue/${vId}/slots?booking_date=${dateStr}`);
      setSlots(res.data);
    } catch (err) {
      console.log("Error loading slots:", err);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    const today = datesList[0].fullDateStr;
    setSelectedDate(today);
  }, []);

  useEffect(() => {
    if (selectedDate && params.venueId) {
      setSelectedBlockIdx(null);
      loadSlots(parseInt(params.venueId), selectedDate);
    }
  }, [selectedDate, params.venueId]);

  useEffect(() => {
    setSelectedBlockIdx(null); // Reset selection when duration or session changes
  }, [bookingDuration, selectedSession]);

  // Formatter to 12 hour format with AM/PM
  const formatTo12Hour = (time24: string) => {
    if (!time24) return "";
    const [hourStr, minStr] = time24.split(":");
    let hour = parseInt(hourStr);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    hour = hour ? hour : 12; // 0 should be 12
    return `${hour}:${minStr} ${ampm}`;
  };

  // Generate candidate blocks based on the selected duration
  const getCandidateBlocks = () => {
    if (slots.length === 0) return [];
    
    // Get current local date and time strings
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const dateNum = String(now.getDate()).padStart(2, '0');
    const localTodayStr = `${year}-${month}-${dateNum}`;
    
    const curHour = now.getHours();
    const curMin = now.getMinutes();
    const curTimeStr = `${String(curHour).padStart(2, '0')}:${String(curMin).padStart(2, '0')}`;
    
    const blocks = [];
    const slotsNeeded = 2 * bookingDuration - 1;
    for (let i = 0; i <= slots.length - slotsNeeded; i++) {
      // If selected date is today and this slot start time has already passed, skip it
      if (selectedDate === localTodayStr && slots[i].start_time < curTimeStr) {
        continue;
      }
      
      let isAvailable = true;
      for (let offset = 0; offset < slotsNeeded; offset++) {
        if (!slots[i + offset].available) {
          isAvailable = false;
          break;
        }
      }
      
      const startTime24 = slots[i].start_time;
      const endTime24 = slots[i + slotsNeeded - 1].end_time;
      
      blocks.push({
        startIdx: i,
        start_time_24: startTime24,
        end_time_24: endTime24,
        label: `${formatTo12Hour(startTime24)} - ${formatTo12Hour(endTime24)}`,
        available: isAvailable
      });
    }
    return blocks;
  };

  const candidateBlocks = getCandidateBlocks();

  const getFilteredBlocks = () => {
    if (!selectedDate) return [];
    
    const isToday = selectedDate === new Date().toISOString().split("T")[0];
    const localNow = new Date();
    const curHour = localNow.getHours();
    const curMin = localNow.getMinutes();
    
    return candidateBlocks.filter(block => {
      const start24 = block.start_time_24;
      if (selectedSession !== "All") {
        let matchesSession = false;
        if (selectedSession === "Morning") {
          matchesSession = start24 >= "06:00" && start24 < "12:00";
        } else if (selectedSession === "Afternoon") {
          matchesSession = start24 >= "12:00" && start24 < "16:00";
        } else if (selectedSession === "Evening") {
          matchesSession = start24 >= "16:00" && start24 < "20:00";
        } else if (selectedSession === "Night") {
          matchesSession = start24 >= "20:00" || start24 < "06:00";
        }
        if (!matchesSession) return false;
      }
      
      if (isToday) {
        const [sh, sm] = start24.split(":").map(Number);
        if (sh < curHour || (sh === curHour && sm <= curMin)) {
          return false;
        }
      }
      
      return true;
    });
  };

  const filteredBlocks = getFilteredBlocks();

  const handleBookSlot = () => {
    if (selectedBlockIdx === null) {
      Alert.alert("Selection Required", "Please select an available booking block.");
      return;
    }

    const selectedBlock = candidateBlocks.find(b => b.startIdx === selectedBlockIdx);
    if (!selectedBlock) {
      Alert.alert("Selection Required", "Please select an available booking block.");
      return;
    }

    setShowFlowModal(true);
    setBookingFlowStep("select_type");
    setSelectedGame(null);
    setPaymentOption("full");
    const currentUserId = auth.user?.id;
    setSelectedPlayersForSplit(currentUserId ? [currentUserId] : []);
  };

  const executeFinalBooking = async (payableAmount: number, paymentMethod: string) => {
    const selectedBlock = candidateBlocks.find(b => b.startIdx === selectedBlockIdx);
    if (!selectedBlock) return;

    if (paymentMethod === "wallet") {
      const balance = auth.wallet?.balance || 0;
      if (balance < payableAmount) {
        Alert.alert(
          "Insufficient Balance", 
          `Booking costs Rs. ${payableAmount}, but your wallet balance is Rs. ${balance}. Please add money.`,
          [
            { text: "Cancel" }
          ]
        );
        return;
      }
    } else {
      setBookingLoading(true);
      setShowFlowModal(false);
      // Simulate mock payment gateway load delay
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setBookingLoading(true);
    setShowFlowModal(false);
    try {
      await api.post("/book-venue", {
        venue_id: parseInt(params.venueId!),
        booking_date: selectedDate,
        start_time: selectedBlock.start_time_24 + ":00",
        end_time: selectedBlock.end_time_24 + ":00",
        amount_paid: payableAmount,
        game_id: selectedGame ? selectedGame.id : null,
        payment_method: paymentMethod
      });

      Alert.alert("Booking Confirmed!", `Successfully booked slot at ${params.venueName} via ${paymentMethod.toUpperCase()} for Rs. ${payableAmount}!`, [
        { 
          text: "OK", 
          onPress: () => {
            router.replace("/(tabs)/booking" as any);
          } 
        }
      ]);
      
      // Update wallet balance in store
      const walletRes = await api.get("/profile/wallet");
      dispatch(updateWallet(parseFloat(walletRes.data.balance)));
    } catch (err: any) {
      Alert.alert("Booking Failed", err.response?.data?.detail || "Transaction failed.");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleChooseGameBooking = async () => {
    try {
      const res = await api.get("/my-joined-games");
      const selectedSport = params.sport || "";
      const filtered = res.data.filter((g: any) => g.sport_type?.toLowerCase() === selectedSport.toLowerCase());
      setMyJoinedGames(filtered);
      if (filtered.length === 0) {
        Alert.alert(
          "No Matching Games",
          `You haven't joined any games for '${selectedSport}' yet. You can only proceed with an individual booking.`,
          [
            { text: "Book Individually", onPress: () => setBookingFlowStep("select_type") },
            { text: "Cancel" }
          ]
        );
        return;
      }
      setBookingFlowStep("select_game");
    } catch (err) {
      console.log("Error loading joined games:", err);
      Alert.alert("Error", "Could not load joined games.");
    }
  };

  const handleSelectGame = async (game: any) => {
    setSelectedGame(game);
    const currentUserId = auth.user?.id;
    if (game.host_id === currentUserId) {
      setBookingAccessStatus("approved");
      setSelectedPlayersForSplit(currentUserId ? [currentUserId] : []);
      setBookingFlowStep("select_payment_option");
    } else {
      try {
        const accessRes = await api.get(`/game/${game.id}/booking-access`);
        const status = accessRes.data.status;
        setBookingAccessStatus(status);
        if (status === "approved") {
          setSelectedPlayersForSplit(currentUserId ? [currentUserId] : []);
          setBookingFlowStep("select_payment_option");
        } else {
          setBookingFlowStep("request_access");
        }
      } catch (err) {
        console.log("Error checking booking access:", err);
        Alert.alert("Error", "Could not check booking access status.");
      }
    }
  };

  const handleRequestAccess = async () => {
    if (!selectedGame) return;
    setAccessRequestLoading(true);
    try {
      await api.post(`/game/${selectedGame.id}/request-booking-access`);
      setBookingAccessStatus("pending");
      Alert.alert("Request Sent", "Booking access request has been sent to the game host.");
    } catch (err: any) {
      Alert.alert("Request Failed", err.response?.data?.detail || "Could not request access.");
    } finally {
      setAccessRequestLoading(false);
    }
  };

  const checkAccessStatusAgain = async () => {
    if (!selectedGame) return;
    try {
      const accessRes = await api.get(`/game/${selectedGame.id}/booking-access`);
      const status = accessRes.data.status;
      setBookingAccessStatus(status);
      if (status === "approved") {
        const currentUserId = auth.user?.id;
        setSelectedPlayersForSplit(currentUserId ? [currentUserId] : []);
        setBookingFlowStep("select_payment_option");
        Alert.alert("Access Approved!", "The host has approved your booking access request.");
      } else {
        Alert.alert("Pending", "Booking access request is still pending host approval.");
      }
    } catch (err) {
      console.log("Error checking status:", err);
    }
  };

  const currentMonthName = new Date().toLocaleString("default", { month: "long" });

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Select Slots",
          headerBackTitle: "Back",
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Venue Info */}
        <View style={styles.venueInfoCard}>
          <Text style={styles.venueNameText}>{params.venueName}</Text>
          <View style={styles.sportInfoRow}>
            <MaterialCommunityIcons name="soccer" size={16} color={COLORS.primary} />
            <Text style={styles.sportTypeText}>{params.sport}</Text>
          </View>
        </View>

        {/* Date Selector Section */}
        <View style={styles.dateSelectorSection}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <Text style={styles.monthLabel}>{currentMonthName}</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datesScroll}>
            {datesList.map((day) => {
              const isSelected = selectedDate === day.fullDateStr;
              return (
                <TouchableOpacity
                  key={day.fullDateStr}
                  style={[styles.dateCard, isSelected ? styles.dateCardActive : null]}
                  onPress={() => {
                    setSelectedDate(day.fullDateStr);
                  }}
                >
                  <Text style={[styles.dayText, isSelected ? styles.dayTextActive : null]}>{day.dayName}</Text>
                  <Text style={[styles.dateNumberText, isSelected ? styles.dateNumberActive : null]}>{day.dateNum}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Duration Selector Section */}
        <View style={styles.dateSelectorSection}>
          <Text style={styles.sectionTitle}>Select Duration</Text>
          <View style={styles.durationPillsRow}>
            {[1, 2, 3, 4].map((hr) => (
              <TouchableOpacity
                key={hr}
                style={[
                  styles.durationPill,
                  bookingDuration === hr ? styles.durationPillActive : null
                ]}
                onPress={() => {
                  setBookingDuration(hr);
                }}
              >
                <Text style={[
                  styles.durationPillText,
                  bookingDuration === hr ? styles.durationPillTextActive : null
                ]}>
                  {hr} {hr === 1 ? "Hour" : "Hours"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Session Selector Section */}
        <View style={styles.dateSelectorSection}>
          <Text style={styles.sectionTitle}>Select Session</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionPillsScroll}>
            {SESSIONS.map((session) => (
              <TouchableOpacity
                key={session}
                style={[
                  styles.sessionPill,
                  selectedSession === session ? styles.sessionPillActive : null
                ]}
                onPress={() => setSelectedSession(session)}
              >
                <Text style={[
                  styles.sessionPillText,
                  selectedSession === session ? styles.sessionPillTextActive : null
                ]}>
                  {session}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Slots Grid Section */}
        <View style={styles.slotsSection}>
          <Text style={styles.sectionTitle}>Available Slots</Text>
          
          {slotsLoading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 30 }} />
          ) : filteredBlocks.length > 0 ? (
            <View style={styles.slotsGrid}>
              {filteredBlocks.map((block, idx) => {
                const isSelected = selectedBlockIdx === block.startIdx;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.slotBlockBox,
                      !block.available ? styles.slotBooked : null,
                      isSelected ? styles.slotSelected : null
                    ]}
                    disabled={!block.available}
                    onPress={() => setSelectedBlockIdx(block.startIdx)}
                  >
                    <Text style={[
                      styles.slotTimeText,
                      !block.available ? styles.slotTimeBookedText : null,
                      isSelected ? styles.slotTimeSelectedText : null
                    ]}>
                      {block.label}
                    </Text>
                    <Text style={styles.slotAvailText}>
                      {block.available ? "Available" : "Booked"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No slots matching this duration or session are available.</Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Sticky Checkout Panel */}
      {selectedBlockIdx !== null && (
        <View style={[styles.checkoutPanel, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View>
            <Text style={styles.checkoutLabel}>Total Price ({bookingDuration} {bookingDuration === 1 ? "hr" : "hrs"})</Text>
            <Text style={styles.checkoutPrice}>Rs. {parseFloat(params.pricePerHour || "0") * bookingDuration}</Text>
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
      {/* BOOKING OPTIONS FLOW MODAL */}
      <Modal
        visible={showFlowModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFlowModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setShowFlowModal(false)}
        >
          <View style={styles.flowModalContent}>
            {/* Drag Handle */}
            <View style={styles.modalDragHandle} />

            {/* Step: Select Type */}
            {bookingFlowStep === "select_type" && (
              <View>
                <View style={styles.modalHeaderBorder}>
                  <Text style={styles.modalTitle}>Select Booking Type</Text>
                  <TouchableOpacity onPress={() => setShowFlowModal(false)} style={styles.modalCloseBtn}>
                    <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.optionBtn}
                  onPress={() => {
                    const price = parseFloat(params.pricePerHour || "0") * bookingDuration;
                    setPendingPayableAmount(price);
                    setBookingFlowStep("select_payment_method");
                  }}
                >
                  <View style={styles.optionIconWrapper}>
                    <Ionicons name="person-outline" size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.optionTextWrapper}>
                    <Text style={styles.optionTitle}>Individual Booking</Text>
                    <Text style={styles.optionSubtitle}>Book for yourself and your offline friends</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.optionBtn, { marginTop: 12 }]}
                  onPress={handleChooseGameBooking}
                >
                  <View style={styles.optionIconWrapper}>
                    <Ionicons name="people-outline" size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.optionTextWrapper}>
                    <Text style={styles.optionTitle}>Book for a Game</Text>
                    <Text style={styles.optionSubtitle}>Select a game you joined to book this venue</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Step: Select Game */}
            {bookingFlowStep === "select_game" && (
              <View>
                <View style={styles.modalHeaderBorder}>
                  <TouchableOpacity onPress={() => setBookingFlowStep("select_type")} style={styles.backArrowBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Choose a Game</Text>
                  <TouchableOpacity onPress={() => setShowFlowModal(false)} style={styles.modalCloseBtn}>
                    <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.gameListScroll} showsVerticalScrollIndicator={false}>
                  {myJoinedGames.map((game) => (
                    <TouchableOpacity 
                      key={game.id}
                      style={styles.gameCard}
                      onPress={() => handleSelectGame(game)}
                    >
                      <View style={styles.gameCardHeader}>
                        <Text style={styles.gameCardName}>{game.name}</Text>
                        <Text style={styles.gameCardSport}>{game.sport_type}</Text>
                      </View>
                      <Text style={styles.gameCardDetails}>Host: {game.host_username}</Text>
                      <Text style={styles.gameCardDetails}>Date: {game.game_date} ({game.joined_count} players)</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Step: Request Access */}
            {bookingFlowStep === "request_access" && selectedGame && (
              <View>
                <View style={styles.modalHeaderBorder}>
                  <TouchableOpacity onPress={() => setBookingFlowStep("select_game")} style={styles.backArrowBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Access Authorization</Text>
                  <TouchableOpacity onPress={() => setShowFlowModal(false)} style={styles.modalCloseBtn}>
                    <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.accessContainer}>
                  <Ionicons name="lock-closed-outline" size={48} color={COLORS.error} style={{ alignSelf: "center", marginBottom: 12 }} />
                  <Text style={styles.accessTitle}>Host Permission Required</Text>
                  <Text style={styles.accessSubtitle}>
                    Only the host of '{selectedGame.name}' can book slots for the game. Since you are not the host ({selectedGame.host_username}), you must request booking access from them.
                  </Text>

                  {bookingAccessStatus === "none" && (
                    <TouchableOpacity 
                      style={[styles.actionBtn, accessRequestLoading ? styles.btnDisabled : null]}
                      onPress={handleRequestAccess}
                      disabled={accessRequestLoading}
                    >
                      {accessRequestLoading ? (
                        <ActivityIndicator color={COLORS.surface} />
                      ) : (
                        <Text style={styles.actionBtnText}>Request Access from Host</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {bookingAccessStatus === "pending" && (
                    <View style={{ width: "100%" }}>
                      <View style={styles.pendingIndicator}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={styles.pendingText}>Access Request Pending Host Approval</Text>
                      </View>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { marginTop: 12, backgroundColor: COLORS.success }]}
                        onPress={checkAccessStatusAgain}
                      >
                        <Text style={styles.actionBtnText}>Check Access Status Again</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {bookingAccessStatus === "rejected" && (
                    <View style={{ width: "100%" }}>
                      <Text style={[styles.accessSubtitle, { color: COLORS.error, fontWeight: "600" }]}>
                        Your previous booking access request was rejected by the host.
                      </Text>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { marginTop: 12 }]}
                        onPress={handleRequestAccess}
                      >
                        <Text style={styles.actionBtnText}>Request Access Again</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Step: Select Payment Option */}
            {bookingFlowStep === "select_payment_option" && selectedGame && (
              <View>
                <View style={styles.modalHeaderBorder}>
                  <TouchableOpacity onPress={() => setBookingFlowStep("select_game")} style={styles.backArrowBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Payment Split Option</Text>
                  <TouchableOpacity onPress={() => setShowFlowModal(false)} style={styles.modalCloseBtn}>
                    <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.optionBtn}
                  onPress={() => {
                    const price = parseFloat(params.pricePerHour || "0") * bookingDuration;
                    setPendingPayableAmount(price);
                    setBookingFlowStep("select_payment_method");
                  }}
                >
                  <View style={styles.optionIconWrapper}>
                    <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.optionTextWrapper}>
                    <Text style={styles.optionTitle}>Pay Full Amount</Text>
                    <Text style={styles.optionSubtitle}>Pay Rs. {parseFloat(params.pricePerHour || "0") * bookingDuration} by yourself</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.optionBtn, { marginTop: 12 }]}
                  onPress={() => {
                    setPaymentOption("split");
                    setBookingFlowStep("select_players");
                  }}
                >
                  <View style={styles.optionIconWrapper}>
                    <Ionicons name="pie-chart-outline" size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.optionTextWrapper}>
                    <Text style={styles.optionTitle}>Split Payment</Text>
                    <Text style={styles.optionSubtitle}>Select players in the game to pay for</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Step: Select Players for Split */}
            {bookingFlowStep === "select_players" && selectedGame && (
              <View>
                <View style={styles.modalHeaderBorder}>
                  <TouchableOpacity onPress={() => setBookingFlowStep("select_payment_option")} style={styles.backArrowBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Select Players</Text>
                  <TouchableOpacity onPress={() => setShowFlowModal(false)} style={styles.modalCloseBtn}>
                    <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.splitDescription}>
                  Total game fee: Rs. {parseFloat(params.pricePerHour || "0") * bookingDuration}. Total players in game: {selectedGame.participants.length}. Fee share per player: Rs. {(parseFloat(params.pricePerHour || "0") * bookingDuration / selectedGame.participants.length).toFixed(2)}. Select who you are paying for:
                </Text>

                <ScrollView style={styles.playerListScroll} showsVerticalScrollIndicator={false}>
                  {selectedGame.participants.map((player: any) => {
                    const isChecked = selectedPlayersForSplit.includes(player.user_id);
                    const isCurrentUser = player.user_id === auth.user?.id;
                    return (
                      <TouchableOpacity 
                        key={player.user_id}
                        style={styles.playerRow}
                        disabled={isCurrentUser}
                        onPress={() => {
                          if (isChecked) {
                            setSelectedPlayersForSplit(selectedPlayersForSplit.filter(id => id !== player.user_id));
                          } else {
                            setSelectedPlayersForSplit([...selectedPlayersForSplit, player.user_id]);
                          }
                        }}
                      >
                        <View style={styles.playerInfo}>
                          <Ionicons name="person-circle-outline" size={24} color={COLORS.textSecondary} />
                          <Text style={styles.playerName}>{player.username} {isCurrentUser ? "(You)" : ""}</Text>
                        </View>
                        <Ionicons 
                          name={isChecked ? "checkbox" : "square-outline"} 
                          size={24} 
                          color={isCurrentUser ? COLORS.textSecondary : COLORS.primary} 
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.splitFooter}>
                  <View>
                    <Text style={styles.splitFooterLabel}>Paying for {selectedPlayersForSplit.length} {selectedPlayersForSplit.length === 1 ? "player" : "players"}</Text>
                    <Text style={styles.splitFooterPrice}>Rs. {(parseFloat(params.pricePerHour || "0") * bookingDuration / selectedGame.participants.length * selectedPlayersForSplit.length).toFixed(2)}</Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.confirmSplitBtn}
                    onPress={() => {
                      const share = parseFloat(params.pricePerHour || "0") * bookingDuration / selectedGame.participants.length;
                      const total = share * selectedPlayersForSplit.length;
                      setPendingPayableAmount(total);
                      setBookingFlowStep("select_payment_method");
                    }}
                  >
                    <Text style={styles.confirmSplitText}>Confirm Booking</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {/* Step: Select Payment Method */}
            {bookingFlowStep === "select_payment_method" && (
              <View>
                <View style={styles.modalHeaderBorder}>
                  <TouchableOpacity 
                    onPress={() => {
                      if (selectedGame) {
                        if (paymentOption === "split") {
                          setBookingFlowStep("select_players");
                        } else {
                          setBookingFlowStep("select_payment_option");
                        }
                      } else {
                        setBookingFlowStep("select_type");
                      }
                    }} 
                    style={styles.backArrowBtn}
                  >
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Payment Method</Text>
                  <TouchableOpacity onPress={() => setShowFlowModal(false)} style={styles.modalCloseBtn}>
                    <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.paymentSummaryLabel}>Payable Amount: Rs. {pendingPayableAmount.toFixed(2)}</Text>

                {/* Option: Wallet */}
                <TouchableOpacity 
                  style={styles.optionBtn}
                  onPress={() => executeFinalBooking(pendingPayableAmount, "wallet")}
                >
                  <View style={styles.optionIconWrapper}>
                    <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.optionTextWrapper}>
                    <Text style={styles.optionTitle}>SportCircle Wallet</Text>
                    <Text style={styles.optionSubtitle}>Available Balance: Rs. {auth.wallet?.balance || "0"}</Text>
                  </View>
                </TouchableOpacity>

                {/* Option: UPI */}
                <TouchableOpacity 
                  style={[styles.optionBtn, { marginTop: 12 }]}
                  onPress={() => executeFinalBooking(pendingPayableAmount, "upi")}
                >
                  <View style={styles.optionIconWrapper}>
                    <Ionicons name="phone-portrait-outline" size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.optionTextWrapper}>
                    <Text style={styles.optionTitle}>UPI (GPay / PhonePe / Paytm)</Text>
                    <Text style={styles.optionSubtitle}>Pay instantly using any UPI app</Text>
                  </View>
                </TouchableOpacity>

                {/* Option: Card */}
                <TouchableOpacity 
                  style={[styles.optionBtn, { marginTop: 12 }]}
                  onPress={() => executeFinalBooking(pendingPayableAmount, "card")}
                >
                  <View style={styles.optionIconWrapper}>
                    <Ionicons name="card-outline" size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.optionTextWrapper}>
                    <Text style={styles.optionTitle}>Credit / Debit Card</Text>
                    <Text style={styles.optionSubtitle}>Pay securely using Visa, Mastercard, RuPay etc.</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  venueInfoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
    marginBottom: 20,
  },
  venueNameText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  sportInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  sportTypeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.primary,
  },
  dateSelectorSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  monthLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 8,
  },
  datesScroll: {
    gap: 12,
    paddingBottom: 4,
  },
  dateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    width: 60,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E4ECFA",
    ...SHADOWS.soft,
  },
  dateCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  dayTextActive: {
    color: COLORS.surface + "C0",
  },
  dateNumberText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  dateNumberActive: {
    color: COLORS.surface,
  },
  slotsSection: {
    marginBottom: 20,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  slotBlockBox: {
    width: (width - SPACING.xl * 2 - 12) / 2,
    height: 56,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
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
    fontSize: 11,
    color: COLORS.textPrimary,
    textAlign: "center",
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
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  checkoutPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.xl,
    paddingTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 10,
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
  durationPillsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  durationPill: {
    backgroundColor: COLORS.surface,
    borderColor: "#E4ECFA",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    ...SHADOWS.soft,
  },
  durationPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  durationPillText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  durationPillTextActive: {
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.surface,
  },
  sessionPillsScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  sessionPill: {
    backgroundColor: COLORS.surface,
    borderColor: "#E4ECFA",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    ...SHADOWS.soft,
  },
  sessionPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sessionPillText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  sessionPillTextActive: {
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.surface,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  flowModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    width: "100%",
    maxHeight: "85%",
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: "center",
  },
  modalCloseBtn: {
    padding: 4,
  },
  backArrowBtn: {
    padding: 4,
    marginRight: 8,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F7FD",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E4ECFA",
  },
  optionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  optionTextWrapper: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  optionSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  gameListScroll: {
    maxHeight: 300,
    marginBottom: 10,
  },
  gameCard: {
    backgroundColor: "#F4F7FD",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4ECFA",
    marginBottom: 10,
  },
  gameCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  gameCardName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  gameCardSport: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.primary,
    backgroundColor: COLORS.primary + "12",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gameCardDetails: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  accessContainer: {
    alignItems: "stretch",
    paddingVertical: 10,
  },
  accessTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  accessSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  actionBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.surface,
  },
  pendingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary + "08",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
  },
  pendingText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.primary,
  },
  splitDescription: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: 16,
  },
  playerListScroll: {
    maxHeight: 200,
    marginBottom: 20,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F4F7FD",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E4ECFA",
  },
  playerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playerName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  splitFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  splitFooterLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  splitFooterPrice: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.primary,
  },
  confirmSplitBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    ...SHADOWS.medium,
  },
  confirmSplitText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.surface,
  },
  paymentSummaryLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: "#F4F7FD",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#E4ECFA",
  },
});
