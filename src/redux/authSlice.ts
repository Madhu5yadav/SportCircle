import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserProfile {
  id: number;
  username: string;
  mobile: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
  gender?: string;
  latitude?: number;
  longitude?: number;
  about?: string;
  profile_pic?: string;
}

interface WalletState {
  balance: number;
}

interface SettingsState {
  push_enabled: boolean;
  email_enabled: boolean;
  dark_mode: boolean;
}

interface AuthState {
  user: UserProfile | null;
  wallet: WalletState | null;
  settings: SettingsState | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  wallet: null,
  settings: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isOnboarded: false,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        user: UserProfile;
        token: string;
        refreshToken: string;
        wallet?: WalletState;
        settings?: SettingsState;
      }>
    ) => {
      const { user, token, refreshToken, wallet, settings } = action.payload;
      state.user = user;
      state.token = token;
      state.refreshToken = refreshToken;
      state.isAuthenticated = true;
      if (wallet) state.wallet = wallet;
      if (settings) state.settings = settings;
      
      // Check onboarding: user must have first_name and gender, for example
      state.isOnboarded = !!(user.first_name && user.gender);
      state.error = null;
    },
    updateUser: (state, action: PayloadAction<Partial<UserProfile>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        state.isOnboarded = !!(state.user.first_name && state.user.gender);
      }
    },
    updateWallet: (state, action: PayloadAction<number>) => {
      if (state.wallet) {
        state.wallet.balance = action.payload;
      } else {
        state.wallet = { balance: action.payload };
      }
    },
    updateSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      if (state.settings) {
        state.settings = { ...state.settings, ...action.payload };
      }
    },
    logout: (state) => {
      state.user = null;
      state.wallet = null;
      state.settings = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isOnboarded = false;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setCredentials,
  updateUser,
  updateWallet,
  updateSettings,
  logout,
  setLoading,
  setError,
} = authSlice.actions;

export default authSlice.reducer;
