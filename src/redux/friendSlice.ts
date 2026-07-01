import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Friend {
  friendship_id: number;
  friend_id: number;
  username: string;
  mobile: string;
  profile_pic?: string;
  status: string;
  created_at: string;
}

export interface SquadMember {
  user_id: number;
  username: string;
  profile_pic?: string;
  role: "leader" | "member";
  joined_at: string;
}

export interface Squad {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
  members: SquadMember[];
}

interface FriendState {
  friends: Friend[];
  pendingRequests: Friend[];
  squads: Squad[];
  isLoading: boolean;
}

const initialState: FriendState = {
  friends: [],
  pendingRequests: [],
  squads: [],
  isLoading: false,
};

const friendSlice = createSlice({
  name: "friend",
  initialState,
  reducers: {
    setFriends: (state, action: PayloadAction<Friend[]>) => {
      state.friends = action.payload;
    },
    setPendingRequests: (state, action: PayloadAction<Friend[]>) => {
      state.pendingRequests = action.payload;
    },
    setSquads: (state, action: PayloadAction<Squad[]>) => {
      state.squads = action.payload;
    },
    removeFriend: (state, action: PayloadAction<number>) => {
      state.friends = state.friends.filter((f) => f.friend_id !== action.payload);
    },
    removePendingRequest: (state, action: PayloadAction<number>) => {
      state.pendingRequests = state.pendingRequests.filter(
        (r) => r.friendship_id !== action.payload
      );
    },
    setFriendLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  setFriends,
  setPendingRequests,
  setSquads,
  removeFriend,
  removePendingRequest,
  setFriendLoading,
} = friendSlice.actions;

export default friendSlice.reducer;
