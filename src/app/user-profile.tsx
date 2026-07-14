import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../theme/theme";
import api from "../services/api";

interface PublicUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
  gender?: string;
  about?: string;
  profile_pic?: string;
  trust_score?: number;
  ratings_count?: number;
  created_at: string;
}

interface PublicProfile {
  user: PublicUser;
  preferred_sports: string[];
  playing_time: string[];
  friendship_status: "none" | "pending_sent" | "pending_received" | "accepted" | "self";
  friendship_id?: number;
  mutual_friends_count: number;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const targetUserId = parseInt(userId);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [squads, setSquads] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  const handleRatePlayer = async () => {
    if (tempRating < 1 || tempRating > 5) {
      Alert.alert("Rating Required", "Please select a rating between 1 and 5 stars.");
      return;
    }

    setSubmittingRating(true);
    try {
      await api.post(`/profile/${targetUserId}/rate`, {
        rating: tempRating,
      });
      Alert.alert("Thank you!", "Your rating has been submitted successfully.");
      setShowRateModal(false);
      setTempRating(0);
      fetchProfileAndSquads();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Failed to submit rating. Please try again.";
      Alert.alert("Error", errorMsg);
    } finally {
      setSubmittingRating(false);
    }
  };

  const fetchProfileAndSquads = async () => {
    setLoading(true);
    try {
      // 1. Fetch public profile
      const profileRes = await api.get(`/profile/${targetUserId}`);
      setProfile(profileRes.data);

      // 2. Fetch squads (only if they are friends, to see if we can invite them)
      if (profileRes.data.friendship_status === "accepted") {
        const squadsRes = await api.get("/squads");
        setSquads(squadsRes.data || []);
      }
    } catch (err) {
      console.log("Error loading public profile:", err);
      Alert.alert("Error", "Could not load user profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetUserId) {
      fetchProfileAndSquads();
    }
  }, [targetUserId]);

