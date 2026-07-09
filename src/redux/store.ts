import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import gameReducer from "./gameSlice";
import chatReducer from "./chatSlice";
import friendReducer from "./friendSlice";
import notificationReducer from "./notificationSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    game: gameReducer,
    chat: chatReducer,
    friend: friendReducer,
    notification: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;
