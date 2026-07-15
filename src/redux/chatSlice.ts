import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Message {
  id: number;
  chat_room_id: number;
  sender_id: number;
  sender_username: string;
  sender_profile_pic?: string;
  content?: string;
  image_url?: string;
  type: "text" | "image" | "poll" | "payment";
  poll_question?: string;
  poll_options?: string[]; // Parsed list
  poll_votes?: Record<string, number[]>; // option_index -> array of user_ids
  payment_amount?: number;
  payment_status?: "pending" | "paid";
  created_at: string;
}

export interface ChatRoom {
  id: number;
  name?: string;
  type: "direct" | "group" | "game" | "squad";
  game_id?: number;
  squad_id?: number;
  created_at: string;
  last_message?: Message;
  other_user_id?: number;
  other_user_profile_pic?: string;
  game_date?: string;
  start_time?: string;
  blocked_by_me?: boolean;
  has_blocked_me?: boolean;
}

interface TypingUser {
  userId: number;
  username: string;
}

interface ChatState {
  rooms: ChatRoom[];
  messages: Record<number, Message[]>; // roomId -> MessageList
  typingUsers: Record<number, TypingUser[]>; // roomId -> UserList
  activeRoomId: number | null;
  isLoading: boolean;
}

const initialState: ChatState = {
  rooms: [],
  messages: {},
  typingUsers: {},
  activeRoomId: null,
  isLoading: false,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setRooms: (state, action: PayloadAction<ChatRoom[]>) => {
      state.rooms = action.payload;
    },
    updateBlockStatus: (
      state,
      action: PayloadAction<{ roomId: number; blocked_by_me: boolean; has_blocked_me: boolean }>
    ) => {
      const { roomId, blocked_by_me, has_blocked_me } = action.payload;
      const roomIndex = state.rooms.findIndex((r) => r.id === roomId);
      if (roomIndex !== -1) {
        state.rooms[roomIndex].blocked_by_me = blocked_by_me;
        state.rooms[roomIndex].has_blocked_me = has_blocked_me;
      }
    },
    addOrUpdateRoom: (state, action: PayloadAction<ChatRoom>) => {
      const room = action.payload;
      const index = state.rooms.findIndex((r) => r.id === room.id);
      if (index !== -1) {
        state.rooms[index] = { ...state.rooms[index], ...room };
      } else {
        state.rooms.push(room);
      }
    },
    deleteMessage: (state, action: PayloadAction<{ roomId: number; messageId: number }>) => {
      const { roomId, messageId } = action.payload;
      if (state.messages[roomId]) {
        state.messages[roomId] = state.messages[roomId].filter((m) => m.id !== messageId);
      }
    },
    setMessages: (
      state,
      action: PayloadAction<{ roomId: number; messages: Message[] }>
    ) => {
      const { roomId, messages } = action.payload;
      state.messages[roomId] = messages;
    },
    addMessage: (
      state,
      action: PayloadAction<{ roomId: number; message: Message }>
    ) => {
      const { roomId, message } = action.payload;
      
      // Append to message dictionary
      if (!state.messages[roomId]) {
        state.messages[roomId] = [];
      }
      // Check if message is already added
      const exists = state.messages[roomId].some((m) => m.id === message.id);
      if (!exists) {
        state.messages[roomId].push(message);
      }
      
      // Update last message in rooms list
      const roomIndex = state.rooms.findIndex((r) => r.id === roomId);
      if (roomIndex !== -1) {
        state.rooms[roomIndex].last_message = message;
        // Move room to top
        const [room] = state.rooms.splice(roomIndex, 1);
        state.rooms.unshift(room);
      }
    },
    setTyping: (
      state,
      action: PayloadAction<{
        roomId: number;
        userId: number;
        username: string;
        isTyping: boolean;
      }>
    ) => {
      const { roomId, userId, username, isTyping } = action.payload;
      if (!state.typingUsers[roomId]) {
        state.typingUsers[roomId] = [];
      }
      
      if (isTyping) {
        const exists = state.typingUsers[roomId].some((u) => u.userId === userId);
        if (!exists) {
          state.typingUsers[roomId].push({ userId, username });
        }
      } else {
        state.typingUsers[roomId] = state.typingUsers[roomId].filter(
          (u) => u.userId !== userId
        );
      }
    },
    setActiveRoom: (state, action: PayloadAction<number | null>) => {
      state.activeRoomId = action.payload;
    },
    updatePollVote: (
      state,
      action: PayloadAction<{
        roomId: number;
        messageId: number;
        pollVotes: Record<string, number[]>;
      }>
    ) => {
      const { roomId, messageId, pollVotes } = action.payload;
      if (state.messages[roomId]) {
        const msg = state.messages[roomId].find((m) => m.id === messageId);
        if (msg) {
          msg.poll_votes = pollVotes;
        }
      }
    },
    updatePaymentStatus: (
      state,
      action: PayloadAction<{
        roomId: number;
        messageId: number;
        status: "pending" | "paid";
      }>
    ) => {
      const { roomId, messageId, status } = action.payload;
      if (state.messages[roomId]) {
        const msg = state.messages[roomId].find((m) => m.id === messageId);
        if (msg) {
          msg.payment_status = status;
        }
      }
    },
    setChatLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  setRooms,
  setMessages,
  addMessage,
  setTyping,
  setActiveRoom,
  updatePollVote,
  updatePaymentStatus,
  setChatLoading,
  updateBlockStatus,
  addOrUpdateRoom,
  deleteMessage,
} = chatSlice.actions;

export default chatSlice.reducer;
