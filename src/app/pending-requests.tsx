import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import api from "../services/api";

interface PendingFriendRequest {
  friendship_id: number;
  friend_id: number;
  username: string;
  mobile: string;
  profile_pic?: string;
  status: string;
  created_at: string;
}

export default function PendingRequestsScreen() {
  const [requests, setRequests] = useState<PendingFriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = async () => {
    try {
      const response = await api.get("/friend-requests/pending");
      setRequests(response.data);
    } catch (error) {
      console.log("Error loading pending requests:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleAction = async (friendshipId: number, action: "accept" | "reject") => {
    // Optimistic UI update: remove row immediately
    setRequests(prev => prev.filter(r => r.friendship_id !== friendshipId));

    try {
      await api.put("/friend-request", {
        friendship_id: friendshipId,
        action: action
      });
      Alert.alert("Success", `Friend request ${action}ed successfully!`);
    } catch (error) {
      Alert.alert("Error", `Could not ${action} friend request.`);
      // Rollback: re-fetch from backend
      fetchRequests();
    }
  };

  const renderRequestItem = ({ item }: { item: PendingFriendRequest }) => (
    <View style={styles.requestCard}>
      <View style={styles.userInfo}>
        <Image
          source={{ uri: item.profile_pic || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150" }}
          style={styles.avatar}
        />
        <View style={styles.userDetails}>
          <Text style={styles.username}>@{item.username}</Text>
          <Text style={styles.requestSubtext}>Sent you a friend request</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {/* Reject Button */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.btnReject]}
          onPress={() => handleAction(item.friendship_id, "reject")}
        >
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Accept Button */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.btnAccept]}
          onPress={() => handleAction(item.friendship_id, "accept")}
        >
          <Text style={styles.btnAcceptText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.friendship_id.toString()}
          renderItem={renderRequestItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="mail-open-outline" size={48} color={COLORS.cardBackground} />
              <Text style={styles.emptyText}>No pending friend requests.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.lg,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: SPACING.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userDetails: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  username: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  requestSubtext: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  btnReject: {
    width: 38,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnAccept: {
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
  },
  btnAcceptText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.surface,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 120,
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 16,
    textAlign: "center",
  },
});
