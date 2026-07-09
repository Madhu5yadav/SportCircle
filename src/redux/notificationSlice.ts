import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string; // game_request, friend_request, booking_confirm, system, etc.
  is_read: boolean;
  created_at: string;
}

interface ToastPayload {
  title: string;
  message: string;
  type?: string;
  _key: number; // Unique key to ensure re-triggers even with same content
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  toast: ToastPayload | null; // When set, the toast component will display
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  toast: null,
};

const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    setNotifications: (state, action: PayloadAction<NotificationItem[]>) => {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter((n) => !n.is_read).length;
    },
    addNotification: (state, action: PayloadAction<NotificationItem>) => {
      // Prepend the new notification to the list
      state.notifications.unshift(action.payload);
      if (!action.payload.is_read) {
        state.unreadCount += 1;
      }
    },
    markAsRead: (state, action: PayloadAction<number>) => {
      const notification = state.notifications.find(
        (n) => n.id === action.payload
      );
      if (notification && !notification.is_read) {
        notification.is_read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllAsRead: (state) => {
      state.notifications.forEach((n) => {
        n.is_read = true;
      });
      state.unreadCount = 0;
    },
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    deleteNotification: (state, action: PayloadAction<number>) => {
      const id = action.payload;
      const notif = state.notifications.find((n) => n.id === id);
      if (notif && !notif.is_read) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
      state.notifications = state.notifications.filter((n) => n.id !== id);
    },
    showToast: (
      state,
      action: PayloadAction<{ title: string; message: string; type?: string }>
    ) => {
      state.toast = {
        ...action.payload,
        _key: Date.now(), // Unique key to guarantee re-render on every dispatch
      };
    },
    dismissToast: (state) => {
      state.toast = null;
    },
  },
});

export const {
  setNotifications,
  addNotification,
  markAsRead,
  markAllAsRead,
  clearNotifications,
  deleteNotification,
  showToast,
  dismissToast,
} = notificationSlice.actions;

export default notificationSlice.reducer;

