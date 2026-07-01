import React, { useState } from "react";
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
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import api from "../services/api";
import { addGame } from "../redux/gameSlice";

const SPORTS = ["Cricket", "Football", "Basketball", "Badminton", "Volleyball", "Kabaddi", "Kho Kho", "Swimming", "Running", "Golf", "Tennis"];
const GENDERS = ["All", "Male", "Female"];

export default function HostGameScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  // Form States
  const [name, setName] = useState("");
  const [sport, setSport] = useState("Cricket");
  const [location, setLocation] = useState("");
  const [gameDate, setGameDate] = useState(""); // YYYY-MM-DD
  const [startTime, setStartTime] = useState(""); // HH:MM
  const [endTime, setEndTime] = useState(""); // HH:MM
  const [access, setAccess] = useState("public"); // public or private
  const [playerCount, setPlayerCount] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [entryFee, setEntryFee] = useState("");
  const [gender, setGender] = useState("All");
  const [equipment, setEquipment] = useState("");
  const [description, setDescription] = useState("");
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Validations
    if (!name.trim() || !location.trim() || !gameDate.trim() || !startTime.trim() || !endTime.trim() || !playerCount.trim()) {
      Alert.alert("Required Fields", "Please fill in all required fields (Name, Location, Date, Times, Player Count).");
      return;
    }

    // Validation patterns
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^\d{2}:\d{2}$/;
    
    if (!dateRegex.test(gameDate)) {
      Alert.alert("Invalid Date Format", "Use YYYY-MM-DD format (e.g. 2026-07-15).");
      return;
    }

    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      Alert.alert("Invalid Time Format", "Use HH:MM 24-hr format (e.g. 17:30).");
      return;
    }

    const playersLimit = parseInt(playerCount);
    if (isNaN(playersLimit) || playersLimit <= 1) {
      Alert.alert("Invalid Player Count", "Match capacity must be at least 2 players.");
      return;
    }

    let feeVal = 0;
    if (isPaid) {
      feeVal = parseFloat(entryFee);
      if (isNaN(feeVal) || feeVal < 0) {
        Alert.alert("Invalid Entry Fee", "Please enter a valid paid entry amount.");
        return;
      }
    }

    setLoading(true);
    try {
      const response = await api.post("/host-game", {
        name: name.trim(),
        sport_type: sport,
        location: location.trim(),
        game_date: gameDate,
        start_time: startTime + ":00",
        end_time: endTime + ":00",
        access,
        player_count: playersLimit,
        entry_fee: feeVal,
        gender,
        equipment_required: equipment.trim() || null,
        description: description.trim() || null
      });

      dispatch(addGame(response.data));
      Alert.alert("Game Hosted!", "Your sports game is now live. Teammates can search and join it nearby.", [
        {
          text: "View Dashboard",
          onPress: () => {
            router.replace("/(tabs)/home");
          }
        }
      ]);
    } catch (error: any) {
      Alert.alert("Failed to Host", error.response?.data?.detail || "Action failed.");
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
          <Text style={styles.title}>Match Setup</Text>
          <Text style={styles.subtitle}>Fill in details to host your sporting event</Text>

          {/* Game Name */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Game Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Friendly Cricket League"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Sport Type */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Sport Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sportSelector}>
              {SPORTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sportTag, sport === s ? styles.sportTagActive : null]}
                  onPress={() => setSport(s)}
                >
                  <Text style={[styles.sportTagText, sport === s ? styles.sportTagActiveText : null]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Location */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Court/Ground Location Address *</Text>
            <View style={styles.inputWithIcon}>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0, paddingLeft: 0 }]}
                placeholder="e.g. Sarjapur HSR Sports Court"
                value={location}
                onChangeText={setLocation}
              />
              <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} />
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.row}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: SPACING.sm }]}>
              <Text style={styles.label}>Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-07-15"
                value={gameDate}
                onChangeText={setGameDate} // Bind date string helper
                onChange={(e) => setGameDate(e.nativeEvent.text)}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1, marginLeft: SPACING.sm }]}>
              <Text style={styles.label}>Start Time (HH:MM) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 17:00"
                value={startTime}
                onChangeText={setStartTime}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: SPACING.sm }]}>
              <Text style={styles.label}>End Time (HH:MM) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 19:00"
                value={endTime}
                onChangeText={setEndTime}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1, marginLeft: SPACING.sm }]}>
              <Text style={styles.label}>Player Capacity *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 12"
                keyboardType="numeric"
                value={playerCount}
                onChangeText={setPlayerCount}
              />
            </View>
          </View>

          {/* Access Toggle */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Match Visibility</Text>
            <View style={styles.radioContainer}>
              <TouchableOpacity 
                style={[styles.radioBtn, access === "public" ? styles.radioBtnActive : null]}
                onPress={() => setAccess("public")}
              >
                <Text style={[styles.radioText, access === "public" ? styles.radioTextActive : null]}>Public (Open to All)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.radioBtn, access === "private" ? styles.radioBtnActive : null]}
                onPress={() => setAccess("private")}
              >
                <Text style={[styles.radioText, access === "private" ? styles.radioTextActive : null]}>Private (Invite Only)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Entry Fee (Paid/Unpaid) */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Match Entry Pricing</Text>
            <View style={styles.radioContainer}>
              <TouchableOpacity 
                style={[styles.radioBtn, !isPaid ? styles.radioBtnActive : null]}
                onPress={() => setIsPaid(false)}
              >
                <Text style={[styles.radioText, !isPaid ? styles.radioTextActive : null]}>Unpaid / Free</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.radioBtn, isPaid ? styles.radioBtnActive : null]}
                onPress={() => setIsPaid(true)}
              >
                <Text style={[styles.radioText, isPaid ? styles.radioTextActive : null]}>Paid Match</Text>
              </TouchableOpacity>
            </View>
            {isPaid && (
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Enter Entry Fee per player (Rs.)"
                keyboardType="numeric"
                value={entryFee}
                onChangeText={setEntryFee}
              />
            )}
          </View>

          {/* Gender */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Gender Restriction</Text>
            <View style={styles.genderRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderTag, gender === g ? styles.genderTagActive : null]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.genderTagText, gender === g ? styles.genderTagActiveText : null]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Equipment */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Gear / Equipment Required</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Bring your own cricket bat"
              value={equipment}
              onChangeText={setEquipment}
            />
          </View>

          {/* Description */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Match Instructions / Description (Optional)</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Provide directions, rules, or matching expectations..."
              multiline
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity 
            style={[styles.btn, loading ? styles.btnDisabled : null]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={COLORS.surface} /> : <Text style={styles.btnText}>Launch Match Event</Text>}
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
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
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
    height: 52,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
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
    height: 52,
    ...SHADOWS.soft,
  },
  row: {
    flexDirection: "row",
  },
  sportSelector: {
    flexDirection: "row",
  },
  sportTag: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    marginRight: 8,
  },
  sportTagActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sportTagText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  sportTagActiveText: {
    color: COLORS.surface,
    fontFamily: "Poppins_600SemiBold",
  },
  radioContainer: {
    flexDirection: "row",
    gap: 8,
  },
  radioBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.soft,
  },
  radioBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.cardBackground + "20",
  },
  radioText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  radioTextActive: {
    color: COLORS.primary,
    fontFamily: "Poppins_600SemiBold",
  },
  genderRow: {
    flexDirection: "row",
    gap: 10,
  },
  genderTag: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.soft,
  },
  genderTagActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genderTagText: {
    fontFamily: "Poppins_500Medium",
    color: COLORS.textSecondary,
  },
  genderTagActiveText: {
    color: COLORS.surface,
    fontFamily: "Poppins_600SemiBold",
  },
  btn: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 40,
    ...SHADOWS.medium,
  },
  btnDisabled: {
    backgroundColor: COLORS.cardBackground,
  },
  btnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.surface,
  },
});
