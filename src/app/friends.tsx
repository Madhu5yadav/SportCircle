import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { setFriends, setPendingRequests, setSquads } from "../redux/friendSlice";
import { RootState } from "../redux/store";
import api from "../services/api";
import { COLORS, SHADOWS, SPACING } from "../theme/theme";

interface Friend {
  friendship_id: number;
  friend_id: number;
  username: string;
  mobile: string;
  profile_pic?: string;
  status: string;
  created_at: string;
}

interface SquadMember {
  user_id: number;
  username: string;
  profile_pic?: string;
  role: "leader" | "member";
  status?: string;
  joined_at: string;
}

interface Squad {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
  members: SquadMember[];
}

export default function FriendsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  const auth = useSelector((state: RootState) => state.auth);
  const friendState = useSelector((state: RootState) => state.friend);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSquad, setActiveSquad] = useState<Squad | null>(null);

  // Bottom action sheet for leader controls
  const [selectedMember, setSelectedMember] = useState<SquadMember | null>(null);
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    try {
      // 1. Fetch friends
      const friendsRes = await api.get("/friends");
      dispatch(setFriends(friendsRes.data));

      // 2. Fetch pending requests to get count
      const requestsRes = await api.get("/friend-requests/pending");
      dispatch(setPendingRequests(requestsRes.data));

      // 3. Fetch squads
      const squadsRes = await api.get("/squads");
      dispatch(setSquads(squadsRes.data));

      // Resolve active squad session
      const acceptedSquads = (squadsRes.data || []).filter((sq: any) => {
        const selfMember = sq.members.find((m: any) => m.user_id === auth.user?.id);
        return selfMember && selfMember.status === "accepted";
      });

      // Resolve owned squad and check if it contains other members
      const ownedSquad = acceptedSquads.find((sq: any) => sq.created_by === auth.user?.id);
      const hasOtherMembers = ownedSquad && ownedSquad.members.some((m: any) => m.user_id !== auth.user?.id);
      
      const joinedSquads = acceptedSquads.filter((sq: any) => sq.created_by !== auth.user?.id);
      
      if (ownedSquad && hasOtherMembers) {
        setActiveSquad(ownedSquad);
      } else if (joinedSquads.length > 0) {
        setActiveSquad(joinedSquads[0]);
      } else if (ownedSquad) {
        setActiveSquad(ownedSquad);
      } else {
        await autoCreateSquad();
      }
    } catch (err) {
      console.log("Error loading friends screen data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const autoCreateSquad = async () => {
    try {
      const username = auth.user?.username || "My";
      const response = await api.post("/create-squad", {
        name: `${username}'s Squad`,
        member_ids: []
      });
      setActiveSquad(response.data);
      // Refresh list of squads in Redux
      const squadsRes = await api.get("/squads");
      dispatch(setSquads(squadsRes.data));
    } catch (err) {
      console.log("Error auto-creating squad session:", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Invite Friend to Squad
  const handleInviteToSquad = async (friendId: number) => {
    if (!activeSquad) return;
    try {
      const res = await api.post(`/add-squad-member/${activeSquad.id}`, { user_id: friendId });
      const msg = res.data?.message || "Friend added to squad successfully!";
      Alert.alert("Success", msg);
      loadData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Could not invite friend to squad.";
      Alert.alert("Invitation Failed", errorMsg);
    }
  };

  const handleResendInvitationPrompt = (friendId: number, username: string) => {
    Alert.alert(
      "Resend Invitation?",
      `Do you want to resend the squad invitation to @${username}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resend",
          onPress: () => handleInviteToSquad(friendId)
        }
      ]
    );
  };

  // Leave / Disband Squad
  const handleSquadLeaveOrDisband = async () => {
    if (!activeSquad) return;
    const isLeader = activeSquad.created_by === auth.user?.id;

    Alert.alert(
      isLeader ? "Disband Squad" : "Leave Squad",
      isLeader
        ? "Are you sure you want to disband this squad? All members will be removed."
        : "Are you sure you want to leave this squad?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isLeader ? "Disband" : "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              if (isLeader) {
                // Remove all members first, then leave/delete
                await api.post(`/squad/remove-all/${activeSquad.id}`);
                await api.delete(`/leave-squad/${activeSquad.id}`);
              } else {
                await api.delete(`/leave-squad/${activeSquad.id}`);
              }
              setActiveSquad(null);
              // Trigger reload, which will recreate a clean personal squad if none remaining
              loadData();
            } catch (err) {
              Alert.alert("Error", "Action failed.");
            }
          }
        }
      ]
    );
  };

  // Long press squad member triggers menu
  const handleSquadMemberLongPress = (member: SquadMember) => {
    // Only squad leader can trigger actions on OTHER members
    const isLeader = activeSquad?.created_by === auth.user?.id;
    const isSelf = member.user_id === auth.user?.id;

    if (isLeader && !isSelf) {
      setSelectedMember(member);
      setShowMemberMenu(true);
    }
  };

  // Promote Member to Leader
  const handleMakeLeader = async () => {
    if (!activeSquad || !selectedMember) return;
    setShowMemberMenu(false);

    Alert.alert(
      "Make Leader",
      `Are you sure you want to make @${selectedMember.username} the squad leader? You will be demoted to a regular member.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Promote",
          onPress: async () => {
            try {
              await api.put(`/squad/make-leader/${activeSquad.id}/${selectedMember.user_id}`);
              Alert.alert("Success", `@${selectedMember.username} is now the squad leader!`);
              loadData();
            } catch (err) {
              Alert.alert("Error", "Could not transfer leadership.");
            }
          }
        }
      ]
    );
  };

  // Remove Member from Squad
  const handleRemoveFromSquad = async () => {
    if (!activeSquad || !selectedMember) return;
    setShowMemberMenu(false);

    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove @${selectedMember.username} from the squad?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/remove-squad-member/${activeSquad.id}/${selectedMember.user_id}`);
              Alert.alert("Success", "Member removed.");
              loadData();
            } catch (err) {
              Alert.alert("Error", "Could not remove member.");
            }
          }
        }
      ]
    );
  };

  // Render friends search input
  const renderSearchBar = () => (
    <View style={styles.searchBarContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends"
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
    </View>
  );

  // Render pending Requests card
  const renderPendingCard = () => {
    const pendingCount = friendState.pendingRequests.length;
    if (pendingCount === 0) return null;

    return (
      <TouchableOpacity
        style={styles.pendingCard}
        onPress={() => router.push("/pending-requests")}
      >
        <View style={styles.pendingLeft}>
          <Text style={styles.pendingText}>Pending friend requests</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
      </TouchableOpacity>
    );
  };

  // Render squad section
  const renderSquadSection = () => {
    if (!activeSquad) return null;
    const isLeader = activeSquad.created_by === auth.user?.id;

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Squad</Text>
          <TouchableOpacity
            style={[styles.outlineBtn, { borderColor: COLORS.error }]}
            onPress={handleSquadLeaveOrDisband}
          >
            <Text style={[styles.outlineBtnText, { color: COLORS.error }]}>
              {isLeader ? "Disband squad" : "Leave squad"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Squad Members */}
        <View style={styles.squadCard}>
          {activeSquad.members.filter(m => m.role === "leader" || m.status === "accepted").map((member) => {
            const memberIsLeader = member.role === "leader";
            const isSelf = member.user_id === auth.user?.id;

            return (
              <TouchableOpacity
                key={member.user_id}
                style={styles.squadMemberRow}
                onPress={() => {
                  if (isSelf) {
                    router.push("/(tabs)/profile");
                  } else {
                    router.push({ pathname: "/user-profile", params: { userId: member.user_id } });
                  }
                }}
                onLongPress={() => handleSquadMemberLongPress(member)}
                delayLongPress={300}
                activeOpacity={0.7}
              >
                <View style={styles.squadMemberLeft}>
                  <Image
                    source={{ uri: member.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }}
                    style={styles.squadAvatar}
                  />
                  <Text style={styles.squadMemberName}>
                    {isSelf ? "You" : `@${member.username}`}
                  </Text>
                </View>
                {memberIsLeader && (
                  <View style={styles.leaderBadge}>
                    <Text style={styles.leaderBadgeText}>Leader</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Action Buttons below Squad */}
        <View style={styles.squadActions}>
          <TouchableOpacity
            style={[styles.squadBtn, styles.btnHost]}
            onPress={() => router.push("/host-game")}
          >
            <Text style={styles.hostBtnText}>Host game</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.squadBtn, styles.btnJoin]}
            onPress={() => router.push("/join-game")}
          >
            <Text style={styles.joinBtnText}>Join game</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const filteredFriends = friendState.friends.filter((friend) => 
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFriendSquadStatus = (friendId: number) => {
    if (!activeSquad) return null;
    const member = activeSquad.members.find(m => m.user_id === friendId);
    return member ? member.status : null;
  };

  // Render Friends List
  const renderFriendsList = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Your friends</Text>

      {filteredFriends.length === 0 ? (
        <View style={styles.emptyFriendsCard}>
          <Ionicons name="people-outline" size={40} color={COLORS.cardBackground} />
          <Text style={styles.emptyFriendsText}>No friends found.</Text>
        </View>
      ) : (
        <View style={styles.friendsCard}>
          {filteredFriends.map((friend, index) => {
            const squadStatus = getFriendSquadStatus(friend.friend_id);
            // Simulated online indicator (even index is online, odd is offline)
            const isOnline = index % 2 === 0;

            return (
              <View
                key={friend.friend_id}
                style={[
                  styles.friendRow,
                  index === filteredFriends.length - 1 ? { borderBottomWidth: 0 } : null
                ]}
              >
                <TouchableOpacity 
                  style={styles.friendInfo}
                  onPress={() => router.push({ pathname: "/user-profile", params: { userId: friend.friend_id } })}
                >
                  <View>
                    <Image
                      source={{ uri: friend.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }}
                      style={styles.friendAvatar}
                    />
                    {isOnline && <View style={styles.onlineDot} />}
                  </View>
                  <Text style={styles.friendName}>@{friend.username}</Text>
                </TouchableOpacity>

                {squadStatus === "accepted" && (
                  <View style={styles.inSquadBadge}>
                    <Text style={styles.inSquadText}>In Squad</Text>
                  </View>
                )}

                {squadStatus === "pending" && (
                  <TouchableOpacity
                    style={[styles.inSquadBadge, { backgroundColor: "#FFE0B2", borderWidth: 1, borderColor: "#FFB74D" }]}
                    onPress={() => handleResendInvitationPrompt(friend.friend_id, friend.username)}
                  >
                    <Text style={[styles.inSquadText, { color: "#FB8C00" }]}>Pending</Text>
                  </TouchableOpacity>
                )}

                {squadStatus === null && (
                  <TouchableOpacity
                    style={styles.inviteIconBtn}
                    onPress={() => handleInviteToSquad(friend.friend_id)}
                  >
                    <Ionicons name="add" size={22} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <>
            {renderPendingCard()}
            {renderSquadSection()}
            {renderSearchBar()}
            {renderFriendsList()}
          </>
        )}
      </ScrollView>

      {/* LEADER ACTIONS BOTTOM MODAL */}
      <Modal visible={showMemberMenu} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalBg}
          activeOpacity={1}
          onPress={() => setShowMemberMenu(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage @{selectedMember?.username}</Text>
              <TouchableOpacity onPress={() => setShowMemberMenu(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.menuItem} onPress={handleMakeLeader}>
              <Ionicons name="ribbon-outline" size={22} color={COLORS.primary} style={styles.menuIcon} />
              <Text style={styles.menuItemText}>Make Leader</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleRemoveFromSquad}>
              <Ionicons name="trash-outline" size={22} color={COLORS.error} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: COLORS.error }]}>Remove from Squad</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 300,
  },
  searchBarContainer: {
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    height: 48,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchPlaceholder: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    padding: 0,
    height: "100%",
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.cardBackground + "40", // Transparent card background
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  pendingLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  pendingText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  badge: {
    backgroundColor: COLORS.primary + "15",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.primary,
  },
  sectionContainer: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  outlineBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  outlineBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
  },
  squadCard: {
    backgroundColor: COLORS.cardBackground + "30", // Translucent card background
    borderRadius: 24,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  squadMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  squadMemberLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  squadAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  squadMemberName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginLeft: 10,
  },
  leaderBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  leaderBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 9,
    color: COLORS.surface,
  },
  squadActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: SPACING.md,
  },
  squadBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.soft,
  },
  btnHost: {
    backgroundColor: COLORS.primary,
  },
  hostBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.surface,
  },
  btnJoin: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  joinBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
  },
  emptyFriendsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  emptyFriendsText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  friendsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  friendName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
    marginLeft: 12,
  },
  inSquadBadge: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  inSquadText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  inviteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(26,26,26,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: 40,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.background,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuItemText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  inviteSquadCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  inviteSquadInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  inviteSquadName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  inviteSquadSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  inviteSquadActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
    paddingTop: 12,
  },
  inviteActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 80,
    alignItems: "center",
  },
  acceptInviteBtn: {
    backgroundColor: COLORS.primary,
  },
  acceptInviteBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.surface,
  },
  rejectInviteBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.error,
  },
  rejectInviteBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.error,
  },
});
