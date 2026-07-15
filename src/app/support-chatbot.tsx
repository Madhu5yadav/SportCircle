import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { COLORS, SPACING, SHADOWS } from "../theme/theme";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: Date;
}

const QUICK_OPTIONS = [
  { id: "wallet", label: "💳 Wallet & Cash", category: "Wallet" },
  { id: "booking", label: "🏟️ Turf Bookings", category: "Booking" },
  { id: "games", label: "🏆 Host/Join Games", category: "Match" },
  { id: "trust", label: "🛡️ Trust Score & Rules", category: "Account" },
];

const BOT_RESPONSES: Record<string, { answer: string; followUp: string }> = {
  wallet: {
    answer: "💳 **Wallet & Payments Assistance**\n\nTo add money to your SportCircle wallet:\n1. Navigate to the **Profile** tab.\n2. Tap the **SportCircle Wallet** row.\n3. Enter the cash amount you wish to add.\n4. Click **Add Funds**.\n\nFor failed payments or refunds, money usually gets credited back to your bank account within 2-3 business days.",
    followUp: "Did this help? If not, you can convert this chat to a support ticket.",
  },
  booking: {
    answer: "🏟️ **Turf & Slot Booking Assistance**\n\nBooking a turf venue is simple:\n1. Head to the **Explore** tab to browse venues near you.\n2. Tap on your desired venue.\n3. Tap **Select Slot**, pick date & time slots, and pay with wallet cash.\n\nTo cancel: You can cancel bookings up to 4 hours before the match from the Booking status page for a full refund.",
    followUp: "Do you need help canceling a specific booking?",
  },
  games: {
    answer: "🏆 **Hosting & Joining Matches**\n\nTo organize or join a game:\n- **Host Game**: Tap the 'Host' float button on the home screen, configure sports type, slot, and entry fee, then confirm.\n- **Join Game**: View public games on the Home screen feed and tap 'Join Game' to reserve your spot instantly.\n- **Squads**: Navigate to chat or explore, create a new squad, and invite your friends for multiplayer turf matchups.",
    followUp: "Would you like help setting up a team squad?",
  },
  trust: {
    answer: "🛡️ **Trust Score & Platform Rules**\n\nYour **Trust Score** represents your reliability in matches:\n- **Default Score**: 5.0 (Excellent)\n- **How to increase**: Show up on time, play fair, and complete matches.\n- **How it decreases**: Canceling matches within 2 hours of start time or getting flagged as no-show (-1.0 point per incident).\n\nLower trust scores (below 3.0) may limit your ability to join popular public games.",
    followUp: "Maintaining a good trust score keeps the community healthy!",
  },
};

