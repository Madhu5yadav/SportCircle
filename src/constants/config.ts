import Constants from "expo-constants";

// Physical device via Expo Go needs the PC's LAN IP (not localhost/10.0.2.2,
// which only work for emulators). Update if your PC's IP changes.
const getDevHost = () => {
  if (Constants.expoConfig?.hostUri) {
    return Constants.expoConfig.hostUri.split(":").shift() || "10.191.211.104";
  }
  return "10.191.211.104";
};

const DEV_HOST = getDevHost();

export const CONFIG = {
  API_URL: `http://${DEV_HOST}:8000`,
  SOCKET_URL: `http://${DEV_HOST}:8000`,
  GOOGLE_MAPS_KEY: "", // Configured in app.json if needed
};

