import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import * as Location from "expo-location";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";
import { updateUser } from "../redux/authSlice";

const GENDERS = ["Male", "Female", "Other"];
const PLAYING_TIMES = [
  { id: "Morning", label: "Morning (5 AM - 12 PM)", icon: "sunny-outline" },
  { id: "Afternoon", label: "Afternoon (12 PM - 5 PM)", icon: "partly-sunny-outline" },
  { id: "Evening", label: "Evening (5 PM - 9 PM)", icon: "moon-outline" },
  { id: "Night", label: "Night (9 PM - 5 AM)", icon: "cloudy-night-outline" }
];

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD
  const [gender, setGender] = useState("");
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Location States
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "success" | "failed">("idle");

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    setLocationStatus("requesting");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationStatus("failed");
        Alert.alert(
          "Permission Denied",
          "Location permission is required to search for local games and turfs. You can enable it in system settings."
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setLocationStatus("success");
    } catch (error) {
      console.log("Error obtaining location:", error);
      setLocationStatus("failed");
    }
  };

  const handleTimeToggle = (id: string) => {
    if (selectedTimes.includes(id)) {
      setSelectedTimes(selectedTimes.filter((t) => t !== id));
    } else {
      setSelectedTimes([...selectedTimes, id]);
    }
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !dob.trim() || !gender || selectedTimes.length === 0) {
      Alert.alert("Incomplete Details", "Please fill in all fields and select at least one preferred playing time.");
      return;
    }

    // Basic date format validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dob)) {
      Alert.alert("Invalid Date Format", "Please enter date of birth in YYYY-MM-DD format.");
      return;
    }

    setLoading(true);
    try {
      await api.put("/profile/personal-details", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dob: dob,
        gender: gender,
        playing_time: selectedTimes,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });

      // Update local Redux store user profile
      dispatch(
        updateUser({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dob: dob,
          gender: gender,
          latitude: coords?.latitude || undefined,
          longitude: coords?.longitude || undefined,
          about: `Playing: ${selectedTimes.join(",")}`
        })
      );

      router.push("/preferred-sports");
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Failed to save personal details. Please try again.";
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          <Text style={styles.sectionTitle}>Tell Us About Yourself</Text>
          <Text style={styles.sectionSubtitle}>Help us customize your SportCircle feed!</Text>

          {/* Location Request Panel */}
          <View style={styles.locationPanel}>
            <View style={styles.locationLeft}>
              <Ionicons 
                name="location-sharp" 
                size={24} 
                color={locationStatus === "success" ? COLORS.success : COLORS.primary} 
              />
              <View style={styles.locationTextWrapper}>
                <Text style={styles.locationLabel}>Location Coordinates</Text>
                {locationStatus === "requesting" && <Text style={styles.locationSubText}>Detecting location...</Text>}
                {locationStatus === "success" && <Text style={styles.locationSubText}>Position acquired successfully!</Text>}
                {locationStatus === "failed" && <Text style={styles.locationSubText}>Failed to get position.</Text>}
                {locationStatus === "idle" && <Text style={styles.locationSubText}>Pending location request...</Text>}
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.locationBtn, locationStatus === "success" ? styles.locationBtnSuccess : null]}
              onPress={requestLocation}
            >
              {locationStatus === "requesting" ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={[styles.locationBtnText, locationStatus === "success" ? styles.locationBtnTextSuccess : null]}>
                  {locationStatus === "success" ? "Refresh" : "Enable"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* First Name & Last Name */}
          <View style={styles.row}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: SPACING.sm }]}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor={COLORS.textSecondary}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1, marginLeft: SPACING.sm }]}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor={COLORS.textSecondary}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          {/* Date of Birth */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
            <View style={styles.inputWithIcon}>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0, paddingLeft: 0 }]}
                placeholder="YYYY-MM-DD (e.g. 1998-05-15)"
                placeholderTextColor={COLORS.textSecondary}
                value={dob}
                onChangeText={setDob}
              />
              <Ionicons name="calendar-outline" size={20} color={COLORS.textSecondary} />
            </View>
          </View>

          {/* Gender */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderContainer}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.genderOption,
                    gender === g ? styles.genderSelected : null
                  ]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[
                    styles.genderText,
                    gender === g ? styles.genderTextSelected : null
                  ]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Preferred Playing Time */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Preferred Playing Time</Text>
            <View style={styles.checkboxContainer}>
              {PLAYING_TIMES.map((time) => {
                const isSelected = selectedTimes.includes(time.id);
                return (
                  <TouchableOpacity
                    key={time.id}
                    style={[
                      styles.checkboxItem,
                      isSelected ? styles.checkboxActive : null
                    ]}
                    onPress={() => handleTimeToggle(time.id)}
                  >
                    <Ionicons 
                      name={time.icon as any} 
                      size={20} 
                      color={isSelected ? COLORS.primary : COLORS.textSecondary} 
                    />
                    <Text style={[
                      styles.checkboxLabel,
                      isSelected ? styles.checkboxLabelActive : null
                    ]}>
                      {time.label}
                    </Text>
                    <View style={styles.checkboxIndicator}>
                      {isSelected && <View style={styles.checkboxChecked} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity 
            style={[styles.submitBtn, loading ? styles.submitBtnDisabled : null]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.surface} />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Save & Next</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.surface} style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  locationPanel: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    ...SHADOWS.soft,
  },
  locationLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: SPACING.md,
  },
  locationTextWrapper: {
    marginLeft: 10,
  },
  locationLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  locationSubText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  locationBtn: {
    backgroundColor: COLORS.background,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  locationBtnSuccess: {
    backgroundColor: COLORS.success + "20",
    borderColor: COLORS.success,
  },
  locationBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
  locationBtnTextSuccess: {
    color: COLORS.success,
  },
  row: {
    flexDirection: "row",
    marginBottom: 20,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 6,
    paddingLeft: 4,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    height: 54,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: COLORS.textPrimary,
    ...SHADOWS.soft,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    height: 54,
    ...SHADOWS.soft,
  },
  genderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  genderOption: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 16,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    ...SHADOWS.soft,
  },
  genderSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genderText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  genderTextSelected: {
    color: COLORS.surface,
  },
  checkboxContainer: {
    gap: 12,
  },
  checkboxItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    height: 54,
    ...SHADOWS.soft,
  },
  checkboxActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.cardBackground + "40",
  },
  checkboxLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 12,
    flex: 1,
  },
  checkboxLabelActive: {
    fontFamily: "Poppins_500Medium",
    color: COLORS.primary,
  },
  checkboxIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  submitBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 40,
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
