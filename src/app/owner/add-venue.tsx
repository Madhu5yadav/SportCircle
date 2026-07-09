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
import { useRouter, useLocalSearchParams } from "expo-router";
import { COLORS, SPACING, SHADOWS } from "../../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import api from "../../services/api";

export default function AddVenueScreen() {
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId?: string }>();
  const isEditing = !!venueId;

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [sport, setSport] = useState("");
  const [facilities, setFacilities] = useState("");
  const [pricePerHour, setPricePerHour] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [offerDetails, setOfferDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingLoc, setFetchingLoc] = useState(false);

  // Load venue details if editing
  useEffect(() => {
    if (isEditing) {
      const loadVenue = async () => {
        setLoading(true);
        try {
          // Fetch all owned venues and find match
          const res = await api.get("/venues/owner");
          const target = res.data.find((v: any) => v.id === parseInt(venueId));
          if (target) {
            setName(target.name);
            setLocation(target.location);
            setLatitude(target.latitude?.toString() || "");
            setLongitude(target.longitude?.toString() || "");
            setSport(target.sport);
            setFacilities(target.facilities || "");
            setPricePerHour(target.price_per_hour.toString());
            setImageUrl(target.image_url || "");
            setOfferDetails(target.offer_details || "");
          }
        } catch (e) {
          Alert.alert("Error", "Could not load venue details.");
        } finally {
          setLoading(false);
        }
      };
      loadVenue();
    }
  }, [venueId]);

  // Fetch current GPS to auto-populate coordinates
  const handleAutoGPS = async () => {
    setFetchingLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "GPS permission is required to fetch coordinates.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude.toString());
      setLongitude(loc.coords.longitude.toString());
      
      // Auto reverse-geocode to location address if empty
      if (!location) {
        const address = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
        if (address && address.length > 0) {
          const { name, street, city, region } = address[0];
          setLocation(`${name || street || ""}, ${city || ""}, ${region || ""}`.trim().replace(/^,\s*/, ""));
        }
      }
    } catch (e) {
      Alert.alert("Error", "Could not fetch GPS coordinates.");
    } finally {
      setFetchingLoc(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !location.trim() || !sport.trim() || !pricePerHour.trim()) {
      Alert.alert("Required Fields", "Please complete Name, Location, Sport, and Price fields.");
      return;
    }

    if (isNaN(Number(pricePerHour)) || parseFloat(pricePerHour) <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid price per hour.");
      return;
    }

    const payload = {
      name: name.trim(),
      location: location.trim(),
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      sport: sport.trim(),
      facilities: facilities.trim() || null,
      price_per_hour: parseFloat(pricePerHour),
      image_url: imageUrl.trim() || null,
      offer_details: offerDetails.trim() || null,
    };

    setLoading(true);
    try {
      if (isEditing) {
        await api.put(`/venue/${venueId}`, payload);
        Alert.alert("Success", "Venue updated successfully!", [
          { text: "OK", onPress: () => router.replace("/owner/dashboard") }
        ]);
      } else {
        await api.post("/venues", payload);
        Alert.alert("Success", "Venue registered successfully!", [
          { text: "OK", onPress: () => router.replace("/owner/dashboard") }
        ]);
      }
    } catch (error: any) {
      console.log("Error saving venue:", error);
      Alert.alert("Error", "Could not save venue details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? "Edit Venue" : "Post a Venue"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Section 1: Venue Info */}
          <Text style={styles.sectionTitle}>Basic Info</Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Venue Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Smash Badminton Academy"
              placeholderTextColor={COLORS.textSecondary}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Sport Type *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Football, Badminton, Cricket"
              placeholderTextColor={COLORS.textSecondary}
              value={sport}
              onChangeText={setSport}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Price Per Hour (Rs.) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 500"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              value={pricePerHour}
              onChangeText={setPricePerHour}
            />
          </View>

          {/* Section 2: Location & GPS */}
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Location Details</Text>
            <TouchableOpacity 
              style={styles.gpsBtn} 
              onPress={handleAutoGPS}
              disabled={fetchingLoc}
            >
              {fetchingLoc ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="location" size={14} color={COLORS.primary} />
                  <Text style={styles.gpsBtnText}>Get GPS Coordinates</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 12th Main Road, Indiranagar"
              placeholderTextColor={COLORS.textSecondary}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 12.97"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={latitude}
                onChangeText={setLatitude}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 77.59"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={longitude}
                onChangeText={setLongitude}
              />
            </View>
          </View>

          {/* Section 3: Extra Details */}
          <Text style={styles.sectionTitle}>Facilities & Media</Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Facilities (comma-separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="Parking, Washroom, Drinking Water, Locker"
              placeholderTextColor={COLORS.textSecondary}
              value={facilities}
              onChangeText={setFacilities}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Image URL</Text>
            <TextInput
              style={styles.input}
              placeholder="Paste public photo URL"
              placeholderTextColor={COLORS.textSecondary}
              value={imageUrl}
              onChangeText={setImageUrl}
              autoCapitalize="none"
            />
          </View>

          {/* Section 4: Discount & Offer details */}
          <Text style={styles.sectionTitle}>Offers & Discounts</Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Discount details (displayed to players)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 20% off bookings this weekend!"
              placeholderTextColor={COLORS.textSecondary}
              value={offerDetails}
              onChangeText={setOfferDetails}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity 
            style={[styles.btn, loading ? styles.btnDisabled : null]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.surface} />
            ) : (
              <Text style={styles.btnText}>{isEditing ? "Update Venue Details" : "Register Venue"}</Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    ...SHADOWS.soft,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: 60,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.primary,
    marginTop: 16,
    marginBottom: 12,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 6,
    paddingLeft: 2,
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
  row: {
    flexDirection: "row",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary + "12",
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  gpsBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.primary,
    marginLeft: 4,
  },
  btn: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
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
