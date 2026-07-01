import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  ScrollView
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import { RootState } from "../redux/store";
import api from "../services/api";
import { setFriends, setPendingRequests, setSquads, removePendingRequest } from "../redux/friendSlice";

export default function FriendsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{ tab?: string }>();

  const auth = useSelector((state: RootState) => state.auth);
  const friendState = useSelector((state: RootState) => state.friend);

  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "squads">("friends");
  
  // Create Squad states
  const [showCreateSquadModal, setShowCreateSquadModal] = useState(false);
  const [squadName, setSquadName] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [squadLoading, setSquadLoading] = useState(false);

  // Active squad details modal
  const [selectedSquad, setSelectedSquad] = useState<any | null>(null);

  useEffect(() => {
    if (params.tab) {
      setActiveTab(params.tab as any);
    }
  }, [params.tab]);

  const loadData = async () => {
    try {
      // Load friends
      const friendsRes = await api.get("/friends");
      dispatch(setFriends(friendsRes.data));

      // Load pending requests
      const requestsRes = await api.get("/friend-requests/pending");
      dispatch(setPendingRequests(requestsRes.data));

      // Load squads
      const squadsRes = await api.get("/squads");
      dispatch(setSquads(squadsRes.data));
    } catch (err) {
      console.log("Error loading friends screen data:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFriendRequestAction = async (friendshipId: number, action: "accept" | "reject") => {
    try {
      await api.put("/friend-request", {
        friendship_id: friendshipId,
        action
      });
      Alert.alert("Success", `Friend request ${action}ed!`);
      dispatch(removePendingRequest(friendshipId));
      loadData();
    } catch (err) {
      Alert.alert("Error", "Action failed.");
    }
  };

  const handleToggleSelectFriend = (friendId: number) => {
    if (selectedFriendIds.includes(friendId)) {
      setSelectedFriendIds(selectedFriendIds.filter(id => id !== friendId));
    } else {
      setSelectedFriendIds([...selectedFriendIds, friendId]);
    }
  };

  const handleCreateSquad = async () => {
    if (!squadName.trim() || selectedFriendIds.length === 0) {
      Alert.alert("Incomplete Details", "Please enter a squad name and select at least one friend.");
      return;
    }

    setSquadLoading(true);
    try {
      await api.post("/create-squad", {
        name: squadName.trim(),
        member_ids: selectedFriendIds
      });

      Alert.alert("Success", "Squad created successfully!");
      setSquadName("");
      setSelectedFriendIds([]);
      setShowCreateSquadModal(false);
      loadData();
    } catch (err) {
      Alert.alert("Error", "Could not create squad.");
    } finally {
      setSquadLoading(false);
    }
  };

  const handleRemoveMember = async (squadId: number, userId: number, username: string) => {
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove @${username} from the squad?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/remove-squad-member/${squadId}/${userId}`);
              Alert.alert("Success", "Member removed.");
              // Reload squad details
              const res = await api.get("/squads");
              dispatch(setSquads(res.data));
              // Update selected squad view
              const updatedSquad = res.data.find((s: any) => s.id === squadId);
              setSelectedSquad(updatedSquad || null);
            } catch (err) {
              Alert.alert("Error", "Could not remove member.");
            }
          }
        }
      ]
    );
  };

  const handleLeaveSquad = async (squadId: number) => {
    Alert.alert(
      "Leave Squad",
      "Are you sure you want to leave this squad?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/leave-squad/${squadId}`);
              Alert.alert("Success", "You left the squad.");
              setSelectedSquad(null);
              loadData();
            } catch (err) {
              Alert.alert("Error", "Could not leave squad.");
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Sub Tabs bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === "friends" ? styles.tabBtnActive : null]}
          onPress={() => setActiveTab("friends")}
        >
          <Text style={[styles.tabText, activeTab === "friends" ? styles.tabTextActive : null]}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === "requests" ? styles.tabBtnActive : null]}
          onPress={() => setActiveTab("requests")}
        >
          <Text style={[styles.tabText, activeTab === "requests" ? styles.tabTextActive : null]}>
            Requests ({friendState.pendingRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === "squads" ? styles.tabBtnActive : null]}
          onPress={() => setActiveTab("squads")}
        >
          <Text style={[styles.tabText, activeTab === "squads" ? styles.tabTextActive : null]}>Squads</Text>
        </TouchableOpacity>
      </View>

      {/* TAB: FRIENDS */}
      {activeTab === "friends" && (
        <FlatList
          data={friendState.friends}
          keyExtractor={(item) => item.friend_id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={COLORS.cardBackground} />
              <Text style={styles.emptyTitle}>No Friends Yet</Text>
              <Text style={styles.emptySubtitle}>Friends will show up here once they accept your invitation request.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.friendCard}>
              <View style={styles.friendHeader}>
                <Image source={{ uri: item.profile_pic || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150" }} style={styles.avatar} />
                <View style={{ marginLeft: SPACING.md }}>
                  <Text style={styles.friendName}>@{item.username}</Text>
                  <Text style={styles.friendMobile}>{item.mobile}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push(`/(tabs)/chat`)}>
                <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* TAB: PENDING REQUESTS */}
      {activeTab === "requests" && (
        <FlatList
          data={friendState.pendingRequests}
          keyExtractor={(item) => item.friendship_id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="mail-unread-outline" size={48} color={COLORS.cardBackground} />
              <Text style={styles.emptyTitle}>No Pending Requests</Text>
              <Text style={styles.emptySubtitle}>You don't have any incoming friend invitations at the moment.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.requestCard}>
              <View style={styles.friendHeader}>
                <Image source={{ uri: item.profile_pic || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150" }} style={styles.avatar} />
                <View style={{ marginLeft: SPACING.md }}>
                  <Text style={styles.friendName}>@{item.username}</Text>
                  <Text style={styles.friendMobile}>Wants to be friends</Text>
                </View>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.btnReject]}
                  onPress={() => handleFriendRequestAction(item.friendship_id, "reject")}
                >
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.btnAccept]}
                  onPress={() => handleFriendRequestAction(item.friendship_id, "accept")}
                >
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* TAB: SQUADS */}
      {activeTab === "squads" && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={friendState.squads}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={COLORS.cardBackground} />
                <Text style={styles.emptyTitle}>No Squads Joined</Text>
                <Text style={styles.emptySubtitle}>Assemble your dream team by clicking Create Squad below!</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.squadCard} onPress={() => setSelectedSquad(item)}>
                <View>
                  <Text style={styles.squadName}>{item.name}</Text>
                  <Text style={styles.squadCount}>{item.members.length} Squad Members</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity style={styles.createSquadFloat} onPress={() => setShowCreateSquadModal(true)}>
            <Ionicons name="add" size={24} color={COLORS.surface} />
            <Text style={styles.createSquadFloatText}>Create Squad</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SQUAD CREATION MODAL */}
      <Modal visible={showCreateSquadModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assemble Squad</Text>
            
            <Text style={styles.modalLabel}>Squad Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Royal Strikers FC"
              value={squadName}
              onChangeText={setSquadName}
            />

            <Text style={styles.modalLabel}>Select Friends to Invite</Text>
            <ScrollView style={styles.friendChecklist} showsVerticalScrollIndicator={false}>
              {friendState.friends.map((friend) => {
                const isSelected = selectedFriendIds.includes(friend.friend_id);
                return (
                  <TouchableOpacity 
                    key={friend.friend_id} 
                    style={[styles.checklistItem, isSelected ? styles.checklistActive : null]}
                    onPress={() => handleToggleSelectFriend(friend.friend_id)}
                  >
                    <Image source={{ uri: friend.profile_pic || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150" }} style={styles.checklistAvatar} />
                    <Text style={styles.checklistName}>@{friend.username}</Text>
                    <Ionicons 
                      name={isSelected ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={isSelected ? COLORS.primary : COLORS.textSecondary} 
                    />
                  </TouchableOpacity>
                );
              })}
              {friendState.friends.length === 0 && (
                <Text style={styles.noFriendsChecklist}>Add friends first to form a squad!</Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreateSquadModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handleCreateSquad} disabled={squadLoading}>
                {squadLoading ? <ActivityIndicator size="small" color={COLORS.surface} /> : <Text style={styles.submitText}>Form Squad</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SQUAD DETAIL MODAL */}
      <Modal visible={!!selectedSquad} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <View style={styles.rosterHeader}>
              <Text style={styles.modalTitle}>{selectedSquad?.name}</Text>
              <TouchableOpacity onPress={() => setSelectedSquad(null)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              <Text style={styles.modalLabel}>Squad Members</Text>
              {selectedSquad?.members.map((m: any) => {
                const isLeader = m.role === "leader";
                const isSelf = m.user_id === auth.user?.id;
                const isCurrentUserLeader = selectedSquad.created_by === auth.user?.id;

                return (
                  <View key={m.user_id} style={styles.rosterItem}>
                    <View style={styles.rosterItemLeft}>
                      <Image source={{ uri: m.profile_pic || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150" }} style={styles.checklistAvatar} />
                      <Text style={styles.rosterUsername}>@{m.username}</Text>
                      {isLeader && (
                        <View style={styles.leaderBadge}>
                          <Text style={styles.leaderBadgeText}>Squad Leader</Text>
                        </View>
                      )}
                    </View>

                    {/* Controls */}
                    {isCurrentUserLeader && !isSelf && (
                      <TouchableOpacity 
                        style={styles.removeBtn}
                        onPress={() => handleRemoveMember(selectedSquad.id, m.user_id, m.username)}
                      >
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Leave Squad Footer option */}
            <View style={styles.rosterFooter}>
              <TouchableOpacity 
                style={styles.leaveSquadBtn}
                onPress={() => handleLeaveSquad(selectedSquad?.id)}
              >
                <Ionicons name="exit-outline" size={18} color={COLORS.surface} />
                <Text style={styles.leaveSquadText}>Leave Squad</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    elevation: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabBtnActive: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontFamily: "Poppins_600SemiBold",
  },
  listContainer: {
    padding: SPACING.xl,
    paddingBottom: 80,
  },
  friendCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOWS.soft,
  },
  friendHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  friendName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  friendMobile: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  requestCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  requestActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
    paddingTop: 10,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnReject: {
    backgroundColor: COLORS.background,
  },
  btnAccept: {
    backgroundColor: COLORS.primary,
  },
  rejectText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  acceptText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.surface,
  },
  squadCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOWS.soft,
  },
  squadName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  squadCount: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  createSquadFloat: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    ...SHADOWS.medium,
  },
  createSquadFloatText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.surface,
    marginLeft: 4,
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
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  modalLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 8,
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
    marginBottom: 16,
  },
  friendChecklist: {
    maxHeight: 200,
    marginBottom: 16,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
    justifyContent: "space-between",
  },
  checklistActive: {
    backgroundColor: COLORS.background + "20",
  },
  checklistAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  checklistName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    marginLeft: 10,
  },
  noFriendsChecklist: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 20,
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
  rosterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
    marginBottom: 10,
  },
  rosterItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  rosterItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  rosterUsername: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginLeft: 10,
  },
  leaderBadge: {
    backgroundColor: COLORS.primary + "15",
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginLeft: 6,
  },
  leaderBadgeText: {
    fontSize: 9,
    fontFamily: "Poppins_700Bold",
    color: COLORS.primary,
  },
  removeBtn: {
    backgroundColor: COLORS.error + "15",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  removeBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.error,
  },
  rosterFooter: {
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
    paddingTop: 16,
    marginTop: 16,
  },
  leaveSquadBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.error,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  leaveSquadText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.surface,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 100,
  },
  emptyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 40,
  },
});
