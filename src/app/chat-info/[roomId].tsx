import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Alert,
  Linking,
  Platform,
  FlatList
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootState } from '../../redux/store';
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from '../../theme/theme';
import { updateBlockStatus } from '../../redux/chatSlice';
import api from '../../services/api';

export default function ChatInfoScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const parsedRoomId = parseInt(roomId);

  const chatState = useSelector((state: RootState) => state.chat);
  const roomDetail = chatState.rooms.find(r => r.id === parsedRoomId);
  const messages = chatState.messages[parsedRoomId] || [];

  const isDirect = roomDetail?.type === "direct";
  
  const capitalizeFirstLetter = (str?: string) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const titleName = isDirect 
    ? capitalizeFirstLetter(roomDetail?.name) 
    : (roomDetail?.name || `Chat Room #${parsedRoomId}`);
  const profilePic = isDirect && roomDetail?.other_user_profile_pic 
    ? roomDetail.other_user_profile_pic 
    : "https://cdn-icons-png.flaticon.com/512/149/149071.png"; // Fallback/default group pic

  // Extract Media (Images)
  const mediaMessages = useMemo(() => {
    return messages.filter(m => m.type === "image" || (m.image_url && m.image_url.trim() !== ""));
  }, [messages]);

  // Extract Links
  const linkMessages = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return messages.filter(m => m.content && m.content.match(urlRegex));
  }, [messages]);

  const handleReport = () => {
    Alert.alert(
      "Report Chat",
      "Are you sure you want to report this chat for inappropriate content?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Report", 
          style: "destructive",
          onPress: () => Alert.alert("Reported", "Thank you, our team will review this chat.")
        }
      ]
    );
  };
  const handleExitGroup = () => {
    Alert.alert(
      "Exit Group",
      "Are you sure you want to exit this group chat? You will no longer be able to send or receive messages in this group.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Exit", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/chat/exit/${parsedRoomId}`);
              Alert.alert("Success", "You have exited the group successfully.");
              router.replace("/(tabs)/chat");
            } catch (error) {
              Alert.alert("Error", "Failed to exit group.");
            }
          }
        }
      ]
    );
  };

  const handleBlock = () => {
    if (!roomDetail?.other_user_id) return;
    Alert.alert(
      "Block User",
      `Are you sure you want to block ${titleName}? You will no longer receive messages from them.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Block", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.post(`/user/block/${roomDetail.other_user_id}`);
              dispatch(updateBlockStatus({
                roomId: parsedRoomId,
                blocked_by_me: true,
                has_blocked_me: false
              }));
              Alert.alert("Blocked", "User has been blocked successfully.");
              router.back();
            } catch (error) {
              Alert.alert("Error", "Failed to block user.");
            }
          }
        }
      ]
    );
  };

  const handleUnblock = () => {
    if (!roomDetail?.other_user_id) return;
    Alert.alert(
      "Unblock User",
      `Are you sure you want to unblock ${titleName}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Unblock", 
          onPress: async () => {
            try {
              await api.post(`/user/unblock/${roomDetail.other_user_id}`);
              dispatch(updateBlockStatus({
                roomId: parsedRoomId,
                blocked_by_me: false,
                has_blocked_me: false
              }));
              Alert.alert("Unblocked", "User has been unblocked successfully.");
              router.back();
            } catch (error) {
              Alert.alert("Error", "Failed to unblock user.");
            }
          }
        }
      ]
    );
  };

  const handleOpenLink = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = text.match(urlRegex);
    if (match && match[0]) {
      Linking.openURL(match[0]).catch(() => {
        Alert.alert("Error", "Could not open this link.");
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Info</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <Image source={{ uri: profilePic }} style={styles.profileAvatar} />
            <Text style={styles.profileName}>{titleName}</Text>
            {isDirect && (
              <Text style={styles.profileSubtitle}>Direct Message</Text>
            )}
            
            {isDirect && roomDetail?.other_user_id && (
              <TouchableOpacity 
                style={styles.viewProfileBtn}
                onPress={() => router.push({ pathname: "/user-profile", params: { userId: roomDetail.other_user_id } })}
              >
                <Ionicons name="person-outline" size={16} color={COLORS.surface} style={{ marginRight: 6 }} />
                <Text style={styles.viewProfileBtnText}>View Full Profile</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Media Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Shared Media ({mediaMessages.length})</Text>
            </View>
            
            {mediaMessages.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
                {mediaMessages.map((msg, idx) => (
                  <View key={idx} style={styles.mediaItem}>
                    <Image source={{ uri: msg.image_url }} style={styles.mediaImage} />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>No media shared yet.</Text>
            )}
          </View>

          {/* Links Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Shared Links ({linkMessages.length})</Text>
            </View>
            
            {linkMessages.length > 0 ? (
              <View style={styles.linksList}>
                {linkMessages.map((msg, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={styles.linkItem}
                    onPress={() => handleOpenLink(msg.content)}
                  >
                    <View style={styles.linkIconContainer}>
                      <Ionicons name="link-outline" size={20} color={COLORS.primary} />
                    </View>
                    <Text style={styles.linkText} numberOfLines={1}>
                      {msg.content}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No links shared yet.</Text>
            )}
          </View>

          {/* Actions Section */}
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleReport}>
              <Ionicons name="flag-outline" size={20} color={COLORS.error} />
              <Text style={[styles.actionBtnText, { color: COLORS.error }]}>Report Chat</Text>
            </TouchableOpacity>

            {!isDirect && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleExitGroup}>
                <Ionicons name="exit-outline" size={20} color={COLORS.error} />
                <Text style={[styles.actionBtnText, { color: COLORS.error }]}>Exit Group</Text>
              </TouchableOpacity>
            )}

            {isDirect && (
              roomDetail?.blocked_by_me ? (
                <TouchableOpacity style={styles.actionBtn} onPress={handleUnblock}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.primary} />
                  <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Unblock User</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.actionBtn} onPress={handleBlock}>
                  <Ionicons name="ban-outline" size={20} color={COLORS.error} />
                  <Text style={[styles.actionBtnText, { color: COLORS.error }]}>Block User</Text>
                </TouchableOpacity>
              )
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
  },
  backBtn: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.surface,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.cardBackground,
  },
  profileName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 20,
    color: COLORS.textPrimary,
  },
  profileSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: SPACING.sm,
  },
  viewProfileBtnText: {
    fontFamily: "Poppins_500Medium",
    color: COLORS.surface,
    fontSize: 14,
  },
  sectionContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  sectionHeader: {
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  mediaScroll: {
    flexDirection: 'row',
  },
  mediaItem: {
    width: 100,
    height: 100,
    borderRadius: SPACING.sm,
    marginRight: SPACING.sm,
    overflow: 'hidden',
    backgroundColor: COLORS.cardBackground,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  linksList: {
    gap: SPACING.sm,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  linkIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  linkText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.primary,
    flex: 1,
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  actionsSection: {
    backgroundColor: COLORS.surface,
    borderRadius: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.soft,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    marginLeft: SPACING.sm,
  },
});
