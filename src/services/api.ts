import axios from "axios";
import { StorageService } from "./storage";
import { CONFIG } from "../constants/config";
import { store } from "../redux/store";
import { logout, setCredentials } from "../redux/authSlice";

const api = axios.create({
  baseURL: CONFIG.API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Request Interceptor: Attach Access Token
api.interceptors.request.use(
  async (config) => {
    const token = await StorageService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Token Refresh on 401
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If we are already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await StorageService.getRefreshToken();
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        // Call token refresh API
        const response = await axios.post(`${CONFIG.API_URL}/refresh-token`, {
          refresh_token: refreshToken,
        }, { timeout: 10000 });

        const { access_token, refresh_token, user_id, username } = response.data;

        // Save new tokens
        await StorageService.setAccessToken(access_token);
        await StorageService.setRefreshToken(refresh_token);

        // Update Redux state
        store.dispatch(
          setCredentials({
            user: { id: user_id, username, mobile: "" }, // We update user cache later
            token: access_token,
            refreshToken: refresh_token,
          })
        );

        processQueue(null, access_token);
        isRefreshing = false;

        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Log out user if refresh fails
        await StorageService.clearAll();
        store.dispatch(logout());
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
