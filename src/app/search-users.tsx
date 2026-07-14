import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import api from "../services/api";

interface UserSearchResult {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  friendship_status: "none" | "pending_sent" | "pending_received" | "accepted";
  friendship_id?: number;
  mutual_friends_count: number;
}

export default function SearchUsersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.trim().length >= 1) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/search`, { params: { query: query.trim() } });
      setResults(response.data);
    } catch (error) {
      console.log("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (userId: number) => {
    // Optimistic UI update
    setResults(prev =>
      prev.map(u => (u.id === userId ? { ...u, friendship_status: "pending_sent" as const } : u))
    );

    try {
      await api.post("/friend-request", { friend_id: userId });
    } catch (error) {
      Alert.alert("Error", "Could not send friend request. Try again.");
      // Rollback UI update
      setResults(prev =>
        prev.map(u => (u.id === userId ? { ...u, friendship_status: "none" as const } : u))
      );
    }
  };

  const handleAcceptRequest = async (friendshipId: number, userId: number) => {
    // Optimistic UI update
    setResults(prev =>
      prev.map(u => (u.id === userId ? { ...u, friendship_status: "accepted" as const } : u))
    );

    try {
      await api.put("/friend-request", {
        friendship_id: friendshipId,
        action: "accept"
      });
    } catch (error) {
      Alert.alert("Error", "Action failed.");
      // Rollback UI update
      setResults(prev =>
        prev.map(u => (u.id === userId ? { ...u, friendship_status: "pending_received" as const } : u))
      );
    }
  };

  const renderUserItem = ({ item }: { item: UserSearchResult }) => {
    const fullName = [item.first_name, item.last_name].filter(Boolean).join(" ");
    
    return (
      <View style={styles.userCard}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => router.push({ pathname: "/user-profile", params: { userId: item.id } })}
        >
          <Image
            source={{ uri: item.profile_pic || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150" }}
            style={styles.avatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.username}>@{item.username}</Text>
            {fullName ? <Text style={styles.fullName}>{fullName}</Text> : null}
            <Text style={styles.mutualCount}>{item.mutual_friends_count} mutual friends</Text>
          </View>
        </TouchableOpacity>

        {/* Action Button */}
        {item.friendship_status === "none" && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.btnAdd]}
            onPress={() => handleAddFriend(item.id)}
          >
            <Text style={styles.btnAddText}>Add Friend</Text>
          </TouchableOpacity>
        )}

        {item.friendship_status === "pending_sent" && (
          <View style={[styles.actionBtn, styles.btnRequested]}>
            <Text style={styles.btnRequestedText}>Requested</Text>
          </View>
        )}

        {item.friendship_status === "pending_received" && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.btnAccept]}
            onPress={() => item.friendship_id && handleAcceptRequest(item.friendship_id, item.id)}
          >
            <Text style={styles.btnAcceptText}>Accept</Text>
          </TouchableOpacity>
        )}

        {item.friendship_status === "accepted" && (
          <View style={[styles.actionBtn, styles.btnFriends]}>
            <Text style={styles.btnFriendsText}>Friends</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Search Input wrapper */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              placeholder="Search by username"
              placeholderTextColor={COLORS.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results List */}
        {loading && results.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderUserItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              query.trim().length > 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={COLORS.cardBackground} />
                  <Text style={styles.emptyText}>No users found.</Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color={COLORS.cardBackground} />
                  <Text style={styles.emptyText}>Type a username above to search registered players.</Text>
                </View>
              )
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    height: "100%",
  },
  listContent: {
    padding: SPACING.lg,
  },
  userCard: {
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
  fullName: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  mutualCount: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 2,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 90,
  },
  btnAdd: {
    backgroundColor: COLORS.primary,
  },
  btnAddText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.surface,
  },
  btnRequested: {
    backgroundColor: COLORS.border,
  },
  btnRequestedText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  btnAccept: {
    backgroundColor: COLORS.success,
  },
  btnAcceptText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.surface,
  },
  btnFriends: {
    backgroundColor: COLORS.cardBackground,
  },
  btnFriendsText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 16,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
