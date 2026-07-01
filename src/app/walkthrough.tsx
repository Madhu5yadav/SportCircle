import { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, SPACING, SHADOWS } from "../theme/theme";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    title: "Discover Nearby Games",
    description: "Connect with players in your neighborhood, view hosts, and join live matches on local courts in real-time.",
    icon: "map-outline",
    color: "#EBF3FF",
  },
  {
    title: "Create Squads & Chat",
    description: "Assemble squads with your friends, start discussions, host polls, and manage payments within group channels.",
    icon: "chatbubbles-outline",
    color: "#D9E7FF",
  },
  {
    title: "Book Certified Turfs",
    description: "Discover nearby sports facilities, view rates, pick available slots, and book instantly using your digital wallet.",
    icon: "calendar-outline",
    color: "#C8DDFF",
  },
];

export default function WalkthroughScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== currentSlide) {
      setCurrentSlide(roundIndex);
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem("walkthrough_shown", "true");
    router.replace("/signup");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleFinish}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable Slides */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.slidesContainer}
      >
        {SLIDES.map((slide, idx) => (
          <View key={idx} style={styles.slide}>
            <View style={[styles.iconWrapper, { backgroundColor: slide.color }]}>
              <Ionicons name={slide.icon as any} size={100} color={COLORS.primary} />
            </View>
            <View style={styles.textWrapper}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.description}>{slide.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Actions & Indicators */}
      <View style={styles.footer}>
        <View style={styles.indicatorContainer}>
          {SLIDES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.indicator,
                idx === currentSlide ? styles.activeIndicator : null,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleFinish}>
          <Text style={styles.btnText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.surface} style={styles.btnIcon} />
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
    height: 50,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: SPACING.xl,
  },
  skipText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.primary,
  },
  slidesContainer: {
    flex: 1,
  },
  slide: {
    width: width,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xxl,
  },
  iconWrapper: {
    width: 220,
    height: 220,
    borderRadius: 110,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
    ...SHADOWS.soft,
  },
  textWrapper: {
    alignItems: "center",
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 26,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: SPACING.sm,
  },
  footer: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 40,
    alignItems: "center",
  },
  indicatorContainer: {
    flexDirection: "row",
    marginBottom: 30,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.cardBackground,
    marginHorizontal: 4,
  },
  activeIndicator: {
    width: 20,
    backgroundColor: COLORS.primary,
  },
  btn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  btnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.surface,
  },
  btnIcon: {
    marginLeft: 8,
  },
});
