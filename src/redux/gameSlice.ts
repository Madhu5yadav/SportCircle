import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Participant {
  user_id: number;
  username: string;
  profile_pic?: string;
  joined_at: string;
}

export interface Game {
  id: number;
  host_id: number;
  host_username: string;
  host_profile_pic?: string;
  name: string;
  sport_type: string;
  location: string;
  latitude?: number;
  longitude?: number;
  game_date: string;
  start_time: string;
  end_time: string;
  access: string;
  player_count: number;
  entry_fee: number;
  gender: string;
  equipment_required?: string;
  description?: string;
  created_at: string;
  joined_count: number;
  is_joined?: boolean;
  participants?: Participant[];
}

interface GameState {
  games: Game[];
  selectedGame: Game | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: GameState = {
  games: [],
  selectedGame: null,
  isLoading: false,
  error: null,
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    setGames: (state, action: PayloadAction<Game[]>) => {
      state.games = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    setSelectedGame: (state, action: PayloadAction<Game | null>) => {
      state.selectedGame = action.payload;
    },
    addGame: (state, action: PayloadAction<Game>) => {
      state.games = [action.payload, ...state.games];
    },
    updateGameSlots: (
      state,
      action: PayloadAction<{ gameId: number; joinedCount: number }>
    ) => {
      const { gameId, joinedCount } = action.payload;
      // Update in lists
      const gameIndex = state.games.findIndex((g) => g.id === gameId);
      if (gameIndex !== -1) {
        state.games[gameIndex].joined_count = joinedCount;
      }
      // Update in selected focus
      if (state.selectedGame && state.selectedGame.id === gameId) {
        state.selectedGame.joined_count = joinedCount;
      }
    },
    setGameLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setGameError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const {
  setGames,
  setSelectedGame,
  addGame,
  updateGameSlots,
  setGameLoading,
  setGameError,
} = gameSlice.actions;

export default gameSlice.reducer;
