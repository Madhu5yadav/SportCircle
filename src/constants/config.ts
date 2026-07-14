import Constants from "expo-constants";

const getDevHost = () => {
  if (Constants.expoConfig?.hostUri) {
    const host = Constants.expoConfig.hostUri.split(":").shift();
    // If the host is a tunnel URL (like exp.direct or ngrok), it won't work for the backend port 8000.
    // In that case, we fall back to the actual LAN IP of the host machine.
    if (host && !host.includes("exp.direct") && !host.includes("ngrok")) {
      return host;
    }
  }
  return "192.168.0.14"; // Host's active Wi-Fi IP
};

const DEV_HOST = getDevHost();

export const CONFIG = {
  API_URL: `http://${DEV_HOST}:8000`,
  SOCKET_URL: `http://${DEV_HOST}:8000`,
  GOOGLE_MAPS_KEY: "", // Configured in app.json if needed
};

