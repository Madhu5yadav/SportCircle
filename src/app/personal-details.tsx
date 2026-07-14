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
  Platform,
  Image,
  Modal,
  Dimensions
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useDispatch } from "react-redux";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import api from "../services/api";
import { updateUser } from "../redux/authSlice";

const GENDERS = ["Male", "Female", "Other"];
const PLAYING_TIMES = [
  { id: "Morning", label: "Morning (5 AM - 12 PM)", icon: "sunny-outline" },
  { id: "Afternoon", label: "Afternoon (12 PM - 5 PM)", icon: "partly-sunny-outline" },
  { id: "Evening", label: "Evening (5 PM - 9 PM)", icon: "moon-outline" },
  { id: "Night", label: "Night (9 PM - 5 AM)", icon: "cloudy-night-outline" }
];

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

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { mode } = useLocalSearchParams();
  const isEdit = mode === "edit";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD
  const [dobDate, setDobDate] = useState<Date>(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState("");
  const [about, setAbout] = useState("");
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Sports States
  const [selectedSports, setSelectedSports] = useState<{ id: string; level: string }[]>([]);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  
  // Location States
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "success" | "failed">("idle");

  useEffect(() => {
    const fetchProfileDetails = async () => {
      try {
        const response = await api.get("/profile");
        const profileData = response.data;
        const u = profileData.user;
        let hasLocation = false;
        if (u) {
          if (u.first_name) setFirstName(u.first_name);
          if (u.last_name) setLastName(u.last_name);
          if (u.dob) {
            setDob(u.dob);
            // Parse the saved date string into a Date object for the picker
            const parsed = new Date(u.dob + "T00:00:00");
            if (!isNaN(parsed.getTime())) setDobDate(parsed);
          }
          if (u.gender) setGender(u.gender);
          if (u.about) setAbout(u.about);
          if (u.profile_pic) setProfileImage(u.profile_pic);
          if (u.latitude && u.longitude) {
            setCoords({ latitude: u.latitude, longitude: u.longitude });
            setLocationStatus("success");
            hasLocation = true;
          }
        }
        if (profileData.playing_time && profileData.playing_time.length > 0) {
          setSelectedTimes(profileData.playing_time);
        }
        
        // Load preferred sports
        if (profileData.preferred_sports_details && profileData.preferred_sports_details.length > 0) {
          setSelectedSports(profileData.preferred_sports_details.map((s: any) => ({ id: s.name, level: s.level })));
        } else if (profileData.preferred_sports && profileData.preferred_sports.length > 0) {
          setSelectedSports(profileData.preferred_sports.map((s: any) => ({ id: s, level: "Beginner" })));
        }
        
        if (!hasLocation) {
          requestLocation();
        }
      } catch (error) {
        console.log("Error fetching profile details on mount:", error);
        requestLocation();
      }
    };

    fetchProfileDetails();
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

  const pickImage = async (source: "camera" | "gallery") => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Camera permission is needed to take a photo.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Gallery permission is needed to pick a photo.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      "Profile Picture",
      "Choose how to set your profile picture",
      [
        { text: "📷  Take Photo", onPress: () => pickImage("camera") },
        { text: "🖼️  Choose from Gallery", onPress: () => pickImage("gallery") },
        ...(profileImage ? [{ text: "🗑️  Remove Photo", onPress: () => setProfileImage(null), style: "destructive" as const }] : []),
        { text: "Cancel", style: "cancel" as const },
      ],
      { cancelable: true }
    );
  };

  const uploadProfileImage = async (): Promise<string | null> => {
    if (!profileImage || profileImage.startsWith("http")) {
      // Already uploaded or no image — skip upload
      return profileImage;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      const filename = profileImage.split("/").pop() || "profile.jpg";
      const match = /\.([\w]+)$/.exec(filename);
      const ext = match ? match[1] : "jpg";
      const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;

      formData.append("file", {
        uri: profileImage,
        name: filename,
        type: mimeType,
      } as any);

      const response = await api.post("/profile/upload-photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return response.data.url;
    } catch (error) {
      console.log("Error uploading profile image:", error);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !dob.trim() || !gender || selectedTimes.length === 0) {
      Alert.alert("Incomplete Details", "Please fill in all fields and select at least one preferred playing time.");
      return;
    }

    // Date is always valid when using the picker, but check it's not empty
    if (!dob) {
      Alert.alert("Missing Date", "Please select your date of birth.");
      return;
    }

    setLoading(true);
    try {
      // Upload profile image first if a new local image was picked
      let uploadedUrl = profileImage;
      if (profileImage && !profileImage.startsWith("http")) {
        uploadedUrl = await uploadProfileImage();
      }

      const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
      const finalProfilePic = uploadedUrl || defaultAvatar;

      await api.put("/profile/personal-details", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dob: dob,
        gender: gender,
        playing_time: selectedTimes,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        profile_pic: finalProfilePic,
        about: about.trim() || undefined,
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
          about: about.trim() || undefined,
          profile_pic: finalProfilePic,
        })
      );

      // Also save sports if in edit mode (or always save if any selected)
      if (selectedSports.length > 0) {
        await api.post("/profile/preferred-sports", {
          sports: selectedSports.map((s) => s.id),
          levels: selectedSports.map((s) => s.level),
        });
      }

      if (isEdit) {
        Alert.alert("Success", "Profile updated successfully!");
        router.back();
      } else {
        router.push("/preferred-sports");
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Failed to save personal details. Please try again.";
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: isEdit ? "Edit Profile" : "Personal Details",
          headerLeft: isEdit ? undefined : () => null
        }} 
      />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          {/* Profile Picture Picker */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrapper} onPress={showImagePickerOptions} activeOpacity={0.8}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={48} color={COLORS.border} />
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={14} color={COLORS.surface} />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>
              {profileImage ? "Tap to change photo" : "Add a profile photo"}
            </Text>
            {uploadingImage && (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 6 }} />
            )}
          </View>

          <Text style={styles.sectionTitle}>{isEdit ? "Update Your Profile" : "Tell Us About Yourself"}</Text>
          <Text style={styles.sectionSubtitle}>{isEdit ? "Keep your location and personal info up to date." : "Help us customize your SportCircle feed!"}</Text>

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
            <Text style={styles.label}>Date of Birth</Text>
            <TouchableOpacity
              style={styles.datePickerField}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={20} color={dob ? COLORS.primary : COLORS.textSecondary} style={{ marginRight: 10 }} />
              <Text style={[styles.datePickerText, !dob && styles.datePickerPlaceholder]}>
                {dob
                  ? dobDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                  : "Select your date of birth"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {showDatePicker && (
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={dobDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  minimumDate={new Date(1950, 0, 1)}
                  onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                    if (Platform.OS === "android") {
                      setShowDatePicker(false);
                    }
                    if (selectedDate) {
                      setDobDate(selectedDate);
                      const yyyy = selectedDate.getFullYear();
                      const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
                      const dd = String(selectedDate.getDate()).padStart(2, "0");
                      setDob(`${yyyy}-${mm}-${dd}`);
                    }
                  }}
                />
                {Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={styles.datePickerDoneBtn}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.datePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
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

          {/* About / Bio */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>About / Bio</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 12 }]}
              placeholder="Tell other players a bit about yourself..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              value={about}
              onChangeText={setAbout}
            />
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

          {/* Preferred Sports Section */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Preferred Sports</Text>
            <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 }}>
              Tap a sport to select it and choose your skill level.
            </Text>
            <View style={styles.sportsGrid}>
              {SPORTS_LIST.map((sport) => {
                const selectedItem = selectedSports.find((s) => s.id === sport.id);
                const isSelected = !!selectedItem;
                return (
                  <TouchableOpacity
                    key={sport.id}
                    style={[styles.sportGridItem, isSelected ? styles.sportItemSelected : null]}
                    onPress={() => setActiveSport(sport.id)}
                  >
                    {isSelected && (
                      <View style={styles.sportLevelBadge}>
                        <Text style={styles.sportLevelBadgeText}>{selectedItem.level.slice(0, 3).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={[styles.sportIconWrapper, isSelected ? styles.sportIconSelected : null]}>
                      <MaterialCommunityIcons
                        name={sport.icon as any}
                        size={28}
                        color={isSelected ? COLORS.surface : COLORS.primary}
                      />
                    </View>
                    <Text style={[styles.sportLabel, isSelected ? styles.sportLabelSelected : null]} numberOfLines={1}>
                      {sport.label}
                    </Text>
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
                <Text style={styles.submitBtnText}>{isEdit ? "Save Changes" : "Save & Next"}</Text>
                <Ionicons name={isEdit ? "checkmark-circle" : "arrow-forward"} size={18} color={COLORS.surface} style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
          
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sport Level Picker Modal */}
      <Modal
        visible={activeSport !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveSport(null)}
      >
        <TouchableOpacity
          style={styles.sportModalBackdrop}
          activeOpacity={1}
          onPress={() => setActiveSport(null)}
        >
          <View style={styles.sportModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.sportModalHandle} />
            <Text style={styles.sportModalTitle}>Select Your Level</Text>
            <Text style={styles.sportModalSubtitle}>How skilled are you in {activeSport}?</Text>

            <View style={{ gap: 12 }}>
              {["Beginner", "Intermediate", "Professional"].map((level) => {
                const isCurrent = activeSport ? selectedSports.find((s) => s.id === activeSport)?.level === level : false;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.sportLevelBtn, isCurrent ? styles.sportLevelBtnActive : null]}
                    onPress={() => activeSport && handleSelectSportLevel(activeSport, level)}
                  >
                    <Text style={[styles.sportLevelBtnText, isCurrent ? styles.sportLevelBtnTextActive : null]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {activeSport && selectedSports.some((s) => s.id === activeSport) && (
                <TouchableOpacity
                  style={{ paddingVertical: 12, alignItems: "center", marginTop: 4 }}
                  onPress={() => handleDeselectSport(activeSport)}
                >
                  <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: COLORS.error }}>
                    Remove Sport
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
  scrollContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarWrapper: {
    width: 110,
    height: 110,
    borderRadius: 55,
    position: "relative",
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.surface,
    borderWidth: 2.5,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: COLORS.surface,
    ...SHADOWS.medium,
  },
  avatarHint: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 10,
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
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  locationBtnSuccess: {
    backgroundColor: COLORS.success + "20",
    borderColor: COLORS.success,
  },
  locationBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
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
  datePickerField: {
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
  datePickerText: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  datePickerPlaceholder: {
    color: COLORS.textSecondary,
  },
  datePickerContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.soft,
  },
  datePickerDoneBtn: {
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  datePickerDoneText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.primary,
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
  // Sports Grid Styles
  sportsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sportGridItem: {
    width: ITEM_WIDTH,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
    position: "relative",
    overflow: "hidden",
    ...SHADOWS.soft,
  },
  sportItemSelected: {
    borderColor: COLORS.primary,
  },
  sportIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  sportIconSelected: {
    backgroundColor: COLORS.primary,
  },
  sportLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.textPrimary,
    textAlign: "center",
    paddingHorizontal: 2,
  },
  sportLabelSelected: {
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.primary,
  },
  sportLevelBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: COLORS.primary,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 5,
    zIndex: 10,
  },
  sportLevelBadgeText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 7,
    color: COLORS.surface,
  },
  // Sports Modal Styles
  sportModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sportModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    paddingTop: SPACING.sm,
    ...SHADOWS.medium,
  },
  sportModalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#E4ECFA",
    borderRadius: 2.5,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 15,
  },
  sportModalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  sportModalSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    marginTop: 4,
  },
  sportLevelBtn: {
    backgroundColor: "#F4F7FD",
    borderWidth: 1,
    borderColor: "#E4ECFA",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  sportLevelBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sportLevelBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  sportLevelBtnTextActive: {
    color: COLORS.surface,
  },
});