  const handleAddFriend = async () => {
    setActionLoading(true);
    try {
      await api.post("/friend-request", { friend_id: targetUserId });
      Alert.alert("Success", "Friend request sent!");
      fetchProfileAndSquads();
    } catch (err) {
      Alert.alert("Error", "Could not send friend request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!profile?.friendship_id) return;
    setActionLoading(true);
    try {
      await api.put("/friend-request", {
        friendship_id: profile.friendship_id,
        action: "accept",
      });
      Alert.alert("Success", "Friend request accepted!");
      fetchProfileAndSquads();
    } catch (err) {
      Alert.alert("Error", "Could not accept request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    Alert.alert(
      "Remove Friend",
      `Are you sure you want to remove @${profile?.user.username} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.delete(`/friend/remove/${targetUserId}`);
              Alert.alert("Removed", "Friend removed successfully.");
              fetchProfileAndSquads();
            } catch (err) {
              Alert.alert("Error", "Could not remove friend.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleInviteToSquad = async () => {
    if (squads.length === 0) {
      Alert.alert("No Squad", "You do not have any squad to invite friends to.");
      return;
    }

    const activeSquad = squads[0]; // Invite to first active squad
    setActionLoading(true);
    try {
      await api.post(`/add-squad-member/${activeSquad.id}`, { user_id: targetUserId });
      Alert.alert("Success", `Successfully added to ${activeSquad.name}!`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Could not invite to squad.";
      Alert.alert("Invitation Failed", errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const getSportIcon = (sport: string) => {
    switch (sport.toLowerCase()) {
      case "football": return "soccer";
      case "basketball": return "basketball";
      case "badminton": return "badminton";
      case "cricket": return "cricket";
      case "volleyball": return "volleyball";
      default: return "sports-club";
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity style={styles.backBtnText} onPress={() => router.back()}>
          <Text style={{ color: COLORS.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { user, preferred_sports, playing_time, friendship_status, mutual_friends_count } = profile;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

  return (
    <View style={styles.container}>
      {/* 1. Curved Blue Top Header */}
      <View style={[styles.headerTop, { height: 60 + insets.top, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{user.username}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Background color header fill */}
        <View style={styles.headerBackground} />

        {/* 2. Profile Card */}
        <View style={styles.profileCard}>
          <Image
            source={{ uri: user.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }}
            style={styles.avatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.fullName}>{fullName || `@${user.username}`}</Text>
            {user.gender ? <Text style={styles.infoText}>{user.gender}</Text> : null}
            <Text style={styles.bioText}>
              {user.about || "This player is ready for action! Invite them to hosted games."}
            </Text>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsCard}>
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>Mutual Friends</Text>
              <Text style={styles.statVal}>{mutual_friends_count}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>Trust Score</Text>
              <View style={styles.statValueRow}>
                <Ionicons name="star" size={16} color="#FFD700" style={{ marginRight: 4 }} />
                <Text style={styles.statVal}>
                  {user.trust_score && user.trust_score > 0
                    ? (user.trust_score % 1 === 0 ? user.trust_score.toString() : user.trust_score.toFixed(1))
                    : "0"}
                  /5
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Action Buttons Section */}
        <View style={styles.actionsContainer}>
          {actionLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
          ) : (
            <>
              {/* Friendship Button */}
              {friendship_status === "none" && (
                <TouchableOpacity style={[styles.actionBtn, styles.btnPrimary]} onPress={handleAddFriend}>
                  <Ionicons name="person-add-outline" size={20} color={COLORS.surface} />
                  <Text style={styles.actionBtnText}>Add Friend</Text>
                </TouchableOpacity>
              )}

              {friendship_status === "pending_sent" && (
                <View style={[styles.actionBtn, styles.btnDisabled]}>
                  <Ionicons name="time-outline" size={20} color={COLORS.textSecondary} />
                  <Text style={styles.actionBtnTextDisabled}>Friend Request Sent</Text>
                </View>
              )}

              {friendship_status === "pending_received" && (
                <TouchableOpacity style={[styles.actionBtn, styles.btnSuccess]} onPress={handleAcceptRequest}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.surface} />
                  <Text style={styles.actionBtnText}>Accept Friend Request</Text>
                </TouchableOpacity>
              )}

              {friendship_status === "accepted" && (
                <View style={styles.acceptedActions}>
                  {squads.length > 0 && (
                    <TouchableOpacity style={[styles.actionBtn, styles.btnPrimary, { marginBottom: 12 }]} onPress={handleInviteToSquad}>
                      <Ionicons name="people-outline" size={20} color={COLORS.surface} />
                      <Text style={styles.actionBtnText}>Invite to Squad</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={[styles.actionBtn, styles.btnOutline]} onPress={handleRemoveFriend}>
                    <Ionicons name="person-remove-outline" size={20} color={COLORS.error} />
                    <Text style={[styles.actionBtnText, { color: COLORS.error }]}>Remove Friend</Text>
                  </TouchableOpacity>
                </View>
              )}

              {friendship_status === "self" && (
                <View style={styles.selfInfo}>
                  <Text style={styles.selfInfoText}>This is your public profile.</Text>
                </View>
              )}

              {/* Rate Player Button */}
              {friendship_status !== "self" && (
                <TouchableOpacity style={[styles.actionBtn, styles.btnRate, { marginTop: 12 }]} onPress={() => setShowRateModal(true)}>
                  <Ionicons name="star-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.rateBtnText}>Rate Player</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Rating Modal */}
        <Modal
          visible={showRateModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowRateModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowRateModal(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalDragHandle} />
              <Text style={styles.modalTitle}>Rate Player</Text>
              <Text style={styles.modalSubtitle}>Rate @{user.username}'s trust score during games</Text>
              
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setTempRating(star)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={star <= tempRating ? "star" : "star-outline"} 
                      size={40} 
                      color={star <= tempRating ? "#FFD700" : COLORS.border} 
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitRatingBtn, submittingRating ? styles.btnDisabled : null]}
                onPress={handleRatePlayer}
                disabled={submittingRating}
              >
                {submittingRating ? (
                  <ActivityIndicator color={COLORS.surface} />
                ) : (
                  <Text style={styles.submitRatingBtnText}>Submit Rating</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 4. Preferred Sports Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Preferred Sports</Text>
          {preferred_sports.length > 0 ? (
            <View style={styles.badgeContainer}>
              {preferred_sports.map((sport, index) => {
                const details = (profile as any).preferred_sports_details?.find((s: any) => s.name === sport);
                const level = details ? details.level : "Beginner";
                const levelColor = level === "Beginner" ? "#4CAF50" : level === "Intermediate" ? "#FF9800" : "#E91E63";
                const letter = level ? level.charAt(0).toUpperCase() : "B";

                return (
                  <View key={index} style={[styles.sportBadge, { position: "relative", paddingLeft: 18 }]}>
                    <View style={[styles.levelCircle, { backgroundColor: levelColor }]}>
                      <Text style={styles.levelCircleText}>{letter}</Text>
                    </View>
                    <MaterialCommunityIcons name={getSportIcon(sport) as any} size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.sportBadgeText}>{sport}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>No preferred sports selected.</Text>
          )}
        </View>

        {/* 5. Preferred Playing Times Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Preferred Playing Times</Text>
          {playing_time.length > 0 ? (
            <View style={styles.badgeContainer}>
              {playing_time.map((time, index) => (
                <View key={index} style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.timeBadgeText}>{time}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No preferred playing times selected.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.error,
    marginBottom: SPACING.md,
  },
  backBtnText: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.surface,
  },
  scrollContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  headerBackground: {
    backgroundColor: COLORS.primary,
    height: 60,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    padding: SPACING.xl,
    alignItems: "center",
    ...SHADOWS.medium,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  userDetails: {
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  fullName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.sizes.xl,
    color: COLORS.textPrimary,
  },
  infoText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bioText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.sm,
    lineHeight: 20,
  },
  statsCard: {
    width: "100%",
    backgroundColor: COLORS.background + "40",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginTop: SPACING.md,
  },
  statColumn: {
    alignItems: "center",
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
  },
  statVal: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.primary,
    marginTop: 2,
  },
  actionsContainer: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  actionBtn: {
    flexDirection: "row",
    height: 52,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOWS.soft,
    width: "100%",
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
  },
  btnSuccess: {
    backgroundColor: COLORS.success,
  },
  btnOutline: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.error,
  },
  btnDisabled: {
    backgroundColor: COLORS.border,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  actionBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.surface,
  },
  actionBtnTextDisabled: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
  },
  acceptedActions: {
    width: "100%",
  },
  selfInfo: {
    alignItems: "center",
    paddingVertical: 12,
  },
  selfInfoText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
  },
  sectionContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  badgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sportBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background + "80",
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sportBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.primary,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background + "80",
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.primary,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
  levelCircle: {
    position: "absolute",
    top: -5,
    left: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  levelCircleText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 8,
    color: "white",
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    height: "80%",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  btnRate: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  rateBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 30,
    paddingTop: SPACING.sm,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  modalDragHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#E4ECFA",
    borderRadius: 2.5,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 15,
  },
  modalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.sizes.xl,
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  modalSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    marginTop: 6,
    paddingHorizontal: SPACING.sm,
  },
  starsContainer: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 20,
  },
  submitRatingBtn: {
    backgroundColor: COLORS.primary,
    width: "100%",
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  submitRatingBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.surface,
  },
});
