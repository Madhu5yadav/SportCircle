import { Platform } from "react-native";

// Physical device via Expo Go needs the PC's LAN IP (not localhost/10.0.2.2,
// which only work for emulators). Update if your PC's IP changes.
const DEV_HOST = "192.168.1.5";

export const CONFIG = {
  API_URL: `http://${DEV_HOST}:8000`,
  SOCKET_URL: `http://${DEV_HOST}:8000`,
  GOOGLE_MAPS_KEY: "", // Configured in app.json if needed
};
