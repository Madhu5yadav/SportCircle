import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Dimensions
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

  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleToggleSport = (id: string) => {
    if (selectedSports.includes(id)) {
      setSelectedSports(selectedSports.filter((s) => s !== id));
    } else {
      setSelectedSports([...selectedSports, id]);
    }
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
        sports: selectedSports,
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
            const isSelected = selectedSports.includes(sport.id);
            return (
              <TouchableOpacity
                key={sport.id}
                style={[
                  styles.gridItem,
                  isSelected ? styles.itemSelected : null
                ]}
                onPress={() => handleToggleSport(sport.id)}
              >
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
    ...SHADOWS.soft,
  },
  itemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.cardBackground + "40",
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
});
