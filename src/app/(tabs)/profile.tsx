import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Switch, 
  ActivityIndicator,
  Alert,
  Modal,
  FlatList
} from "react-native";
import { useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../../theme/theme";
import { RootState } from "../../redux/store";
import api from "../../services/api";
import { StorageService } from "../../services/storage";
import { logout, updateUser, updateWallet, updateSettings } from "../../redux/authSlice";
import { SocketService } from "../../services/socket";

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);

  // States
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(auth.user?.first_name || "");
  const [lastName, setLastName] = useState(auth.user?.last_name || "");
  const [aboutText, setAboutText] = useState(auth.user?.about || "");
  
  const [depositAmount, setDepositAmount] = useState("");
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [txHistory, setTxHistory] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);

  const fetchWalletTransactions = async () => {
    try {
      const res = await api.get("/profile/payments");
      setTxHistory(res.data);
    } catch (err) {
      console.log("Error loading transaction ledger:", err);
    }
  };

  useEffect(() => {
    fetchWalletTransactions();
  }, []);

  const handleUpdateProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Error", "Names cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      await api.put("/profile", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        about: aboutText.trim(),
      });

      dispatch(updateUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        about: aboutText.trim()
      }));

      setEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (err) {
      Alert.alert("Error", "Failed to update profile details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDepositMoney = async () => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert("Error", "Please enter a valid deposit amount.");
      return;
    }

    setDepositLoading(true);
    try {
      const res = await api.post("/profile/wallet/deposit", {
        amount: amt
      });
      dispatch(updateWallet(parseFloat(res.data.balance)));
      Alert.alert("Success", `Rs. ${amt} has been successfully added to your wallet!`);
      setDepositAmount("");
      setShowWalletModal(false);
      fetchWalletTransactions();
    } catch (err) {
      Alert.alert("Error", "Could not complete transaction.");
    } finally {
      setDepositLoading(false);
    }
  };

  const handleToggleSettings = async (field: "push" | "email" | "dark") => {
    if (!auth.settings) return;
    
    const payload = {
      push_enabled: field === "push" ? !auth.settings.push_enabled : auth.settings.push_enabled,
      email_enabled: field === "email" ? !auth.settings.email_enabled : auth.settings.email_enabled,
      dark_mode: field === "dark" ? !auth.settings.dark_mode : auth.settings.dark_mode
    };

    try {
      await api.put("/profile/settings", payload);
      dispatch(updateSettings({
        push_enabled: payload.push_enabled,
        email_enabled: payload.email_enabled,
        dark_mode: payload.dark_mode
      }));
    } catch (err) {
      console.log("Error updating settings:", err);
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
          } catch (e) {} // Fail silently if token already invalid
          
          await StorageService.clearAll();
          SocketService.disconnect();
          dispatch(logout());
          router.replace("/login");
        }
      }
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Profile Card details */}
      <View style={styles.profileCard}>
        <Image 
          source={{ uri: auth.user?.profile_pic || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=250" }} 
          style={styles.avatar} 
        />
        
        {editing ? (
          <View style={styles.editForm}>
            <TextInput
              style={styles.editInput}
              placeholder="First Name"
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={styles.editInput}
              placeholder="Last Name"
              value={lastName}
              onChangeText={setLastName}
            />
            <TextInput
              style={[styles.editInput, { height: 60 }]}
              placeholder="About / Bio"
              multiline
              value={aboutText}
              onChangeText={setAboutText}
            />
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={handleUpdateProfile}>
                {loading ? <ActivityIndicator size="small" color={COLORS.surface} /> : <Text style={styles.editSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.infoWrapper}>
            <Text style={styles.fullName}>{auth.user?.first_name} {auth.user?.last_name}</Text>
            <Text style={styles.username}>@{auth.user?.username}</Text>
            <Text style={styles.mobile}>{auth.user?.mobile}</Text>
            <Text style={styles.bio}>{auth.user?.about || "Tennis & cricket player. Host games to invite me!"}</Text>
            <TouchableOpacity style={styles.editToggleBtn} onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={14} color={COLORS.primary} />
              <Text style={styles.editToggleText}> Edit Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Wallet Widget */}
      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <View>
            <Text style={styles.walletTitle}>SportCircle Wallet</Text>
            <Text style={styles.walletBalance}>Rs. {auth.wallet?.balance.toFixed(2) || "0.00"}</Text>
          </View>
          <TouchableOpacity style={styles.addCashBtn} onPress={() => setShowWalletModal(true)}>
            <Ionicons name="add" size={16} color={COLORS.surface} />
            <Text style={styles.addCashBtnText}>Add Funds</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.txTitle}>Recent Transactions</Text>
        {txHistory.slice(0, 3).map((tx) => (
          <View key={tx.id} style={styles.txItem}>
            <View>
              <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
              <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={[styles.txAmt, tx.type === "credit" ? styles.txCredit : styles.txDebit]}>
              {tx.type === "credit" ? "+" : "-"} Rs.{tx.amount}
            </Text>
          </View>
        ))}
      </View>

      {/* App Settings toggles */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingLabelRow}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.textPrimary} />
            <Text style={styles.settingText}>Push Notifications</Text>
          </View>
          <Switch
            value={auth.settings?.push_enabled ?? true}
            onValueChange={() => handleToggleSettings("push")}
            trackColor={{ false: COLORS.cardBackground, true: COLORS.primary }}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLabelRow}>
            <Ionicons name="mail-outline" size={20} color={COLORS.textPrimary} />
            <Text style={styles.settingText}>Email Alerts</Text>
          </View>
          <Switch
            value={auth.settings?.email_enabled ?? true}
            onValueChange={() => handleToggleSettings("email")}
            trackColor={{ false: COLORS.cardBackground, true: COLORS.primary }}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLabelRow}>
            <Ionicons name="moon-outline" size={20} color={COLORS.textPrimary} />
            <Text style={styles.settingText}>Dark Mode Ready</Text>
          </View>
          <Switch
            value={auth.settings?.dark_mode ?? false}
            onValueChange={() => handleToggleSettings("dark")}
            trackColor={{ false: COLORS.cardBackground, true: COLORS.primary }}
          />
        </View>
      </View>

      {/* Support and Safety links */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Help & Privacy</Text>
        <TouchableOpacity style={styles.navRow}>
          <Text style={styles.navRowText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navRow}>
          <Text style={styles.navRowText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Logout button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.surface} />
        <Text style={styles.logoutBtnText}>Logout</Text>
      </TouchableOpacity>

      {/* WALLET DEPOSIT MODAL */}
      <Modal visible={showWalletModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Money to Wallet</Text>
            <Text style={styles.modalLabel}>Enter Deposit Amount (Rs.)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 500"
              keyboardType="numeric"
              value={depositAmount}
              onChangeText={setDepositAmount}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowWalletModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handleDepositMoney} disabled={depositLoading}>
                {depositLoading ? <ActivityIndicator size="small" color={COLORS.surface} /> : <Text style={styles.submitText}>Add Money</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
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
  profileCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 24,
    padding: SPACING.xl,
    alignItems: "center",
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: SPACING.md,
  },
  infoWrapper: {
    alignItems: "center",
  },
  fullName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  username: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 2,
  },
  mobile: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bio: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
  editToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderColor: COLORS.primary,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  editToggleText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.primary,
  },
  editForm: {
    width: "100%",
    gap: 10,
  },
  editInput: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  editCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  editCancelText: {
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.textSecondary,
  },
  editSaveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  editSaveText: {
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.surface,
  },
  walletCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 24,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
    marginBottom: 12,
  },
  walletTitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  walletBalance: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: COLORS.primary,
    marginTop: 2,
  },
  addCashBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  addCashBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.surface,
    marginLeft: 2,
  },
  txTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  txItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  txDesc: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
    maxWidth: 180,
  },
  txDate: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  txAmt: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
  },
  txCredit: {
    color: COLORS.success,
  },
  txDebit: {
    color: COLORS.error,
  },
  settingsSection: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 24,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  settingLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  navRowText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  logoutBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.error,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: SPACING.sm,
    ...SHADOWS.medium,
  },
  logoutBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.surface,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(26,26,26,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  modalContent: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  modalLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 12,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  cancelText: {
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  modalSubmit: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  submitText: {
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.surface,
    fontSize: 14,
  },
});
