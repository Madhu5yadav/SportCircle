import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

export const COLORS = {
  primary: "#1D5EC9",      // Vibrant blue
  background: "#EBF3FF",   // Soft blue background
  cardBackground: "#C8DDFF", // Intermediate blue for cards
  surface: "#FFFFFF",      // Pure white surface
  textPrimary: "#1A1A1A",  // Deep grey/black for primary text
  textSecondary: "#5F6B7A",// Cool grey for secondary text
  border: "#D9E7FF",       // Light blue border
  success: "#4CAF50",
  warning: "#FFC107",
  error: "#F44336",
  overlay: "rgba(26, 26, 26, 0.4)",
  shadow: "#1D5EC9",
  gold: "#FFD700"          // For squad leader badge
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const SIZES = {
  width,
  height,
};

export const TYPOGRAPHY = {
  fontFamily: {
    regular: "Poppins_400Regular",
    medium: "Poppins_500Medium",
    semiBold: "Poppins_600SemiBold",
    bold: "Poppins_700Bold",
  },
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    xxxl: 24,
    h1: 32,
  },
};

export const SHADOWS = {
  soft: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
};
