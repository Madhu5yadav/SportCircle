import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Share,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { COLORS, SHADOWS, SPACING } from '../theme/theme';
import api from '../services/api';

export interface ShareData {
  type: 'profile' | 'game' | 'venue';
  id: number;
  title: string;
}

interface ShareModalProps {
  isVisible: boolean;
  onClose: () => void;
  shareData: ShareData | null;
}

export default function ShareModal({ isVisible, onClose, shareData }: ShareModalProps) {
  const friends = useSelector((state: RootState) => state.friend.friends);
  const [sharingTo, setSharingTo] = useState<number | null>(null);

  if (!shareData) return null;

  const getUrl = () => {
    switch (shareData.type) {
      case 'profile': return `https://sportcircle.app/profile/${shareData.id}`;
      case 'game': return `https://sportcircle.app/game/${shareData.id}`;
      case 'venue': return `https://sportcircle.app/venue/${shareData.id}`;
      default: return `https://sportcircle.app`;
    }
  };

  const handleExternalShare = async () => {
    try {
      await Share.share({
        message: `Check out this ${shareData.type} on SportCircle! ${getUrl()}`,
      });
      onClose();
    } catch (error: any) {
      Alert.alert('Error sharing', error.message);
    }
  };

  const handleShareToFriend = async (friendId: number) => {
    try {
      setSharingTo(friendId);
      // 1. Get or create direct chat room
      const roomRes = await api.post(`/chat/direct/${friendId}`);
      const roomId = roomRes.data.id;
      
      // 2. Post a message to the room with the shared item
      await api.post(`/chat?room_id=${roomId}`, {
        type: `shared_${shareData.type}`,
        content: JSON.stringify({
          id: shareData.id,
          title: shareData.title
        })
      });
      
      Alert.alert('Success', 'Shared successfully!');
      onClose();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not share to this friend.');
    } finally {
      setSharingTo(null);
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.contentContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Share {shareData.type}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.externalShareBtn} onPress={handleExternalShare}>
            <Ionicons name="share-social-outline" size={24} color={COLORS.primary} />
            <Text style={styles.externalShareText}>Share via other apps...</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.subTitle}>Send in SportCircle</Text>
          
          {friends.length === 0 ? (
            <Text style={styles.noFriendsText}>You have no friends yet.</Text>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.friend_id.toString()}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.friendRow}>
                  <View style={styles.friendInfo}>
                    <Image
                      source={{ uri: item.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }}
                      style={styles.avatar}
                    />
                    <Text style={styles.friendName}>@{item.username}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={() => handleShareToFriend(item.friend_id)}
                    disabled={sharingTo === item.friend_id}
                  >
                    {sharingTo === item.friend_id ? (
                      <ActivityIndicator size="small" color={COLORS.surface} />
                    ) : (
                      <Text style={styles.sendBtnText}>Send</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  contentContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    maxHeight: '80%',
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: COLORS.textPrimary,
    textTransform: 'capitalize',
  },
  closeBtn: {
    padding: 4,
  },
  externalShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  externalShareText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: COLORS.primary,
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  subTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  noFriendsText: {
    fontFamily: 'Poppins_400Regular',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
  friendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  friendName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  sendBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  sendBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: COLORS.surface,
  },
});
