import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { COLORS, SPACING, SHADOWS } from "../theme/theme";

const CATEGORIES = ["Booking", "Wallet", "Match", "Account", "Other"];

interface Ticket {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
}

export default function SupportTicketsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ title?: string; description?: string; category?: string }>();

  // States
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);

  // Form States
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Booking");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch Tickets
  const fetchTickets = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await api.get("/tickets");
      setTickets(response.data || []);
    } catch (err: any) {
      console.log("Error fetching tickets:", err);
      Alert.alert("Error", "Could not load support tickets. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Pre-fill form if redirected from Chatbot
  useEffect(() => {
    if (params.title || params.description || params.category) {
      if (params.title) setTitle(params.title);
      if (params.description) setDescription(params.description);
      if (params.category && CATEGORIES.includes(params.category)) {
        setCategory(params.category);
      }
      setActiveTab("create");
    }
  }, [params]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTickets(false);
  };

  const toggleExpand = (id: number) => {
    setExpandedTicketId(expandedTicketId === id ? null : id);
  };

  const handleSubmitTicket = async () => {
    if (!title.trim()) {
      Alert.alert("Validation Error", "Please enter a title for the support ticket.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Validation Error", "Please provide details about your issue.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/tickets", {
        title: title.trim(),
        category,
        description: description.trim(),
      });
      
      Alert.alert("Success", "Your support ticket has been created successfully!");
      // Reset form
      setTitle("");
      setDescription("");
      setCategory("Booking");
      // Fetch updated list and switch tab
      await fetchTickets(true);
      setActiveTab("list");
    } catch (err: any) {
      console.log("Error creating ticket:", err);
      Alert.alert("Error", "Failed to submit ticket. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "resolved":
        return COLORS.success;
      case "in progress":
        return COLORS.warning;
      default:
        return COLORS.primary;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Support Tickets</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "list" && styles.activeTab]}
            onPress={() => setActiveTab("list")}
          >
            <Text style={[styles.tabText, activeTab === "list" && styles.activeTabText]}>
              My Tickets
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "create" && styles.activeTab]}
            onPress={() => setActiveTab("create")}
          >
            <Text style={[styles.tabText, activeTab === "create" && styles.activeTabText]}>
              Raise a Ticket
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Area */}
      {activeTab === "list" ? (
        loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
            }
          >
            {tickets.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={80} color={COLORS.cardBackground} />
                <Text style={styles.emptyTitle}>No tickets found</Text>
                <Text style={styles.emptySub}>
                  Have a question or run into booking issues? Switch to the "Raise a Ticket" tab to let us know.
                </Text>
              </View>
            ) : (
              tickets.map((ticket) => {
                const isExpanded = expandedTicketId === ticket.id;
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    style={styles.ticketCard}
                    activeOpacity={0.8}
                    onPress={() => toggleExpand(ticket.id)}
                  >
                    <View style={styles.ticketHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.ticketTitle} numberOfLines={isExpanded ? undefined : 1}>
                          {ticket.title}
                        </Text>
                        <View style={styles.badgeRow}>
                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{ticket.category}</Text>
                          </View>
                          <Text style={styles.ticketDate}>
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(ticket.status) + "20" },
                        ]}
                      >
                        <Text style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>
                          {ticket.status}
                        </Text>
                      </View>
                    </View>

                    {isExpanded ? (
                      <View style={styles.expandedContent}>
                        <View style={styles.divider} />
                        <Text style={styles.descriptionLabel}>Details</Text>
                        <Text style={styles.descriptionText}>{ticket.description}</Text>
                        <Text style={styles.supportNote}>
                          Our support team will inspect the ticket and get in touch with you shortly.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.footerRow}>
                        <Text style={styles.viewDetailsText}>Tap to view details</Text>
                        <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )
      ) : (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>Subject / Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Booking failed but amount debited"
              placeholderTextColor={COLORS.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categoriesRow}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.activeCategoryChip,
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.activeCategoryChipText,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Describe the issue in detail</Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              placeholder="Provide context like transaction details, booking date/time, and steps to reproduce..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.disabledSubmitBtn]}
              onPress={handleSubmitTicket}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.surface} />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color={COLORS.surface} style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Submit Support Ticket</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
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
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    ...SHADOWS.medium,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  backBtn: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: COLORS.surface,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.soft,
  },
  tabText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  activeTabText: {
    color: COLORS.primary,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  emptySub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  ticketCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ticketTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  categoryBadge: {
    backgroundColor: COLORS.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: SPACING.sm,
  },
  categoryBadgeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    color: COLORS.primary,
  },
  ticketDate: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  statusText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
  },
  expandedContent: {
    marginTop: SPACING.md,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  descriptionLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  descriptionText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  supportNote: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: "italic",
    marginTop: SPACING.md,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewDetailsText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  inputLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  multilineInput: {
    minHeight: 120,
  },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginVertical: SPACING.xs,
  },
  categoryChip: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 2,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  activeCategoryChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  activeCategoryChipText: {
    color: COLORS.surface,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACING.md,
    marginTop: SPACING.xl,
    ...SHADOWS.medium,
  },
  disabledSubmitBtn: {
    opacity: 0.7,
  },
  submitBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.surface,
  },
});
