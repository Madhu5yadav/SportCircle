import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { logout, updateWallet } from "../../redux/authSlice";
import { RootState } from "../../redux/store";
import api from "../../services/api";
import { SocketService } from "../../services/socket";
import { StorageService } from "../../services/storage";
import { COLORS, SHADOWS, SPACING } from "../../theme/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);
  const insets = useSafeAreaInsets();

  // States
  const [preferredSports, setPreferredSports] = useState<string[]>([]);
  const [preferredSportsDetails, setPreferredSportsDetails] = useState<any[]>([]);
  const [playingTime, setPlayingTime] = useState<string[]>([]);
  const [txHistory, setTxHistory] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showGameHistoryModal, setShowGameHistoryModal] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/profile");
      setPreferredSports(res.data.preferred_sports || []);
      setPreferredSportsDetails(res.data.preferred_sports_details || []);
      setPlayingTime(res.data.playing_time || []);

      const txs = await api.get("/profile/payments");
      setTxHistory(txs.data);

      const gamesRes = await api.get("/games");
      setGames(gamesRes.data || []);
    } catch (err) {
      console.log("Error loading profile screen details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleDepositMoney = async () => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert("Error", "Please enter a valid deposit amount.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/profile/wallet/deposit", { amount: amt });
      dispatch(updateWallet(parseFloat(res.data.balance)));
      Alert.alert("Success", `Rs. ${amt} has been successfully added to your wallet!`);
      setDepositAmount("");
      setShowWalletModal(false);
      fetchProfileData();
    } catch (err) {
      Alert.alert("Error", "Could not complete transaction.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to log out of SportCircle?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post("/logout");
          } catch (e) { }
          await StorageService.clearAll();
          SocketService.disconnect();
          dispatch(logout());
          router.replace("/login");
        }
      }
    ]);
  };

  // Filter games the user is participating in or hosting
  const userGames = games.filter((g: any) => g.is_joined || g.host_id === auth.user?.id);

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent={true} />
      {/* 1. Curved Blue Top Header Background (Moves with scroll) */}
      <View style={[styles.headertop,
      {
        height: 60 + insets.top,
        paddingTop: insets.top
      }
      ]}>
        <Text style={styles.headerUsername}>@{auth.user?.username || "UserName"}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* 1. Curved Blue Top Header Background (Moves with scroll) */}
        <View style={styles.headerBackground}>
        </View>

        {/* 2. Overlapping Light Blue Profile Card */}
        <View style={styles.profileCard}>
          {/* Circular Avatar + Details Column */}
          <View style={styles.profileHeaderRow}>
            <Image
              source={{ uri: auth.user?.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }}
              style={styles.avatar}
            />
            <View style={styles.detailsColumn}>
              <Text style={styles.fullName}>{auth.user?.first_name} {auth.user?.last_name}</Text>
              <Text style={styles.infoText}>{auth.user?.mobile}</Text>
              <Text style={styles.infoText}>{auth.user?.gender || "Gender not set"}</Text>
              <Text style={styles.bioText} numberOfLines={2}>{auth.user?.about || "Tennis & cricket player. Host games to invite me!"}</Text>
            </View>
          </View>

          {/* White Matches & Trust Score Card */}
          <View style={styles.statsCard}>
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>Total Matches</Text>
              <View style={styles.statValueRow}>
                <Ionicons name="football" size={16} color={COLORS.primary} />
                <Text style={styles.statValue}>{userGames.length || 0}</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>Trust Score</Text>
              <View style={styles.statValueRow}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.statValue}>
                  {auth.user?.trust_score && auth.user.trust_score > 0
                    ? (auth.user.trust_score % 1 === 0 ? auth.user.trust_score.toString() : auth.user.trust_score.toFixed(1))
                    : "0"}
                  /5
                </Text>
              </View>
            </View>
          </View>

          {/* Preferred Sports */}
          <Text style={styles.cardSectionTitle}>Preferred Sports</Text>
          <View style={styles.badgeContainer}>
            {preferredSports.length === 0 ? (
              <Text style={styles.emptyText}>No preferred sports added yet</Text>
            ) : (
              preferredSports.map((sport, index) => {
                const details = preferredSportsDetails.find((s: any) => s.name === sport);
                const level = details ? details.level : "Beginner";
                const levelColor = level === "Beginner" ? "#4CAF50" : level === "Intermediate" ? "#FF9800" : "#E91E63";
                const letter = level ? level.charAt(0).toUpperCase() : "B";

                return (
                  <View key={index} style={[styles.pillBadge, { position: "relative", paddingLeft: 16 }]}>
                    <View style={[styles.levelCircle, { backgroundColor: levelColor }]}>
                      <Text style={styles.levelCircleText}>{letter}</Text>
                    </View>
                    <Text style={styles.pillText}>{sport}</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Preferred Play time */}
          <Text style={styles.cardSectionTitle}>Preferred Play time</Text>
          <View style={styles.badgeContainer}>
            {playingTime.length === 0 ? (
              <Text style={styles.emptyText}>No play times set</Text>
            ) : (
              playingTime.map((time, index) => (
                <View key={index} style={styles.pillBadge}>
                  <Text style={styles.pillText}>{time}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* 3. List of Options matching Figma design */}
        <View style={styles.optionsList}>
          {/* Edit Profile */}
          <TouchableOpacity style={styles.optionRow} onPress={() => router.push({ pathname: "/personal-details", params: { mode: "edit" } })}>
            <Text style={styles.optionText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Wallet */}
          <TouchableOpacity style={styles.optionRow} onPress={() => setShowWalletModal(true)}>
            <Text style={styles.optionText}>wallet</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Game History */}
          <TouchableOpacity style={styles.optionRow} onPress={() => setShowGameHistoryModal(true)}>
            <Text style={styles.optionText}>Game History</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Payment History */}
          <TouchableOpacity style={styles.optionRow} onPress={() => setShowPaymentHistoryModal(true)}>
            <Text style={styles.optionText}>Payment History</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Account Settings */}
          <TouchableOpacity style={styles.optionRow} onPress={() => setShowSettingsModal(true)}>
            <Text style={styles.optionText}>Account Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity style={styles.optionRow} onPress={() => setShowPrivacyModal(true)}>
            <Text style={styles.optionText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Help & Support */}
          <TouchableOpacity style={styles.optionRow} onPress={() => setShowSupportModal(true)}>
            <Text style={styles.optionText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity style={[styles.optionRow, { borderColor: COLORS.error, borderWidth: 1 }]} onPress={handleLogout}>
            <Text style={[styles.optionText, { color: COLORS.error }]}>Logout</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* WALLET MODAL */}
      <Modal visible={showWalletModal} transparent animationType="slide" onRequestClose={() => setShowWalletModal(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowWalletModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>SportCircle Wallet</Text>
              <TouchableOpacity onPress={() => setShowWalletModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.walletBalanceCard}>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceVal}>Rs. {Number(auth.wallet?.balance || 0).toFixed(2)}</Text>
            </View>

            <Text style={styles.inputLabel}>Add Cash (Rs.)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 500"
              keyboardType="numeric"
              value={depositAmount}
              onChangeText={setDepositAmount}
            />
            <TouchableOpacity style={styles.modalActionBtn} onPress={handleDepositMoney}>
              <Text style={styles.modalActionText}>Add Funds</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* GAME HISTORY MODAL */}
      <Modal visible={showGameHistoryModal} transparent animationType="slide" onRequestClose={() => setShowGameHistoryModal(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowGameHistoryModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Game History</Text>
              <TouchableOpacity onPress={() => setShowGameHistoryModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {userGames.length === 0 ? (
                <Text style={styles.emptyText}>No games hosted or joined yet.</Text>
              ) : (
                userGames.map((g) => {
                  let isPast = false;
                  try {
                    if (g.game_date && g.end_time) {
                      const gameEnd = new Date(`${g.game_date}T${g.end_time}`);
                      isPast = gameEnd.getTime() < new Date().getTime();
                    } else if (g.game_date) {
                      const gameStart = new Date(g.game_date);
                      isPast = gameStart.getTime() < new Date().getTime();
                    }
                  } catch (e) {
                    isPast = false;
                  }
                  return (
                    <View key={g.id} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <View style={styles.sportBadge}>
                          <Text style={styles.sportText}>{g.sport_type}</Text>
                        </View>
                        <Text style={[styles.statusBadge, isPast ? styles.pastStatus : styles.upcomingStatus]}>
                          {isPast ? "Played" : "Upcoming"}
                        </Text>
                      </View>
                      <Text style={styles.historyName}>{g.name}</Text>
                      <Text style={styles.historyLoc}>
                        <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} /> {g.location}
                      </Text>
                      <Text style={styles.historyDate}>
                        <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} /> {g.game_date} @ {g.start_time.slice(0, 5)}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* PAYMENT HISTORY MODAL */}
      <Modal visible={showPaymentHistoryModal} transparent animationType="slide" onRequestClose={() => setShowPaymentHistoryModal(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowPaymentHistoryModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Payment History</Text>
              <TouchableOpacity onPress={() => setShowPaymentHistoryModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {txHistory.length === 0 ? (
                <Text style={styles.emptyText}>No recent transactions</Text>
              ) : (
                txHistory.map((tx) => (
                  <View key={tx.id} style={styles.txItem}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                      <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={[styles.txAmt, tx.type === "credit" ? styles.txCredit : styles.txDebit]}>
                      {tx.type === "credit" ? "+" : "-"} Rs.{tx.amount}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ACCOUNT SETTINGS MODAL */}
      <Modal visible={showSettingsModal} transparent animationType="slide" onRequestClose={() => setShowSettingsModal(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowSettingsModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Account Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalListItem} onPress={() => { setShowSettingsModal(false); router.push("/reset-password"); }}>
              <Ionicons name="key-outline" size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
              <Text style={styles.modalListText}>Change Password</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalListItem} onPress={() => { setShowSettingsModal(false); router.push("/personal-details"); }}>
              <Ionicons name="create-outline" size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
              <Text style={styles.modalListText}>Update Profile Details</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* PRIVACY POLICY MODAL */}
      <Modal visible={showPrivacyModal} transparent animationType="slide" onRequestClose={() => setShowPrivacyModal(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowPrivacyModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              <Text style={styles.policyText}>
                At SportCircle, we take your privacy seriously. We only gather and process information required to offer sports matching and turf bookings near you.
                {"\n\n"}
                We do not sell your personal data or contact details to third parties. GPS location details are exclusively used to discover local sporting venues and active matches.
              </Text>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* HELP & SUPPORT MODAL */}
      <Modal visible={showSupportModal} transparent animationType="slide" onRequestClose={() => setShowSupportModal(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowSupportModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Help & Support</Text>
              <TouchableOpacity onPress={() => setShowSupportModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.supportLabel}>Have queries or need booking assistance?</Text>
            <View style={styles.supportRow}>
              <Ionicons name="mail" size={20} color={COLORS.primary} />
              <Text style={styles.supportValue}>support@sportcircle.com</Text>
            </View>
            <View style={styles.supportRow}>
              <Ionicons name="call" size={20} color={COLORS.primary} />
              <Text style={styles.supportValue}>+91 98765 43210</Text>
            </View>
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
  scrollContent: {
    paddingBottom: 40,
  },
  headertop: {
    backgroundColor: COLORS.primary,
    position: 'absolute',
    zIndex: 100,
    width: '100%',
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  headerBackground: {
    backgroundColor: COLORS.primary,
    height: 160,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  headerUsername: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: COLORS.surface,
  },
  profileCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 24,
    marginHorizontal: SPACING.xl,
    marginTop: -60, // Overlaps the blue header curve
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: "#B1CEFC",
    ...SHADOWS.medium,
  },
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
  },
  detailsColumn: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  fullName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  infoText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  bioText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  statColumn: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 4,
  },
  statDivider: {
    width: 1.5,
    height: "100%",
    backgroundColor: COLORS.border,
  },
  cardSectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: SPACING.md,
  },
  pillBadge: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  pillText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
  optionsList: {
    marginHorizontal: SPACING.xl,
    marginTop: 24,
    gap: 12,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  optionText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: 40,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.background,
    paddingBottom: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  walletBalanceCard: {
    backgroundColor: COLORS.primary + "12",
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: "center",
    marginBottom: 16,
  },
  balanceLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.primary,
  },
  balanceVal: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: COLORS.primary,
    marginTop: 4,
  },
  inputLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  modalActionBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    ...SHADOWS.soft,
  },
  modalActionText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.surface,
  },
  txTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  txItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  txDesc: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  txDate: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  txAmt: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  txCredit: {
    color: COLORS.success,
  },
  txDebit: {
    color: COLORS.error,
  },
  modalListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  modalListText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  policyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  supportLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  supportValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 12,
  },
  historyCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  statusBadge: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pastStatus: {
    backgroundColor: COLORS.border,
    color: COLORS.textSecondary,
  },
  upcomingStatus: {
    backgroundColor: COLORS.success + "15",
    color: COLORS.success,
  },
  historyName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  historyLoc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  historyDate: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  levelCircle: {
    position: "absolute",
    top: -5,
    left: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  levelCircleText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 7.5,
    color: "white",
  },
});
