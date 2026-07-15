import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from '../theme/theme';

interface BlockedUser {
  id: number;
  blocked_id: number;
  blocked_user: {
    id: number;
    username: string;
    profile_pic: string;
    first_name: string;
    last_name: string;
  };
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlockedUsers = async () => {
    try {
      const response = await api.get('/user/blocks');
      setBlockedUsers(response.data);
    } catch (error) {
      console.log('Error fetching blocked users:', error);
      Alert.alert('Error', 'Failed to load blocked users list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const handleUnblock = (userId: number, username: string) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await api.post(`/user/unblock/${userId}`);
              Alert.alert('Success', `${username} has been unblocked.`);
              setBlockedUsers(prev => prev.filter(item => item.blocked_id !== userId));
            } catch (error) {
              Alert.alert('Error', 'Failed to unblock user.');
            }
          }
        }
      ]
    );
  };

  const capitalizeFirstLetter = (str?: string) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked Users</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="ban" size={48} color={COLORS.cardBackground} />
                <Text style={styles.emptyText}>No blocked users.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.userCard}>
                <Image
                  source={{ uri: item.blocked_user.profile_pic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }}
                  style={styles.avatar}
                />
                <View style={styles.userInfo}>
                  <Text style={styles.username}>
                    {capitalizeFirstLetter(item.blocked_user.username)}
                  </Text>
                  {item.blocked_user.first_name ? (
                    <Text style={styles.fullName}>
                      {item.blocked_user.first_name} {item.blocked_user.last_name}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.unblockBtn}
                  onPress={() => handleUnblock(item.blocked_id, item.blocked_user.username)}
                >
                  <Text style={styles.unblockText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
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
  listContent: {
    padding: SPACING.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.cardBackground,
  },
  userInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  username: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  fullName: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  unblockBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  unblockText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: COLORS.primary,
  },
});
