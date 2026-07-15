import React, { useState, useEffect, useRef } from "react";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
  Swipeable
} from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
  SafeAreaView,
  Keyboard,
  StatusBar,
  Share
} from "react-native";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons, FontAwesome, MaterialIcons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../../../theme/theme";
import { RootState } from "../../../redux/store";
import api from "../../../services/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addMessage, setMessages, setActiveRoom, updateBlockStatus, addOrUpdateRoom, deleteMessage } from "../../../redux/chatSlice";
import { SocketService } from "../../../services/socket";
import { updateWallet } from "../../../redux/authSlice";

const capitalizeFirstLetter = (str?: string) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const parseUTCDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  if (dateStr.endsWith("Z") || dateStr.includes("+") || /-\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  const isoStr = dateStr.includes(" ") ? dateStr.replace(" ", "T") : dateStr;
  return new Date(`${isoStr}Z`);
};

export default function ChatRoomScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const parsedRoomId = parseInt(roomId);

  const auth = useSelector((state: RootState) => state.auth);
  const chatState = useSelector((state: RootState) => state.chat);
  
  const messages = chatState.messages[parsedRoomId] || [];
  const typingUsers = chatState.typingUsers[parsedRoomId] || [];
  const roomDetail = chatState.rooms.find(r => r.id === parsedRoomId);

  const flatListRef = useRef<FlatList>(null);

  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<number[]>([]);
  const [replyingToMessage, setReplyingToMessage] = useState<any>(null);
  
  // Custom Modals
  const [showPollModal, setShowPollModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);

  // Poll Form
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentTitle, setPaymentTitle] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const openViewer = (url: string) => setViewerImageUrl(url);
  const closeViewer = () => setViewerImageUrl(null);

  const navigation = useNavigation();

  useEffect(() => {
    // Hide the tab bar when entering the chat room
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({ tabBarStyle: { display: 'none' } });
    }
    
    // Restore the tab bar on unmount by clearing screen-specific overrides
    return () => {
      if (parent) {
        parent.setOptions({
          tabBarStyle: undefined
        });
      }
    };
  }, [navigation]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const isChatBlocked = () => {
    if (!roomDetail || roomDetail.type !== "game") return false;
    if (!roomDetail.game_date || !roomDetail.start_time) return false;
    
    try {
      const now = new Date();
      const [yr, mo, dy] = roomDetail.game_date.split("-").map(Number);
      const [hr, min, sec] = roomDetail.start_time.split(":").map(Number);
      const gameStart = new Date(yr, mo - 1, dy, hr, min, sec || 0);
      if (isNaN(gameStart.getTime())) return false;
      const blockTime = new Date(gameStart.getTime() + 10 * 60 * 1000);
      return now > blockTime;
    } catch (e) {
      return false;
    }
  };

  const getCleanedGroupName = () => {
    if (!roomDetail) return `Chat Room #${parsedRoomId}`;
    if (roomDetail.type === "direct") return `${roomDetail.name}`;
    if (roomDetail.name && roomDetail.name.startsWith("Game: ")) {
      return roomDetail.name.substring(6);
    }
    return roomDetail.name || `Chat Room #${parsedRoomId}`;
  };

  // Load chat profile and messages
  const loadChatData = async () => {
    setLoading(true);
    try {
      try {
        const roomRes = await api.get(`/chat/room/${parsedRoomId}`);
        dispatch(addOrUpdateRoom(roomRes.data));
      } catch (err) {
        console.log("Error loading room detail metadata:", err);
      }
      const response = await api.get(`/chat/room/${parsedRoomId}/messages`);
      // Parse JSON fields safely
      const safeParse = (val: any) => {
        if (!val) return undefined;
        if (typeof val !== "string") return val;
        try {
          return JSON.parse(val);
        } catch (e) {
          return val;
        }
      };
      const formatted = response.data.map((m: any) => ({
        ...m,
        poll_options: safeParse(m.poll_options),
        poll_votes: safeParse(m.poll_votes),
      }));
      
      dispatch(setMessages({ roomId: parsedRoomId, messages: formatted }));
      dispatch(setActiveRoom(parsedRoomId));
      
      // Connect to Socket and Join room
      if (auth.user) {
        SocketService.connect(auth.user.id, auth.user.username);
        SocketService.joinChat(parsedRoomId);
        SocketService.emitMarkSeen(parsedRoomId, auth.user.id);
      }
    } catch (error) {
      console.log("Error loading chat messages:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChatData();
    return () => {
      dispatch(setActiveRoom(null));
      SocketService.leaveChat(parsedRoomId);
    };
  }, [roomId]);

  useEffect(() => {
    const loadHidden = async () => {
      try {
        const val = await AsyncStorage.getItem(`hidden_messages_${parsedRoomId}`);
        if (val) {
          setHiddenMessageIds(JSON.parse(val));
        }
      } catch (e) {}
    };
    loadHidden();
  }, [roomId]);

  const handleUnblockUser = async () => {
    if (!roomDetail?.other_user_id) return;
    try {
      await api.post(`/user/unblock/${roomDetail.other_user_id}`);
      dispatch(updateBlockStatus({
        roomId: parsedRoomId,
        blocked_by_me: false,
        has_blocked_me: false
      }));
      Alert.alert("Success", "User unblocked successfully.");
    } catch (e) {
      Alert.alert("Error", "Could not unblock user.");
    }
  };

  const sendMessage = async (payload: any) => {
    if (isChatBlocked()) {
      Alert.alert("Chat Archived", "You cannot send messages to this room anymore.");
      return;
    }
    if (roomDetail?.blocked_by_me) {
      Alert.alert("Blocked", "Please unblock this user to send messages.");
      return;
    }
    if (roomDetail?.has_blocked_me) {
      Alert.alert("Blocked", "You cannot message this user.");
      return;
    }
    try {
      const response = await api.post(`/chat?room_id=${parsedRoomId}`, payload);
      // Clean input
      setInputMessage("");
      handleTypingStatus(false);
    } catch (error) {
      Alert.alert("Error", "Failed to send message.");
    }
  };

  const getReplyTextSnippet = (message: any) => {
    if (message.type === "text") {
      if (message.content && message.content.startsWith('{"is_reply":true')) {
        try {
          const parsed = JSON.parse(message.content);
          return parsed.text;
        } catch (e) {
          return message.content;
        }
      }
      return message.content;
    }
    if (message.type === "image") return "Attachment: Image";
    if (message.type === "poll") return `Poll: ${message.poll_question}`;
    if (message.type === "payment") return `Payment Request: Rs. ${message.payment_amount}`;
    return "Shared Attachment";
  };

  const handleSendText = () => {
    if (!inputMessage.trim()) return;
    
    let contentVal = inputMessage.trim();
    if (replyingToMessage) {
      contentVal = JSON.stringify({
        is_reply: true,
        reply_to_id: replyingToMessage.id,
        reply_to_username: replyingToMessage.sender_username,
        reply_to_text: getReplyTextSnippet(replyingToMessage),
        text: inputMessage.trim()
      });
      setReplyingToMessage(null);
    }

    sendMessage({
      content: contentVal,
      type: "text"
    });
  };

  // Typing status handling
  const handleTypingStatus = (status: boolean) => {
    if (!auth.user) return;
    setTyping(status);
    SocketService.emitTyping(parsedRoomId, auth.user.id, auth.user.username, status);
  };

  // Handle Poll Vote
  const handleVote = async (messageId: number, optionIndex: number) => {
    try {
      const response = await api.post(`/chat/poll-vote`, {
        message_id: messageId,
        option_index: optionIndex
      });
      // State is synced automatically via Socket.IO
    } catch (error: any) {
      Alert.alert("Voting Failed", error.response?.data?.detail || "Action failed.");
    }
  };

  // Handle Payment Request Checkout
  const handlePayRequest = async (messageId: number, amount: number) => {
    Alert.alert(
      "Confirm Booking Payment",
      `Pay Rs. ${amount} from your digital wallet?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Pay Now", 
          onPress: async () => {
            try {
              const res = await api.post(`/chat/pay-request`, {
                message_id: messageId
              });
              Alert.alert("Success", "Payment completed successfully!");
              // Refresh wallet balance
              const walletRes = await api.get("/profile/wallet");
              dispatch(updateWallet(parseFloat(walletRes.data.balance)));
            } catch (err: any) {
              Alert.alert("Payment Failed", err.response?.data?.detail || "Insufficient wallet funds.");
            }
          }
        }
      ]
    );
  };

  const handleCreatePoll = () => {
    const validOptions = pollOptions.filter(o => o.trim().length > 0);
    if (!pollQuestion.trim() || validOptions.length < 2) {
      Alert.alert("Error", "Please fill in a question and at least 2 options.");
      return;
    }

    sendMessage({
      type: "poll",
      poll_question: pollQuestion.trim(),
      poll_options: validOptions
    });
    
    // Reset Form & Hide Modal
    setPollQuestion("");
    setPollOptions(["", ""]);
    setShowPollModal(false);
    setShowAttachmentMenu(false);
  };

  const handleCreatePaymentRequest = () => {
    const amt = parseFloat(paymentAmount);
    if (!paymentTitle.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert("Error", "Please enter a valid description and payment amount.");
      return;
    }

    sendMessage({
      type: "payment",
      content: paymentTitle.trim(),
      payment_amount: amt
    });

    setPaymentTitle("");
    setPaymentAmount("");
    setShowPaymentModal(false);
    setShowAttachmentMenu(false);
  };

  const handleShareImage = () => {
    setShowAttachmentMenu(false);
    setShowImageSourceModal(true);
  };

  const pickFromSource = async (useCamera: boolean) => {
    setShowImageSourceModal(false);
    try {
      // Request permissions
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Camera access is required to take a photo.");
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Gallery access is required to select a photo.");
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });

      if (!result.canceled && result.assets.length > 0) {
        // Show custom preview instead of uploading immediately
        setPreviewAsset(result.assets[0]);
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong when opening the picker.");
    }
  };

  const handleSendPreviewImage = async () => {
    if (!previewAsset) return;
    const asset = previewAsset;
    setPreviewAsset(null);
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      } as any);

      const uploadRes = await api.post("/chat/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      sendMessage({
        type: "image",
        image_url: uploadRes.data.url,
      });
    } catch (err: any) {
      Alert.alert("Upload Failed", err.response?.data?.detail || "Could not upload image.");
    } finally {
      setImageUploading(false);
    }
  };

  // Group Details / Roster
  const handleViewRoster = async () => {
    setShowMenu(false);
    setShowRosterModal(true);
  };

  const handleExitGroup = () => {
    setShowMenu(false);
    Alert.alert("Exit Chat", "Are you sure you want to exit this group chat?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Exit",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/chat/exit/${parsedRoomId}`);
            router.back();
          } catch (err) {
            Alert.alert("Error", "Could not exit chat.");
          }
        }
      }
    ]);
  };

  const handleReportGroup = () => {
    setShowMenu(false);
    Alert.alert("Report Group", "Report this group for inappropriate content or rules violations?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Report", 
        onPress: () => Alert.alert("Report Filed", "Thank you, our team will audit this group chat.") 
      }
    ]);
  };

  const handleMessageLongPress = (message: any) => {
    const isOwn = message.sender_id === auth.user?.id;
    
    Alert.alert(
      "Message Options",
      undefined,
      [
        {
          text: "Share Message",
          onPress: () => {
            Share.share({
              message: message.content || "Image attachment"
            }).catch(err => console.log("Error sharing:", err));
          }
        },
        {
          text: "Delete Message",
          style: "destructive" as const,
          onPress: () => {
            Alert.alert(
              "Delete Message",
              isOwn 
                ? "Are you sure you want to delete this message? This will delete it for everyone." 
                : "Delete this message from your view?",
              [
                { text: "Cancel", style: "cancel" as const },
                { 
                  text: "Delete", 
                  style: "destructive" as const,
                  onPress: async () => {
                    if (isOwn) {
                      // Optimistically delete message on the frontend immediately
                      dispatch(deleteMessage({ roomId: parsedRoomId, messageId: message.id }));
                      try {
                        await api.delete(`/chat/message/${message.id}`);
                      } catch (err) {
                        console.log("Failed to sync message deletion on backend:", err);
                      }
                    } else {
                      try {
                        const updated = [...hiddenMessageIds, message.id];
                        setHiddenMessageIds(updated);
                        await AsyncStorage.setItem(`hidden_messages_${parsedRoomId}`, JSON.stringify(updated));
                        dispatch(deleteMessage({ roomId: parsedRoomId, messageId: message.id }));
                      } catch (err) {
                        Alert.alert("Error", "Could not delete message locally.");
                      }
                    }
                  }
                }
              ]
            );
          }
        },
        { text: "Cancel", style: "cancel" as const }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: COLORS.surface }]}>
      {/* Header bar */}
      <View style={[styles.chatHeader, { backgroundColor: COLORS.primary }]}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push("/(tabs)/chat");
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          {roomDetail?.type === "direct" && (
            <TouchableOpacity 
              style={styles.headerProfileBtn}
              onPress={() => {
                router.push({ pathname: "/chat-info/[roomId]", params: { roomId: parsedRoomId } });
              }}
            >
              <Image 
                source={{ uri: roomDetail.other_user_profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }} 
                style={styles.headerAvatar}
              />
              <View style={styles.headerTextGroup}>
                <Text style={[styles.headerTitle, { color: COLORS.surface }]} numberOfLines={1}>
                  {capitalizeFirstLetter(getCleanedGroupName())}
                </Text>
                {typingUsers.length > 0 && (
                  <Text style={[styles.headerSub, { color: 'rgba(255,255,255,0.8)' }]}>
                    {typingUsers.map(u => capitalizeFirstLetter(u.username)).join(", ")} typing...
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}

          {roomDetail?.type !== "direct" && (
            <TouchableOpacity 
              style={styles.headerProfileBtn}
              onPress={() => {
                router.push({ pathname: "/chat-info/[roomId]", params: { roomId: parsedRoomId } });
              }}
            >
              <View style={styles.headerTextGroup}>
                <Text style={[styles.headerTitle, { color: COLORS.surface }]} numberOfLines={1}>
                  {capitalizeFirstLetter(getCleanedGroupName())}
                </Text>
                <Text style={[styles.headerSub, { color: 'rgba(255,255,255,0.8)' }]}>
                  {typingUsers.length > 0 
                    ? `${typingUsers.map(u => capitalizeFirstLetter(u.username)).join(", ")} typing...`
                    : roomDetail?.type === "squad" 
                      ? "Active Team Group" 
                      : "Active Game Group"}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {roomDetail?.type !== "direct" && (
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.headerMenuBtn}>
            <Ionicons name="ellipsis-vertical" size={22} color={COLORS.surface} />
          </TouchableOpacity>
        )}

        {/* Dropdown Menu */}
        {showMenu && (
          <View style={styles.menuDropdown}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setShowMenu(false);
                router.push({ pathname: "/chat-info/[roomId]", params: { roomId: parsedRoomId } });
              }}
            >
              <Ionicons name="information-circle-outline" size={18} color={COLORS.textPrimary} />
              <Text style={styles.menuText}>Group Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleExitGroup}>
              <Ionicons name="exit-outline" size={18} color={COLORS.error} />
              <Text style={[styles.menuText, { color: COLORS.error }]}>Exit Group</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleReportGroup}>
              <Ionicons name="flag-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.menuText}>Report Group</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : (keyboardHeight > 0 ? -60 : 0)}
      >
        {/* Messages list */}
        {loading && messages.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages.filter((m: any) => !hiddenMessageIds.includes(m.id))}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.messageScroll}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isOwn = item.sender_id === auth.user?.id;
              
              let swipeableRef: Swipeable | null = null;
              
              const renderLeftActions = () => {
                return (
                  <View style={styles.replySwipeAction}>
                    <Ionicons name="arrow-undo-outline" size={22} color={COLORS.primary} />
                  </View>
                );
              };

              return (
                <Swipeable
                  ref={(ref) => { swipeableRef = ref; }}
                  renderLeftActions={renderLeftActions}
                  onSwipeableLeftOpen={() => {
                    setReplyingToMessage(item);
                    swipeableRef?.close();
                  }}
                  friction={2}
                  leftThreshold={45}
                >
                  <View style={[
                    styles.bubbleWrapper, 
                    isOwn ? styles.bubbleOwnWrapper : styles.bubbleOtherWrapper,
                    item.type === "image" ? { maxWidth: "88%" } : null
                  ]}>
                  {/* Sender metadata */}
                  {!isOwn && (
                    <TouchableOpacity onPress={() => router.push({ pathname: "/user-profile", params: { userId: item.sender_id } })}>
                      <Text style={styles.senderName}>@{capitalizeFirstLetter(item.sender_username)}</Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* Bubble Surface */}
                  <TouchableOpacity 
                    activeOpacity={0.95} 
                    onLongPress={() => handleMessageLongPress(item)} 
                    style={[
                      styles.bubble, 
                      isOwn ? styles.bubbleOwn : styles.bubbleOther,
                      item.type === "poll" || item.type === "payment" ? styles.specialBubble : null,
                      item.type === "image" ? { padding: 4 } : null
                    ]}
                  >
                    
                    {/* Media Type Handler */}
                    {item.type === "text" && (() => {
                       const isReplyJSON = item.content && item.content.startsWith('{"is_reply":true');
                       let replyData = null;
                       let mainText = item.content;

                       if (isReplyJSON) {
                         try {
                           replyData = JSON.parse(item.content);
                           mainText = replyData.text;
                         } catch (e) {
                           // Fallback
                         }
                       }

                       return (
                         <View>
                           {replyData && (
                             <View style={[
                               styles.bubbleReplyQuoteBox,
                               isOwn ? styles.bubbleReplyQuoteBoxOwn : styles.bubbleReplyQuoteBoxOther
                             ]}>
                               <Text style={[styles.replyQuoteUser, isOwn ? styles.replyQuoteUserOwn : null]} numberOfLines={1}>
                                 @{capitalizeFirstLetter(replyData.reply_to_username)}
                               </Text>
                               <Text style={[styles.replyQuoteText, isOwn ? styles.replyQuoteTextOwn : null]} numberOfLines={1}>
                                 {replyData.reply_to_text}
                               </Text>
                             </View>
                           )}
                           <Text style={[styles.msgText, isOwn ? styles.msgOwnText : null]}>{mainText}</Text>
                         </View>
                       );
                     })()}

                    {item.type === "image" && (
                      <TouchableOpacity 
                        activeOpacity={0.9}
                        onPress={() => openViewer(item.image_url)}
                      >
                        <View style={styles.imageBubbleWrapper}>
                          <Image 
                            source={{ uri: item.image_url }} 
                            style={styles.bubbleImg} 
                            resizeMode="contain"
                          />
                          {item.content && <Text style={[styles.msgText, isOwn ? styles.msgOwnText : null, { marginTop: 6 }]}>{item.content}</Text>}
                        </View>
                      </TouchableOpacity>
                    )}

                    {item.type === "poll" && (
                      <View style={styles.pollCard}>
                        <Text style={styles.pollTitle}><Ionicons name="stats-chart" size={16} /> {item.poll_question}</Text>
                        <View style={styles.pollOptionsList}>
                          {item.poll_options?.map((option: string, idx: number) => {
                            const votesArray = item.poll_votes?.[idx.toString()] || [];
                            const totalVotes = (Object.values(item.poll_votes || {}) as number[][]).reduce((acc: number, curr: number[]) => acc + curr.length, 0);
                            const hasVoted = votesArray.includes(auth.user?.id || 0);
                            const percentage = totalVotes > 0 ? (votesArray.length / totalVotes) * 100 : 0;
                            
                            // Find option with maximum votes
                            const pollVotesObj = item.poll_votes || {};
                            const maxVotes = Math.max(
                              ...Object.values(pollVotesObj).map((arr: any) => (arr || []).length),
                              0
                            );
                            const isWinner = maxVotes > 0 && votesArray.length === maxVotes;

                            return (
                              <TouchableOpacity 
                                key={idx} 
                                style={[
                                  styles.pollOptionBtn, 
                                  hasVoted ? styles.pollOptionVoted : null,
                                  isWinner ? styles.pollOptionWinner : null
                                ]}
                                onPress={() => handleVote(item.id, idx)}
                              >
                                <View 
                                  style={[
                                    styles.pollVoteProgress, 
                                    { 
                                      width: `${percentage}%`,
                                      backgroundColor: isWinner ? "rgba(76, 175, 80, 0.28)" : "rgba(33, 150, 243, 0.15)"
                                    }
                                  ]} 
                                />
                                <View style={styles.pollOptionLabelRow}>
                                  <Text style={styles.pollOptionLabel}>{option}</Text>
                                  <Text style={[styles.pollOptionCount, isWinner ? styles.pollOptionCountWinner : null]}>
                                    {votesArray.length} votes
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {item.type === "payment" && (
                      <View style={styles.paymentCard}>
                        <View style={styles.paymentHeader}>
                          <Ionicons name="wallet-outline" size={24} color={COLORS.primary} />
                          <View style={{ marginLeft: 10 }}>
                            <Text style={styles.paymentTitle}>{item.content}</Text>
                            <Text style={styles.paymentAmount}>Rs. {item.payment_amount}</Text>
                          </View>
                        </View>
                        
                        {item.payment_status === "paid" ? (
                          <View style={styles.paymentStatusPaid}>
                            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                            <Text style={styles.paymentPaidText}>Payment Completed</Text>
                          </View>
                        ) : (
                          <View style={styles.paymentStatusPending}>
                            <Text style={styles.paymentPendingText}>Status: Unpaid</Text>
                            {!isOwn && (
                              <TouchableOpacity 
                                style={styles.paymentPayBtn}
                                onPress={() => handlePayRequest(item.id, parseFloat(item.payment_amount!.toString()))}
                              >
                                <Text style={styles.paymentPayBtnText}>Pay Now</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    )}

                    {item.type.startsWith("shared_") && (
                      <View style={[styles.paymentCard, { borderColor: COLORS.primary }]}>
                        <View style={styles.paymentHeader}>
                          <Ionicons 
                            name={item.type === "shared_profile" ? "person-outline" : item.type === "shared_game" ? "football-outline" : "location-outline"} 
                            size={24} 
                            color={COLORS.primary} 
                          />
                          <View style={{ marginLeft: 10 }}>
                            <Text style={styles.paymentTitle}>
                              Shared {item.type.replace("shared_", "").charAt(0).toUpperCase() + item.type.replace("shared_", "").slice(1)}
                            </Text>
                            <Text style={styles.paymentAmount}>
                              {(() => {
                                try {
                                  return JSON.parse(item.content).title;
                                } catch (e) {
                                  return "Unknown";
                                }
                              })()}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[styles.paymentPayBtn, { marginTop: 10 }]}
                          onPress={() => {
                            try {
                              const shared = JSON.parse(item.content);
                              if (item.type === "shared_profile") router.push({ pathname: "/user-profile", params: { userId: shared.id } });
                              if (item.type === "shared_game") router.push({ pathname: "/(tabs)/explore", params: { gameId: shared.id } });
                              if (item.type === "shared_venue") router.push({ pathname: "/(tabs)/booking", params: { venueId: shared.id } });
                            } catch (e) {
                              Alert.alert("Error", "Invalid link");
                            }
                          }}
                        >
                          <Text style={styles.paymentPayBtnText}>View</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Time Stamp */}
                    <Text style={[styles.msgTime, isOwn ? styles.msgOwnTime : null]}>
                      {parseUTCDate(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </TouchableOpacity>
                  </View>
                </Swipeable>
              );
            }}
          />
        )}

        {/* Typing Bar indicator */}
        {typingUsers.length > 0 && (
          <View style={styles.typingIndicatorBar}>
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.typingIndicatorText}>
              {typingUsers.map(u => u.username).join(", ")} is typing...
            </Text>
          </View>
        )}

        {/* Attachments Drawer */}
        {showAttachmentMenu && (
          <View style={styles.attachmentDrawer}>
            <TouchableOpacity style={styles.attachmentOption} onPress={handleShareImage}>
              <View style={[styles.attachmentIconWrapper, { backgroundColor: "#E3F2FD" }]}>
                <Ionicons name="image-outline" size={22} color="#1565C0" />
              </View>
              <Text style={styles.attachmentLabel}>Share Image</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachmentOption} onPress={() => setShowPollModal(true)}>
              <View style={[styles.attachmentIconWrapper, { backgroundColor: "#E8F5E9" }]}>
                <Ionicons name="stats-chart-outline" size={22} color="#2E7D32" />
              </View>
              <Text style={styles.attachmentLabel}>Create Poll</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachmentOption} onPress={() => setShowPaymentModal(true)}>
              <View style={[styles.attachmentIconWrapper, { backgroundColor: "#FFFDE7" }]}>
                <Ionicons name="card-outline" size={22} color="#F57F17" />
              </View>
              <Text style={styles.attachmentLabel}>Payment Request</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reply Preview */}
        {replyingToMessage && (
          <View style={styles.replyPreviewContainer}>
            <View style={styles.replyPreviewLeftBar} />
            <View style={styles.replyPreviewContent}>
              <Text style={styles.replyPreviewUser}>
                Replying to @{capitalizeFirstLetter(replyingToMessage.sender_username)}
              </Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>
                {getReplyTextSnippet(replyingToMessage)}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.replyPreviewCloseBtn} 
              onPress={() => setReplyingToMessage(null)}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Bar or Blocked Banner */}
        {isChatBlocked() ? (
          <View style={[styles.blockedBar, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 }]}>
            <Ionicons name="lock-closed" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.blockedText}>Chatting is closed as this game started more than 10 minutes ago.</Text>
          </View>
        ) : roomDetail?.blocked_by_me ? (
          <View style={[styles.blockedBar, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 }]}>
            <Ionicons name="ban-outline" size={20} color={COLORS.error} style={{ marginRight: 8 }} />
            <Text style={styles.blockedText}>
              You blocked this user.{" "}
              <Text style={{ color: COLORS.primary, fontWeight: 'bold', textDecorationLine: 'underline' }} onPress={handleUnblockUser}>
                Unblock
              </Text>
            </Text>
          </View>
        ) : roomDetail?.has_blocked_me ? (
          <View style={[styles.blockedBar, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 }]}>
            <Ionicons name="ban-outline" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.blockedText}>You cannot message this user.</Text>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom + 4 : 12 }]}>
            <TouchableOpacity 
              style={styles.attachmentBtn} 
              onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}
            >
              <Ionicons 
                name={showAttachmentMenu ? "close-circle" : "add-circle"} 
                size={28} 
                color={COLORS.primary} 
              />
            </TouchableOpacity>
            
            <TextInput
              style={styles.chatInput}
              placeholder="Type message here..."
              placeholderTextColor={COLORS.textSecondary}
              value={inputMessage}
              onChangeText={(text) => {
                setInputMessage(text);
                if (text.length > 0 && !typing) handleTypingStatus(true);
                if (text.length === 0 && typing) handleTypingStatus(false);
              }}
            />

            <TouchableOpacity style={styles.sendBtn} onPress={handleSendText}>
              <Ionicons name="send" size={20} color={COLORS.surface} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* POLL CREATION MODAL */}
      <Modal visible={showPollModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Live Poll</Text>
            
            <Text style={styles.modalLabel}>Question</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Which turf should we book?"
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />

            <Text style={styles.modalLabel}>Options</Text>
            {pollOptions.map((opt, index) => (
              <TextInput
                key={index}
                style={styles.modalInput}
                placeholder={`Option ${index + 1}`}
                value={opt}
                onChangeText={(text) => {
                  const copy = [...pollOptions];
                  copy[index] = text;
                  setPollOptions(copy);
                }}
              />
            ))}

            <TouchableOpacity 
              style={styles.addOptionBtn}
              onPress={() => setPollOptions([...pollOptions, ""])}
            >
              <Text style={styles.addOptionText}>+ Add Option</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPollModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handleCreatePoll}>
                <Text style={styles.submitText}>Submit Poll</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PAYMENT REQUEST MODAL */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Payment</Text>
            
            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Turf Booking Contribution"
              value={paymentTitle}
              onChangeText={setPaymentTitle}
            />

            <Text style={styles.modalLabel}>Amount per Player (Rs.)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Amount (e.g. 150)"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPaymentModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handleCreatePaymentRequest}>
                <Text style={styles.submitText}>Send Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ROSTER MODAL */}
      <Modal visible={showRosterModal} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { maxHeight: "70%" }]}>
            <View style={styles.rosterHeader}>
              <Text style={styles.modalTitle}>Group Roster</Text>
              <TouchableOpacity onPress={() => setShowRosterModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              <Text style={styles.rosterSectionTitle}>Participants list</Text>
              <View style={styles.rosterItem}>
                <Ionicons name="person-circle" size={32} color={COLORS.primary} />
                <Text style={styles.rosterUsername}>@{auth.user?.username} (You)</Text>
              </View>
              {/* Dummy squad mates for showcase */}
              <View style={styles.rosterItem}>
                <Ionicons name="person-circle" size={32} color={COLORS.textSecondary} />
                <Text style={styles.rosterUsername}>@rahul_s</Text>
              </View>
              <View style={styles.rosterItem}>
                <Ionicons name="person-circle" size={32} color={COLORS.textSecondary} />
                <Text style={styles.rosterUsername}>@amit_sharma</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== IMAGE SOURCE PICKER MODAL ===== */}
      <Modal visible={showImageSourceModal} transparent animationType="fade" onRequestClose={() => setShowImageSourceModal(false)}>
        <View style={styles.imgPickerOverlay}>
          <View style={styles.imgPickerCard}>
            {/* Icon header */}
            <View style={styles.imgPickerIconRow}>
              <View style={styles.imgPickerIconCircle}>
                <Ionicons name="images" size={32} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.imgPickerTitle}>Share a Photo</Text>
            <Text style={styles.imgPickerSubtitle}>Choose where to pick your image from</Text>

            {/* Gallery button */}
            <TouchableOpacity style={styles.imgPickerBtn} onPress={() => pickFromSource(false)}>
              <View style={styles.imgPickerBtnIcon}>
                <Ionicons name="image-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.imgPickerBtnLabel}>Gallery</Text>
                <Text style={styles.imgPickerBtnSub}>Pick from your photo library</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {/* Camera button */}
            <TouchableOpacity style={styles.imgPickerBtn} onPress={() => pickFromSource(true)}>
              <View style={[styles.imgPickerBtnIcon, { backgroundColor: "#FFF3E0" }]}>
                <Ionicons name="camera-outline" size={22} color="#F57C00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.imgPickerBtnLabel}>Camera</Text>
                <Text style={styles.imgPickerBtnSub}>Take a new photo right now</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity style={styles.imgPickerCancelBtn} onPress={() => setShowImageSourceModal(false)}>
              <Text style={styles.imgPickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Uploading overlay */}
      {imageUploading && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.uploadingText}>Uploading image…</Text>
          </View>
        </View>
      )}

      {/* ===== CUSTOM IMAGE PREVIEW (replaces native crop screen) ===== */}
      <Modal
        visible={!!previewAsset}
        transparent={false}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPreviewAsset(null)}
      >
        <View style={styles.previewContainer}>
          {/* Header bar */}
          <View style={styles.previewHeader}>
            <TouchableOpacity
              style={styles.previewBackBtn}
              onPress={() => setPreviewAsset(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.previewHeaderTitle}>Preview</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Full image preview */}
          <View style={styles.previewImageContainer}>
            {previewAsset && (
              <Image
                source={{ uri: previewAsset.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
          </View>

          {/* Bottom action bar */}
          <View style={styles.previewBottomBar}>
            <TouchableOpacity
              style={styles.previewCancelBtn}
              onPress={() => setPreviewAsset(null)}
            >
              <Text style={styles.previewCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.previewSendBtn}
              onPress={handleSendPreviewImage}
            >
              <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.previewSendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== FULLSCREEN IMAGE VIEWER ===== */}
      {viewerImageUrl && (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={closeViewer}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.viewerBg}>
              {/* Close button */}
              <TouchableOpacity style={styles.viewerCloseBtn} onPress={closeViewer}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>

              {/* Pinch + Pan + Double-tap image */}
              <ViewerImage imageUrl={viewerImageUrl} />
            </View>
          </GestureHandlerRootView>
        </Modal>
      )}
    </View>
  );
}

