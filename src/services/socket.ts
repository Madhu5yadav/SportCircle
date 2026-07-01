import { io, Socket } from "socket.io-client";
import { CONFIG } from "../constants/config";
import { store } from "../redux/store";
import { addMessage, setTyping, updatePaymentStatus, updatePollVote } from "../redux/chatSlice";
import { updateGameSlots } from "../redux/gameSlice";
import { Alert } from "react-native";

let socket: Socket | null = null;

export const SocketService = {
  connect(userId: number, username: string): Socket {
    if (socket) {
      return socket;
    }

    socket = io(CONFIG.SOCKET_URL, {
      query: { userId: userId.toString() },
      transports: ["websocket"],
      forceNew: true,
    });

    socket.on("connect", () => {
      console.log("Socket.IO client connected");
      // Explicitly register as well
      socket?.emit("register", { userId });
    });

    socket.on("disconnect", () => {
      console.log("Socket.IO client disconnected");
    });

    // Listen for new messages
    socket.on("message", (msg) => {
      console.log("New real-time message received:", msg);
      store.dispatch(
        addMessage({
          roomId: msg.chat_room_id,
          message: {
            ...msg,
            poll_options: msg.poll_options ? JSON.parse(msg.poll_options) : undefined,
            poll_votes: msg.poll_votes ? JSON.parse(msg.poll_votes) : undefined,
          },
        })
      );
    });

    // Listen for typing indicator updates
    socket.on("user_typing", (data) => {
      store.dispatch(
        setTyping({
          roomId: data.roomId,
          userId: data.userId,
          username: data.username,
          isTyping: data.isTyping,
        })
      );
    });

    // Listen for poll updates
    socket.on("poll_updated", (data) => {
      store.dispatch(
        updatePollVote({
          roomId: data.roomId,
          messageId: data.messageId,
          pollVotes: JSON.parse(data.pollVotes),
        })
      );
    });

    // Listen for payment status updates
    socket.on("payment_status_updated", (data) => {
      store.dispatch(
        updatePaymentStatus({
          roomId: data.roomId,
          messageId: data.messageId,
          status: data.status,
        })
      );
    });

    // Listen for game player count slots updates
    socket.on("game_slots_updated", (data) => {
      console.log("Game slots update received:", data);
      store.dispatch(
        updateGameSlots({
          gameId: data.gameId,
          joinedCount: data.joinedCount,
        })
      );
    });

    // Listen for notifications
    socket.on("notification", (notif) => {
      console.log("Real-time notification received:", notif);
      Alert.alert(notif.title, notif.message);
    });

    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  joinChat(roomId: number) {
    if (socket) {
      socket.emit("join_chat", { roomId });
    }
  },

  leaveChat(roomId: number) {
    if (socket) {
      socket.emit("leave_chat", { roomId });
    }
  },

  emitTyping(roomId: number, userId: number, username: string, isTyping: boolean) {
    if (socket) {
      socket.emit("typing_status", { roomId, userId, username, isTyping });
    }
  },

  emitMarkSeen(roomId: number, userId: number) {
    if (socket) {
      socket.emit("mark_seen", { roomId, userId });
    }
  },

  getSocket(): Socket | null {
    return socket;
  },
};
