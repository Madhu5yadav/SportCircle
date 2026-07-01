import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  ACCESS_TOKEN: "sportcircle_access_token",
  REFRESH_TOKEN: "sportcircle_refresh_token",
  USER_DATA: "sportcircle_user_data",
  ONBOARDING_COMPLETED: "sportcircle_onboarding_completed",
};

export const StorageService = {
  async setAccessToken(token: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.ACCESS_TOKEN, token);
  },

  async getAccessToken(): Promise<string | null> {
    return await AsyncStorage.getItem(KEYS.ACCESS_TOKEN);
  },

  async setRefreshToken(token: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.REFRESH_TOKEN, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return await AsyncStorage.getItem(KEYS.REFRESH_TOKEN);
  },

  async setUserData(user: any): Promise<void> {
    await AsyncStorage.setItem(KEYS.USER_DATA, JSON.stringify(user));
  },

  async getUserData(): Promise<any | null> {
    const data = await AsyncStorage.getItem(KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  },

  async setOnboardingCompleted(completed: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETED, JSON.stringify(completed));
  },

  async isOnboardingCompleted(): Promise<boolean> {
    const data = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETED);
    return data ? JSON.parse(data) : false;
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      KEYS.ACCESS_TOKEN,
      KEYS.REFRESH_TOKEN,
      KEYS.USER_DATA,
      KEYS.ONBOARDING_COMPLETED,
    ]);
  },
};