// ── Full-screen image viewer with pinch, pan & double-tap ─────────────
function ViewerImage({ imageUrl }: { imageUrl: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const transX = useSharedValue(0);
  const transY = useSharedValue(0);
  const savedTransX = useSharedValue(0);
  const savedTransY = useSharedValue(0);

  // Pinch to zoom (min 1x, max 6x)
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 6));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  // Pan to move when zoomed in
  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        transX.value = savedTransX.value + e.translationX;
        transY.value = savedTransY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTransX.value = transX.value;
      savedTransY.value = transY.value;
    });

  // Double-tap: toggle zoom 1x <-> 2.5x
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      if (scale.value > 1) {
        // Reset to fit
        scale.value = withSpring(1, { damping: 15 });
        savedScale.value = 1;
        transX.value = withSpring(0, { damping: 15 });
        transY.value = withSpring(0, { damping: 15 });
        savedTransX.value = 0;
        savedTransY.value = 0;
      } else {
        scale.value = withSpring(2.5, { damping: 15 });
        savedScale.value = 2.5;
      }
    });

  // Exclusive: double-tap is tried first; if it doesn't match, pinch+pan run
  const composed = Gesture.Exclusive(
    doubleTap,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: transX.value },
      { translateY: transY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={StyleSheet.absoluteFillObject}>
        <Animated.Image
          source={{ uri: imageUrl }}
          style={[StyleSheet.absoluteFillObject, animStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  chatHeader: {
    flexDirection: "row",
    height: Platform.OS === "ios" ? 90 : (StatusBar.currentHeight || 24) + 54,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    paddingTop: Platform.OS === "ios" ? 44 : (StatusBar.currentHeight || 24) + 10,
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    justifyContent: "space-between",
    zIndex: 100,
    ...SHADOWS.soft,
  },
  backBtn: {
    padding: SPACING.xs,
  },
  headerInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  headerProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  headerSub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerMenuBtn: {
    padding: 6,
  },
  menuDropdown: {
    position: "absolute",
    top: Platform.OS === "ios" ? 90 : 64,
    right: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    width: 180,
    padding: 6,
    ...SHADOWS.medium,
  },
  menuItem: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 8,
  },
  menuText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  messageScroll: {
    padding: SPACING.xl,
    paddingBottom: 20,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bubbleWrapper: {
    marginBottom: 16,
    maxWidth: "80%",
  },
  bubbleOwnWrapper: {
    alignSelf: "flex-end",
  },
  bubbleOtherWrapper: {
    alignSelf: "flex-start",
  },
  imageBubbleWrapper: {
    // Give images more room to breathe
    width: 240,
    minWidth: 200,
    overflow: "hidden",
    borderRadius: 12,
  },
  senderName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginLeft: 6,
  },
  bubble: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    position: "relative",
    ...SHADOWS.soft,
  },
  bubbleOwn: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  specialBubble: {
    width: 250,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  msgText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  msgOwnText: {
    color: COLORS.surface,
  },
  msgTime: {
    fontFamily: "Poppins_400Regular",
    fontSize: 9,
    color: COLORS.textSecondary,
    alignSelf: "flex-end",
    marginTop: 4,
  },
  msgOwnTime: {
    color: COLORS.cardBackground,
  },
  bubbleImg: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: "#000",
  },
  pollCard: {
    padding: 4,
  },
  pollTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 10,
  },
  pollOptionsList: {
    gap: 8,
  },
  pollOptionBtn: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pollOptionVoted: {
    borderColor: COLORS.primary,
  },
  pollOptionWinner: {
    borderColor: "#4CAF50",
    borderWidth: 1.5,
  },
  pollVoteProgress: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: COLORS.cardBackground + "60",
  },
  pollOptionLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    zIndex: 1,
  },
  pollOptionLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  pollOptionCount: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  pollOptionCountWinner: {
    color: "#2E7D32",
    fontFamily: "Poppins_600SemiBold",
  },
  paymentCard: {
    padding: 4,
  },
  paymentHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  paymentTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  paymentAmount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.primary,
    marginTop: 2,
  },
  paymentStatusPaid: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.success + "15",
    padding: 8,
    borderRadius: 10,
    marginTop: 12,
    justifyContent: "center",
  },
  paymentPaidText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.success,
    marginLeft: 4,
  },
  paymentStatusPending: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  paymentPendingText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  paymentPayBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  paymentPayBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.surface,
  },
  typingIndicatorBar: {
    flexDirection: "row",
    paddingHorizontal: SPACING.xl,
    paddingVertical: 6,
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  typingIndicatorText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  inputBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
    alignItems: "center",
  },
  attachmentBtn: {
    padding: 4,
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 23,
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 0,
    height: 46,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlignVertical: "center",
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.soft,
  },
  attachmentDrawer: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 14,
    justifyContent: "space-around",
  },
  attachmentOption: {
    alignItems: "center",
  },
  attachmentIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  attachmentLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(26,26,26,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  modalContent: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  rosterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
    marginBottom: 10,
  },
  rosterSectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  rosterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  rosterUsername: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  modalLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 12,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  addOptionBtn: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  addOptionText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  cancelText: {
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  modalSubmit: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  submitText: {
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.surface,
    fontSize: 14,
  },
  blockedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  blockedText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // ── Image Picker Modal ──────────────────────────────────
  imgPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 24,
  },
  imgPickerCard: {
    width: "92%",
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    padding: 24,
    alignItems: "stretch",
    ...SHADOWS.medium,
  },
  imgPickerIconRow: {
    alignItems: "center",
    marginBottom: 12,
  },
  imgPickerIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  imgPickerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  imgPickerSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 22,
  },
  imgPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
  },
  imgPickerBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + "12",
    justifyContent: "center",
    alignItems: "center",
  },
  imgPickerBtnLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  imgPickerBtnSub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  imgPickerCancelBtn: {
    marginTop: 6,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
  },
  imgPickerCancelText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // ── Uploading Overlay ───────────────────────────────────
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  uploadingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 14,
    ...SHADOWS.medium,
  },
  uploadingText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  // ── Custom Image Preview ──────────────────────────────────
  previewContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: (StatusBar.currentHeight || 24) + 12,
    paddingHorizontal: 16,
    height: 80,
  },
  previewBackBtn: {
    padding: 4,
  },
  previewHeaderTitle: {
    color: "#fff",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
  },
  previewImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewBottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  previewCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewCancelText: {
    color: "#fff",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  previewSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
  },
  previewSendText: {
    color: "#fff",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },

  // ── Fullscreen Image Viewer ──────────────────────────────
  viewerBg: {
    flex: 1,
    backgroundColor: "#000",
  },
  viewerCloseBtn: {
    position: "absolute",
    top: (StatusBar.currentHeight || 24) + 12,
    right: 18,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 24,
    padding: 8,
  },
  
  // ── Swipe to Reply Styles ──────────────────────────────
  replySwipeAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 60,
    paddingLeft: 16,
  },
  replyPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  replyPreviewLeftBar: {
    width: 4,
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  replyPreviewContent: {
    flex: 1,
    paddingLeft: 12,
  },
  replyPreviewUser: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  replyPreviewText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  replyPreviewCloseBtn: {
    padding: 4,
  },
  
  // ── Bubble Reply Quote Styles ──────────────────────────
  bubbleReplyQuoteBox: {
    borderLeftWidth: 3.5,
    paddingLeft: 10,
    paddingVertical: 5,
    marginBottom: 6,
    borderRadius: 4,
    width: "100%",
  },
  bubbleReplyQuoteBoxOwn: {
    borderLeftColor: COLORS.surface,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  bubbleReplyQuoteBoxOther: {
    borderLeftColor: COLORS.primary,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  replyQuoteUser: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  replyQuoteUserOwn: {
    color: COLORS.surface,
  },
  replyQuoteText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  replyQuoteTextOwn: {
    color: "rgba(255,255,255,0.8)",
  },
});