export default function SupportChatbotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useSelector((state: RootState) => state.auth);
  const userName = auth.user?.first_name || auth.user?.username || "Player";

  const flatListRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lastCategory, setLastCategory] = useState<string>("Other");

  // Initial Greet
  useEffect(() => {
    setMessages([
      {
        id: "1",
        sender: "bot",
        text: `Hi ${userName}! 👋 Welcome to SportCircle Assistant.\n\nHow can I help you today? Please choose one of the quick options below or type your question.`,
        timestamp: new Date(),
      },
    ]);
  }, [userName]);

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleQuickOptionPress = (id: string, category: string, label: string) => {
    setLastCategory(category);
    // User message
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: label,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    // Trigger typing response
    setIsTyping(true);
    setTimeout(() => {
      const response = BOT_RESPONSES[id];
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        text: response ? response.answer : "I couldn't find details on that option. Let me know how I can help.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      scrollToBottom();
    }, 1000);
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    setInputText("");

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    setIsTyping(true);

    // AI/Keyword matcher responder
    setTimeout(() => {
      const query = userText.toLowerCase();
      let botAnswer = "";

      if (query.includes("wallet") || query.includes("money") || query.includes("cash") || query.includes("refund") || query.includes("payment")) {
        botAnswer = BOT_RESPONSES.wallet.answer;
        setLastCategory("Wallet");
      } else if (query.includes("book") || query.includes("turf") || query.includes("slot") || query.includes("cancel") || query.includes("venue")) {
        botAnswer = BOT_RESPONSES.booking.answer;
        setLastCategory("Booking");
      } else if (query.includes("host") || query.includes("game") || query.includes("match") || query.includes("join") || query.includes("squad")) {
        botAnswer = BOT_RESPONSES.games.answer;
        setLastCategory("Match");
      } else if (query.includes("trust") || query.includes("score") || query.includes("rule") || query.includes("no show")) {
        botAnswer = BOT_RESPONSES.trust.answer;
        setLastCategory("Account");
      } else {
        botAnswer = `Thanks for writing. I'm trained to help with: \n\n• Wallet additions & payments\n• Turf bookings & slot selections\n• Match hosting or joining public games\n• Trust scores and community rules\n\nIf you have a complex query, please use the **Create Ticket** button at the top to contact support.`;
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        text: botAnswer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      scrollToBottom();
    }, 1200);
  };

  const handleConvertToTicket = () => {
    // Generate context summary from the conversation logs
    const title = messages.find(m => m.sender === "user")?.text.slice(0, 40) || `Support Query regarding ${lastCategory}`;
    
    let description = "CircleBot Chat Logs:\n\n";
    messages.forEach((m) => {
      description += `${m.sender.toUpperCase()}: ${m.text}\n\n`;
    });

    // Navigate to Support Tickets screen with search params pre-populated
    router.push({
      pathname: "/support-tickets" as any,
      params: {
        title: title,
        category: lastCategory,
        description: description.trim(),
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
          </TouchableOpacity>
          <View style={styles.botTitleCol}>
            <Text style={styles.headerTitle}>CircleBot</Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusText}>Support Assistant</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleConvertToTicket} style={styles.ticketBtn}>
            <Ionicons name="create-outline" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={styles.ticketBtnText}>Create Ticket</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatListContent}
        onContentSizeChange={scrollToBottom}
        renderItem={({ item }) => (
          <View
            style={[
              styles.msgWrapper,
              item.sender === "user" ? styles.userMsgWrapper : styles.botMsgWrapper,
            ]}
          >
            {item.sender === "bot" && (
              <View style={styles.botAvatar}>
                <Ionicons name="logo-android" size={16} color={COLORS.surface} />
              </View>
            )}
            <View
              style={[
                styles.msgBubble,
                item.sender === "user" ? styles.userMsgBubble : styles.botMsgBubble,
              ]}
            >
              <Text style={[
                styles.msgText,
                item.sender === "user" ? styles.userMsgText : styles.botMsgText
              ]}>
                {item.text}
              </Text>
              <Text style={[
                styles.msgTime,
                item.sender === "user" ? styles.userMsgTime : styles.botMsgTime
              ]}>
                {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={{ marginBottom: SPACING.md }}>
            {isTyping && (
              <View style={[styles.msgWrapper, styles.botMsgWrapper]}>
                <View style={styles.botAvatar}>
                  <Ionicons name="logo-android" size={16} color={COLORS.surface} />
                </View>
                <View style={[styles.msgBubble, styles.botMsgBubble, styles.typingBubble]}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              </View>
            )}
            
            {/* Quick action options list */}
            {messages.length > 0 && !isTyping && (
              <View style={styles.quickOptionsContainer}>
                <Text style={styles.quickOptionsLabel}>Common Topics:</Text>
                <View style={styles.quickChipsWrapper}>
                  {QUICK_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={styles.quickChip}
                      onPress={() => handleQuickOptionPress(opt.id, opt.category, opt.label)}
                    >
                      <Text style={styles.quickChipText}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        }
      />

      {/* Input Bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + SPACING.md }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask CircleBot anything..."
          placeholderTextColor={COLORS.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.disabledSendBtn]}
          onPress={handleSendMessage}
          disabled={!inputText.trim()}
        >
          <Ionicons name="paper-plane" size={20} color={COLORS.surface} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    ...SHADOWS.medium,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    padding: SPACING.xs,
  },
  botTitleCol: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  headerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.surface,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2ecc71",
    marginRight: 4,
  },
  statusText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.75)",
  },
  ticketBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: 12,
    ...SHADOWS.soft,
  },
  ticketBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.primary,
  },
  chatListContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  msgWrapper: {
    flexDirection: "row",
    marginBottom: SPACING.md,
    maxWidth: "80%",
  },
  userMsgWrapper: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
  },
  botMsgWrapper: {
    alignSelf: "flex-start",
    justifyContent: "flex-start",
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    alignSelf: "flex-end",
  },
  msgBubble: {
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    ...SHADOWS.soft,
  },
  userMsgBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 2,
  },
  botMsgBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typingBubble: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  msgText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  userMsgText: {
    color: COLORS.surface,
  },
  botMsgText: {
    color: COLORS.textPrimary,
  },
  msgTime: {
    fontFamily: "Poppins_400Regular",
    fontSize: 8,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  userMsgTime: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  botMsgTime: {
    color: COLORS.textSecondary,
  },
  quickOptionsContainer: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  quickOptionsLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  quickChipsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  quickChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 2,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
    ...SHADOWS.soft,
  },
  quickChipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.primary,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.background,
    borderRadius: 22,
    paddingHorizontal: SPACING.lg,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.md,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.soft,
  },
  disabledSendBtn: {
    opacity: 0.6,
  },
});
