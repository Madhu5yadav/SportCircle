import { Stack } from 'expo-router';
import { COLORS } from '../../../theme/theme';

export default function ChatLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{
          title: "My Group Chats",
          headerStyle: {
            backgroundColor: COLORS.primary,
            borderBottomWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTitleStyle: {
            fontFamily: "Poppins_600SemiBold",
            fontSize: 18,
            color: COLORS.surface,
          },
          headerTintColor: COLORS.surface,
        }} 
      />
      <Stack.Screen name="[roomId]" options={{ headerShown: false }} />
    </Stack>
  );
}
