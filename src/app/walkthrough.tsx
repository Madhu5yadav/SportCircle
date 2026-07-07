import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SHADOWS, SPACING } from "../theme/theme";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    title: "FIND PLAYERS",
    description: "Discover players near your location and connect with them instantly.",
    image: require("../../assets/images/walkthrough-1.png"),
  },
  {
    title: "HOST / JOIN A GAME",
    description: "Create your own game and invite players to participate. Or browse and join nearby game.",
    image: require("../../assets/images/walkthrough-2.png"),
  },
  {
    title: "BOOK VENUES",
    description: "Select a venue, choose your time slot, and confirm your booking quickly.",
    image: require("../../assets/images/walkthrough-3.png"),
  },
];

export default function WalkthroughScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== currentSlide) {
      setCurrentSlide(roundIndex);
    }
  };

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      const nextSlide = currentSlide + 1;
      scrollViewRef.current?.scrollTo({
        x: nextSlide * width,
        animated: true,
      });
      setCurrentSlide(nextSlide);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem("walkthrough_shown", "true");
    router.replace("/signup");
  };

  return (
    <View style={styles.container}>
      {/* Skip Button (hidden on last slide) */}
      {currentSlide < SLIDES.length - 1 && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top > 0 ? insets.top + 10 : 20 }]}
          onPress={handleFinish}
          activeOpacity={0.8}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Swipeable Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.slidesContainer}
      >
        {SLIDES.map((slide, idx) => (
          <View key={idx} style={styles.slide}>
            {/* Top rounded Image */}
            <View style={styles.imageContainer}>
              <Image source={slide.image} style={styles.image} resizeMode="cover" />
            </View>

            {/* Text Content */}
            <View style={styles.textContainer}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.description}>{slide.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer Area with Indicators & Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24 }]}>
        {/* Pagination Dots */}
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

        {/* Next/Continue Button */}
        <TouchableOpacity
          style={styles.btn}
          onPress={handleNext}
          activeOpacity={0.9}
        >
          <Text style={styles.btnText}>
            {currentSlide === SLIDES.length - 1 ? "Continue" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  skipBtn: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    backgroundColor: "#C8DDFF",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  skipText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#1A1A1A",
  },
  slidesContainer: {
    flex: 1,
  },
  slide: {
    width: width,
    height: height,
  },
  imageContainer: {
    width: width,
    height: height * 0.48,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  textContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 40,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  description: {
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: SPACING.sm,
  },
  footer: {
    width: width,
    paddingHorizontal: SPACING.xxl,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D9D9D9",
    marginHorizontal: 5,
  },
  activeIndicator: {
    backgroundColor: COLORS.primary,
    width: 8,
    height: 8,
  },
  btn: {
    backgroundColor: COLORS.primary,
    width: "100%",
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  btnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.surface,
  },
});

