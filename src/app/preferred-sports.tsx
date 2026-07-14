import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal
} from "react-native";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import api from "../services/api";
import { updateUser, setCredentials } from "../redux/authSlice";
import { RootState } from "../redux/store";

const { width } = Dimensions.get("window");
const ITEM_WIDTH = (width - SPACING.xl * 2 - SPACING.md * 2) / 3;

const SPORTS_LIST = [
  { id: "Cricket", label: "Cricket", icon: "cricket" },
  { id: "Football", label: "Football", icon: "soccer" },
  { id: "Basketball", label: "Basketball", icon: "basketball" },
  { id: "Badminton", label: "Badminton", icon: "badminton" },
  { id: "Volleyball", label: "Volleyball", icon: "volleyball" },
  { id: "Kabaddi", label: "Kabaddi", icon: "run" },
  { id: "Kho Kho", label: "Kho Kho", icon: "run-fast" },
  { id: "Swimming", label: "Swimming", icon: "swim" },
  { id: "Running", label: "Running", icon: "walk" },
  { id: "Golf", label: "Golf", icon: "golf" },
  { id: "Bowling", label: "Bowling", icon: "bowling" },
  { id: "Hockey", label: "Hockey", icon: "hockey-sticks" },
  { id: "Rugby", label: "Rugby", icon: "rugby" },
  { id: "Table Tennis", label: "Table Tennis", icon: "table-tennis" },
  { id: "Pickleball", label: "Pickleball", icon: "racquetball" },
  { id: "Tennis", label: "Tennis", icon: "tennis" },
];

export default function PreferredSportsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);

  const [selectedSports, setSelectedSports] = useState<{ id: string; level: string }[]>([]);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfileAndSports = async () => {
      try {
        const response = await api.get("/profile");
        const profileData = response.data;
        if (profileData.preferred_sports_details && profileData.preferred_sports_details.length > 0) {
          const mapped = profileData.preferred_sports_details.map((s: any) => ({
            id: s.name,
            level: s.level,
          }));
          setSelectedSports(mapped);
        } else if (profileData.preferred_sports && profileData.preferred_sports.length > 0) {
          const mapped = profileData.preferred_sports.map((s: any) => ({
            id: s,
            level: "Beginner",
          }));
          setSelectedSports(mapped);
        }
      } catch (error) {
        console.log("Error loading preferred sports:", error);
      }
    };
    fetchProfileAndSports();
  }, []);

  const handleSelectSportLevel = (sportId: string, level: string) => {
    const existing = selectedSports.find((s) => s.id === sportId);
    if (existing) {
      setSelectedSports(selectedSports.map((s) => s.id === sportId ? { ...s, level } : s));
    } else {
      setSelectedSports([...selectedSports, { id: sportId, level }]);
    }
    setActiveSport(null);
  };

  const handleDeselectSport = (sportId: string) => {
    setSelectedSports(selectedSports.filter((s) => s.id !== sportId));
    setActiveSport(null);
  };

  const handleSubmit = async () => {
    if (selectedSports.length === 0) {
      Alert.alert("Selection Required", "Please select at least one sport to proceed.");
      return;
    }

    setLoading(true);
    try {
      // 1. Save preferences to backend
      await api.post("/profile/preferred-sports", {
        sports: selectedSports.map((s) => s.id),
        levels: selectedSports.map((s) => s.level),
      });

      // 2. Fetch full updated profile
      const response = await api.get("/profile");
      const profileData = response.data;
      
      // 3. Update Redux store to trigger auto-login and navigation
      if (auth.token && auth.refreshToken) {
        dispatch(
          setCredentials({
            user: profileData.user,
            token: auth.token,
            refreshToken: auth.refreshToken,
            wallet: profileData.wallet,
            settings: profileData.settings,
          })
        );
      }

      Alert.alert("Welcome!", "Your profile is ready! Welcome to SportCircle.", [
        {
          text: "Let's Play",
          onPress: () => {
            router.replace("/(tabs)/home");
          }
        }
      ]);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Failed to save sports preferences. Please try again.";
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Sports</Text>
        <Text style={styles.subtitle}>Select the sports you love to play and follow. Select multiple.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {SPORTS_LIST.map((sport) => {
            const selectedItem = selectedSports.find((s) => s.id === sport.id);
            const isSelected = !!selectedItem;
            return (
              <TouchableOpacity
                key={sport.id}
                style={[
                  styles.gridItem,
                  isSelected ? styles.itemSelected : null
                ]}
                onPress={() => setActiveSport(sport.id)}
              >
                {isSelected && (
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>{selectedItem.level}</Text>
                  </View>
                )}
                <View style={[
                  styles.iconWrapper,
                  isSelected ? styles.iconSelected : null
                ]}>
                  <MaterialCommunityIcons 
                    name={sport.icon as any} 
                    size={32} 
                    color={isSelected ? COLORS.surface : COLORS.primary} 
                  />
                </View>
                <Text style={[
                  styles.label,
                  isSelected ? styles.labelSelected : null
                ]} numberOfLines={1}>
                  {sport.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        visible={activeSport !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveSport(null)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setActiveSport(null)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalDragHandle} />
            <Text style={styles.modalTitle}>Select your level</Text>
            <Text style={styles.modalSubtitle}>How skilled are you in {activeSport}?</Text>
            
            <View style={styles.modalOptions}>
              {["Beginner", "Intermediate", "Professional"].map((level) => {
                const isCurrent = activeSport ? selectedSports.find(s => s.id === activeSport)?.level === level : false;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.levelBtn,
                      isCurrent ? styles.levelBtnActive : null
                    ]}
                    onPress={() => activeSport && handleSelectSportLevel(activeSport, level)}
                  >
                    <Text style={[
                      styles.levelBtnText,
                      isCurrent ? styles.levelBtnTextActive : null
                    ]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {activeSport && selectedSports.some(s => s.id === activeSport) && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleDeselectSport(activeSport)}
                >
                  <Text style={styles.removeBtnText}>Remove Sport</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.submitBtn, loading ? styles.submitBtnDisabled : null]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.surface} />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Complete Profile</Text>
              <MaterialCommunityIcons name="check-bold" size={18} color={COLORS.surface} style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  scrollContainer: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
  },
  gridItem: {
    width: ITEM_WIDTH,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
    position: "relative",
    overflow: "hidden",
    ...SHADOWS.soft,
  },
  itemSelected: {
    borderColor: COLORS.primary,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconSelected: {
    backgroundColor: COLORS.primary,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  labelSelected: {
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.primary,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 30,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.background,
  },
  submitBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.cardBackground,
  },
  submitBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.surface,
  },
  cardLevelText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: COLORS.primary,
    marginTop: 4,
    textAlign: "center",
  },
  levelBadge: {
    position: "absolute",
    top: 6,
    alignSelf: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    zIndex: 10,
  },
  levelBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 8.5,
    color: COLORS.surface,
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
    paddingTop: SPACING.sm,
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
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  modalSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    marginTop: 4,
  },
  modalOptions: {
    gap: 12,
  },
  levelBtn: {
    backgroundColor: "#F4F7FD",
    borderWidth: 1,
    borderColor: "#E4ECFA",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  levelBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  levelBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  levelBtnTextActive: {
    color: COLORS.surface,
  },
  removeBtn: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  removeBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.error,
  },
  levelBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    zIndex: 10,
  },
  levelBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 8,
    color: COLORS.surface,
  },
});
