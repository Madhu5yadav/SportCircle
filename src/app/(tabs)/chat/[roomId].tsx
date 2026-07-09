import React, { useState, useEffect, useRef } from "react";
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
  SafeAreaView
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons, FontAwesome, MaterialIcons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../../../theme/theme";
import { RootState } from "../../../redux/store";
import api from "../../../services/api";
import { addMessage, setMessages, setActiveRoom } from "../../../redux/chatSlice";
import { SocketService } from "../../../services/socket";
import { updateWallet } from "../../../redux/authSlice";

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
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const parsedRoomId = parseInt(roomId);

  const auth = useSelector((state: RootState) => state.auth);
  const chatState = useSelector((state: RootState) => state.chat);
  
  const messages = chatState.messages[parsedRoomId] || [];
  const typingUsers = chatState.typingUsers[parsedRoomId] || [];

  const flatListRef = useRef<FlatList>(null);

  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  
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
  const [roomDetail, setRoomDetail] = useState<any>(null);

  const isChatBlocked = () => {
    if (!roomDetail || roomDetail.type !== "game") return false;
    if (!roomDetail.game_date || !roomDetail.end_time) return false;
    
    try {
      const now = new Date();
      const [yr, mo, dy] = roomDetail.game_date.split("-").map(Number);
      const [hr, min, sec] = roomDetail.end_time.split(":").map(Number);
      const gameEnd = new Date(yr, mo - 1, dy, hr, min, sec || 0);
      if (isNaN(gameEnd.getTime())) return false;
      const blockTime = new Date(gameEnd.getTime() + 10 * 60 * 1000);
      return now > blockTime;
    } catch (e) {
      return false;
    }
  };

  // Load chat profile and messages
  const loadChatData = async () => {
    setLoading(true);
    try {
      try {
        const roomRes = await api.get(`/chat/room/${parsedRoomId}`);
        setRoomDetail(roomRes.data);
      } catch (err) {
        console.log("Error loading room detail metadata:", err);
      }
      const response = await api.get(`/messages?room_id=${parsedRoomId}`);
      // Parse JSON fields
      const formatted = response.data.map((m: any) => ({
        ...m,
        poll_options: m.poll_options ? JSON.parse(m.poll_options) : undefined,
        poll_votes: m.poll_votes ? JSON.parse(m.poll_votes) : undefined,
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

  const sendMessage = async (payload: any) => {
    if (isChatBlocked()) {
      Alert.alert("Chat Archived", "You cannot send messages to this room anymore.");
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

  const handleSendText = () => {
    if (!inputMessage.trim()) return;
    sendMessage({
      content: inputMessage.trim(),
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
    Alert.alert(
      "Share Image",
      "Simulate uploading a sports court mockup image?",
      [
        { text: "Cancel" },
        {
          text: "Upload Mockup",
          onPress: () => {
            sendMessage({
              type: "image",
              image_url: "https://images.unsplash.com/photo-1544698310-74ea9d1c8258?q=80&w=600"
            });
            setShowAttachmentMenu(false);
          }
        }
      ]
    );
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header bar */}
      <View style={styles.chatHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>Chat Room #{parsedRoomId}</Text>
          <Text style={styles.headerSub}>
            {typingUsers.length > 0 
              ? `${typingUsers.map(u => u.username).join(", ")} typing...`
              : "Active Team Group"}
          </Text>
        </View>

        <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.headerMenuBtn}>
          <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Dropdown Menu */}
        {showMenu && (
          <View style={styles.menuDropdown}>
            <TouchableOpacity style={styles.menuItem} onPress={handleViewRoster}>
              <Ionicons name="people-outline" size={18} color={COLORS.textPrimary} />
              <Text style={styles.menuText}>View Team Roster</Text>
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Messages list */}
        {loading && messages.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.messageScroll}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isOwn = item.sender_id === auth.user?.id;
              
              return (
                <View style={[styles.bubbleWrapper, isOwn ? styles.bubbleOwnWrapper : styles.bubbleOtherWrapper]}>
                  {/* Sender metadata */}
                  {!isOwn && (
                    <Text style={styles.senderName}>{item.sender_username}</Text>
                  )}
                  
                  {/* Bubble Surface */}
                  <View style={[
                    styles.bubble, 
                    isOwn ? styles.bubbleOwn : styles.bubbleOther,
                    item.type === "poll" || item.type === "payment" ? styles.specialBubble : null
                  ]}>
                    
                    {/* Media Type Handler */}
                    {item.type === "text" && (
                      <Text style={[styles.msgText, isOwn ? styles.msgOwnText : null]}>{item.content}</Text>
                    )}

                    {item.type === "image" && (
                      <View>
                        <Image source={{ uri: item.image_url }} style={styles.bubbleImg} />
                        {item.content && <Text style={[styles.msgText, isOwn ? styles.msgOwnText : null, { marginTop: 6 }]}>{item.content}</Text>}
                      </View>
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

                            return (
                              <TouchableOpacity 
                                key={idx} 
                                style={[styles.pollOptionBtn, hasVoted ? styles.pollOptionVoted : null]}
                                onPress={() => handleVote(item.id, idx)}
                              >
                                <View style={[styles.pollVoteProgress, { width: `${percentage}%` }]} />
                                <View style={styles.pollOptionLabelRow}>
                                  <Text style={styles.pollOptionLabel}>{option}</Text>
                                  <Text style={styles.pollOptionCount}>{votesArray.length} votes</Text>
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

                    {/* Time Stamp */}
                    <Text style={[styles.msgTime, isOwn ? styles.msgOwnTime : null]}>
                      {parseUTCDate(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>
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

        {/* Input Bar or Blocked Banner */}
        {isChatBlocked() ? (
          <View style={styles.blockedBar}>
            <Ionicons name="lock-closed" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.blockedText}>Chat is archived because the game has concluded.</Text>
          </View>
        ) : (
          <View style={styles.inputBar}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  chatHeader: {
    flexDirection: "row",
    height: Platform.OS === "ios" ? 90 : 64,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    paddingTop: Platform.OS === "ios" ? 44 : 10,
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    justifyContent: "space-between",
    zIndex: 100,
    ...SHADOWS.soft,
  },
  backBtn: {
    padding: 6,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
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
    height: 140,
    borderRadius: 12,
    resizeMode: "cover",
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
    paddingVertical: 10,
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
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
});
