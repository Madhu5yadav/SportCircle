import { Platform } from "react-native";

// If running on Android emulator, localhost is 10.0.2.2
// If running on iOS simulator or Web, localhost is 127.0.0.1
// If running on a physical device, update this to your PC's local IP address (e.g., 192.168.1.5)
const DEV_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";

export const CONFIG = {
  API_URL: `http://${DEV_HOST}:8000`,
  SOCKET_URL: `http://${DEV_HOST}:8000`,
  GOOGLE_MAPS_KEY: "", // Configured in app.json if needed
};
