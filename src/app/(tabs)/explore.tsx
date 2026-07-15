import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  ScrollView, 
  Alert, 
  Image,
  Modal
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING, SHADOWS, TYPOGRAPHY } from "../../theme/theme";
import { RootState } from "../../redux/store";
import api from "../../services/api";
import { setGames } from "../../redux/gameSlice";

export default function ExploreScreen() {
  const ALL_SPORTS = [
    "Badminton",
    "Basketball",
    "Bowling",
    "Cricket",
    "Football",
    "Golf",
    "Hockey",
    "Kabaddi",
    "Kho Kho",
    "Pickleball",
    "Rugby",
    "Running",
    "Swimming",
    "Table Tennis",
    "Tennis",
    "Volleyball",
    "All"
  ];

  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{ gameId?: string }>();
  const insets = useSafeAreaInsets();
  
  const auth = useSelector((state: RootState) => state.auth);
  const { games } = useSelector((state: RootState) => state.game);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"games" | "players">("games");
  const [selectedSport, setSelectedSport] = useState("All");
  const [maxDistance, setMaxDistance] = useState<number>(1000); // default All distances (1000km)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("All");
  const [activeModal, setActiveModal] = useState<"sport" | "distance" | "time" | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Real users suggestion list (Find Players)
  const [suggestedPlayers, setSuggestedPlayers] = useState<any[]>([]);
  
  // Search results for players
  const [playerSearchResults, setPlayerSearchResults] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const [showGameDetailsModal, setShowGameDetailsModal] = useState(false);

  // Edit game states
  const [isEditingGame, setIsEditingGame] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editPlayerCount, setEditPlayerCount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editEquipment, setEditEquipment] = useState("");
  const [editAccess, setEditAccess] = useState("public");
  const [editGender, setEditGender] = useState("all");

  const startEditingGame = () => {
    if (!selectedGame) return;
    setEditName(selectedGame.name);
    setEditLocation(selectedGame.location);
    setEditPlayerCount(selectedGame.player_count.toString());
    setEditDescription(selectedGame.description || "");
    setEditEquipment(selectedGame.equipment_required || "");
    setEditAccess(selectedGame.access);
    setEditGender(selectedGame.gender);
    setIsEditingGame(true);
  };

  const handleDeleteGame = (gameId: number) => {
    Alert.alert(
      "Cancel Match?",
      "Are you sure you want to cancel and delete this game? This will notify participants and cannot be undone.",
      [
        { text: "Keep Match", style: "cancel" },
        {
          text: "Cancel Match",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/game/${gameId}`);
              Alert.alert("Match Cancelled", "The game has been successfully deleted.");
              setShowGameDetailsModal(false);
              loadGames();
            } catch (err: any) {
              const errM = err.response?.data?.detail || "Could not delete game.";
              Alert.alert("Error", errM);
            }
          }
        }
      ]
    );
  };

  const handleSaveGameEdits = async () => {
    if (!editName.trim() || !editLocation.trim() || !editPlayerCount.trim()) {
      Alert.alert("Required Fields", "Please enter the game title, location, and player capacity.");
      return;
    }
    const cap = parseInt(editPlayerCount);
    if (isNaN(cap) || cap <= 1) {
      Alert.alert("Invalid Capacity", "Capacity must be at least 2.");
      return;
    }
    try {
      const response = await api.put(`/game/${selectedGame.id}`, {
        name: editName.trim(),
        location: editLocation.trim(),
        player_count: cap,
        access: editAccess,
        gender: editGender,
        equipment_required: editEquipment.trim() || null,
        description: editDescription.trim() || null
      });
      Alert.alert("Success", "Game details updated successfully!");
      setSelectedGame(response.data);
      setIsEditingGame(false);
      loadGames();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Could not update game details.";
      Alert.alert("Update Failed", errorMsg);
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

  // Generate 7 days from today
  const getDaysArray = () => {
    const days = [];
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({
        dayName: i === 0 ? "Today" : weekdays[d.getDay()],
        dateNum: d.getDate(),
        fullDateStr: d.toISOString().split("T")[0] // YYYY-MM-DD
      });
    }
    return days;
  };
  const datesList = getDaysArray();

  // Load games from backend
  const loadGames = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (maxDistance !== 1000) {
        params.lat = auth.user?.latitude || 12.9716;
        params.lng = auth.user?.longitude || 77.5946;
        params.max_distance_km = maxDistance;
      }
      const response = await api.get("/games", { params });
      dispatch(setGames(response.data));
    } catch (error) {
      console.log("Error fetching games in explore:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load suggested players
  const loadSuggestedPlayers = async () => {
    try {
      const res = await api.get("/friends", { params: { suggestions: true } });
      setSuggestedPlayers(res.data || []);
    } catch (err) {
      console.log("Error loading suggested players in explore:", err);
    }
  };

  useEffect(() => {
    loadGames();
    loadSuggestedPlayers();
  }, [maxDistance]);

  useEffect(() => {
    if (params.gameId && games.length > 0) {
      const target = games.find((g) => g.id.toString() === params.gameId?.toString());
      if (target) {
        setSelectedGame(target);
        setShowGameDetailsModal(true);
        // Clear param to avoid re-triggering modal on other re-renders
        router.setParams({ gameId: undefined });
      }
    }
  }, [params.gameId, games]);

  // Handle players search input
  useEffect(() => {
    if (searchMode === "players" && searchQuery.trim().length > 0) {
      const delayDebounce = setTimeout(async () => {
        setLoadingPlayers(true);
        try {
          const res = await api.get("/users/search", { params: { query: searchQuery } });
          setPlayerSearchResults(res.data || []);
        } catch (err) {
          console.log("Error searching users:", err);
        } finally {
          setLoadingPlayers(false);
        }
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setPlayerSearchResults([]);
    }
  }, [searchQuery, searchMode]);

  // Handle join or leave game
  const handleJoinLeaveGame = async (gameId: number, isJoined: boolean) => {
    setActionLoading(gameId);
    try {
      if (isJoined) {
        await api.post(`/leave-game/${gameId}`);
        Alert.alert("Success", "You left the game.");
        if (selectedGame && selectedGame.id === gameId) {
          setSelectedGame({
            ...selectedGame,
            is_joined: false,
            joined_count: Math.max(0, selectedGame.joined_count - 1),
            participants: selectedGame.participants.filter((p: any) => p.user_id !== auth.user?.id)
          });
        }
      } else {
        await api.post(`/join-game/${gameId}`);
        Alert.alert("Joined!", "You have successfully joined the game.");
        if (selectedGame && selectedGame.id === gameId) {
          setSelectedGame({
            ...selectedGame,
            is_joined: true,
            joined_count: selectedGame.joined_count + 1,
            participants: [
              ...selectedGame.participants,
              {
                user_id: auth.user?.id,
                username: auth.user?.username,
                profile_pic: auth.user?.profile_pic || null,
                joined_at: new Date().toISOString()
              }
            ]
          });
        }
      }
      await loadGames();
    } catch (error: any) {
      Alert.alert("Failed", error.response?.data?.detail || "Action failed.");
    } finally {
      setActionLoading(null);
    }
  };

  // Filter games based on search query, sport, distance, time slot, and date picker selection
  const filteredGames = games.filter((game) => {
    // Hide past games, except if searching for the specific deep-linked game ID
    const now = new Date();
    let isFuture = true;
    try {
      if (game.game_date && game.start_time) {
        const gameStart = new Date(`${game.game_date}T${game.start_time}`);
        isFuture = gameStart.getTime() > now.getTime();
      }
    } catch (e) {
      isFuture = false;
    }
    const isTargetGame = !!(params.gameId && game.id.toString() === params.gameId.toString());
    if (!isFuture && !isTargetGame) {
      return false;
    }

    // Search query match (name, location, or host_username)
    const matchesSearch = 
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.host_username.toLowerCase().includes(searchQuery.toLowerCase());

    // Sport filter
    const matchesSport = selectedSport === "All" || game.sport_type.toLowerCase() === selectedSport.toLowerCase();

    // Date picker filter
    const matchesDate = !selectedDate || game.game_date === selectedDate;

    // Time slot match
    const getGameSlot = (startTimeStr: string) => {
      const gameHour = parseInt(startTimeStr.split(":")[0]);
      if (5 <= gameHour && gameHour < 12) return "Morning";
      if (12 <= gameHour && gameHour < 17) return "Afternoon";
      if (17 <= gameHour && gameHour < 21) return "Evening";
      return "Night";
    };
    const matchesTime = selectedTimeSlot === "All" || getGameSlot(game.start_time) === selectedTimeSlot;

    return matchesSearch && matchesSport && matchesDate && matchesTime;
  });

  const handleSportFilterPress = () => {
    setActiveModal("sport");
  };

  const handleDistanceFilterPress = () => {
    setActiveModal("distance");
  };

  const handleTimeSlotFilterPress = () => {
    setActiveModal("time");
  };

  // Month header text helper (e.g. "July")
  const currentMonthName = new Date().toLocaleString("default", { month: "long" });

  const renderSearchBarSection = () => (
    <View style={styles.searchBarSection}>
      <View style={styles.searchBarWrapper}>
        <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Find Players and games"
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      {/* Option to search either player or games */}
      <View style={styles.segmentedContainer}>
        <TouchableOpacity 
          style={[styles.segmentedTab, searchMode === "games" ? styles.segmentedTabActive : null]}
          onPress={() => setSearchMode("games")}
        >
          <Text style={[styles.segmentedText, searchMode === "games" ? styles.segmentedTextActive : null]}>Games</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.segmentedTab, searchMode === "players" ? styles.segmentedTabActive : null]}
          onPress={() => setSearchMode("players")}
        >
          <Text style={[styles.segmentedText, searchMode === "players" ? styles.segmentedTextActive : null]}>Players</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFindPlayersList = () => {
    // Determine which list of players to render (either search results or suggestions)
    const isSearching = searchQuery.trim().length > 0 && searchMode === "players";
    const playersList = isSearching ? playerSearchResults : suggestedPlayers;

    if (searchMode === "games" && searchQuery.trim().length > 0) return null;

    return (
      <View style={styles.playersSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isSearching ? "Search Results" : "Find Players"}</Text>
          <TouchableOpacity onPress={() => router.push("/search-users")}>
            <Ionicons name="arrow-forward" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {loadingPlayers ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 20 }} />
        ) : playersList.length > 0 ? (
          <View style={styles.playersCardContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playersScroll}>
              {playersList.map((p) => {
                const uid = p.id || p.friend_id;
                return (
                  <TouchableOpacity 
                    key={uid} 
                    style={styles.playerItem}
                    onPress={() => router.push({ pathname: "/user-profile", params: { userId: uid } })}
                  >
                    <Image 
                      source={{ uri: p.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }} 
                      style={styles.playerAvatar} 
                    />
                    <Text style={styles.playerName} numberOfLines={1}>{p.username}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyPlayersCard}>
            <Text style={styles.emptyPlayersText}>
              {isSearching ? "No matching players found" : "No players suggested"}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderFindGamesSection = () => {
    if (searchMode === "players") return null;

    return (
      <View style={styles.gamesSection}>
        <Text style={styles.sectionTitle}>Find Games</Text>
        
        {/* Month selector */}
        <Text style={styles.monthLabel}>{currentMonthName}</Text>

        {/* Date Selector Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datesScroll}>
          {datesList.map((day) => {
            const isSelected = selectedDate === day.fullDateStr;
            return (
              <TouchableOpacity
                key={day.fullDateStr}
                style={[styles.dateCard, isSelected ? styles.dateCardActive : null]}
                onPress={() => {
                  if (isSelected) {
                    setSelectedDate(datesList[0].fullDateStr); // Reset to today's date by default on deselection
                  } else {
                    setSelectedDate(day.fullDateStr);
                  }
                }}
              >
                <Text style={[styles.dayText, isSelected ? styles.dayTextActive : null]}>{day.dayName}</Text>
                <Text style={[styles.dateNumberText, isSelected ? styles.dateNumberActive : null]}>{day.dateNum}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          <TouchableOpacity style={styles.filterPill} onPress={handleSportFilterPress}>
            <Text style={styles.filterPillText}>Sport: {selectedSport}</Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.textPrimary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterPill} onPress={handleDistanceFilterPress}>
            <Text style={styles.filterPillText}>{maxDistance > 500 ? "Distance: All" : `Distance: ${maxDistance}km`}</Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.textPrimary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterPill} onPress={handleTimeSlotFilterPress}>
            <Text style={styles.filterPillText}>Time: {selectedTimeSlot}</Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.textPrimary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {/* Games List Content */}
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 40 }} />
        ) : filteredGames.length > 0 ? (
          filteredGames.map((game) => {
            const isJoined = game.is_joined;
            const slotsLeft = game.player_count - game.joined_count;
            return (
              <View key={game.id} style={styles.gameCard}>
                <TouchableOpacity
                  style={styles.gameCardLeft}
                  onPress={() => {
                    setSelectedGame(game);
                    setShowGameDetailsModal(true);
                  }}
                >
                  {/* Sport & Slots */}
                  <View style={styles.gameTitleRow}>
                    <Text style={styles.gameSportText}>{game.sport_type}</Text>
                    <Text style={styles.gameSeparator}>-</Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={styles.gameSlotsText}>{game.joined_count}/{game.player_count}</Text>
                      {(game.waiting_count ?? 0) > 0 && (
                        <Text style={{ color: "#4CAF50", fontFamily: "Poppins_600SemiBold", fontSize: 11, marginLeft: 4 }}>
                          ({game.waiting_count} waiting{(game.waiting_count ?? 0) > 1 ? "s" : ""})
                        </Text>
                      )}
                    </View>
                    <Ionicons name="people" size={16} color={COLORS.textPrimary} style={{ marginLeft: 4 }} />
                  </View>
                  
                  {/* Time Row */}
                  <Text style={styles.gameTimeText}>
                    {game.game_date}, {game.start_time.slice(0, 5)} - {game.end_time.slice(0, 5)}
                  </Text>
                  
                  {/* Venue / Location Row */}
                  <View style={styles.gameVenueRow}>
                    <Ionicons name="location" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.gameVenueText} numberOfLines={1}>{game.location}</Text>
                  </View>
                </TouchableOpacity>

                {/* Join button on the right */}
                <TouchableOpacity
                  style={[
                    styles.joinGameBtn,
                    isJoined ? styles.leaveGameBtn : null,
                    actionLoading === game.id ? styles.btnDisabled : null
                  ]}
                  onPress={() => handleJoinLeaveGame(game.id, !!isJoined)}
                  disabled={actionLoading === game.id}
                >
                  {actionLoading === game.id ? (
                    <ActivityIndicator size="small" color={COLORS.surface} />
                  ) : (
                    <Text style={styles.joinGameBtnText}>{isJoined ? "Leave" : "Join"}</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyGamesCard}>
            <Ionicons name="football-outline" size={32} color={COLORS.textSecondary} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyGamesText}>No games available now</Text>
          </View>
        )}
      </View>
    );
  };

  const renderFilterModal = () => {
    return (
      <Modal
        visible={activeModal !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setActiveModal(null)}
        >
          <View style={styles.modalContent}>
            {/* Drag Handle */}
            <View style={styles.modalDragHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeModal === "sport" && "Select Sport"}
                {activeModal === "distance" && "Select Distance Radius"}
                {activeModal === "time" && "Select Time Slot"}
              </Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Options List */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalOptionsContainer}>
              {activeModal === "sport" && ALL_SPORTS.map((sport) => {
                const isSelected = selectedSport === sport;
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[styles.modalOptionItem, isSelected ? styles.modalOptionActive : null]}
                    onPress={() => {
                      setSelectedSport(sport);
                      setSelectedDate(""); // Clear date filter on sport change
                      setActiveModal(null);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected ? styles.modalOptionTextActive : null]}>
                      {sport}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}

              {activeModal === "distance" && [
                { label: "5 km", value: 5 },
                { label: "15 km", value: 15 },
                { label: "30 km", value: 30 },
                { label: "50 km", value: 50 },
                { label: "All distances", value: 1000 }
              ].map((item) => {
                const isSelected = maxDistance === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.modalOptionItem, isSelected ? styles.modalOptionActive : null]}
                    onPress={() => {
                      setMaxDistance(item.value);
                      setActiveModal(null);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected ? styles.modalOptionTextActive : null]}>
                      {item.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}

              {activeModal === "time" && ["Morning", "Afternoon", "Evening", "Night", "All"].map((t) => {
                const isSelected = selectedTimeSlot === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.modalOptionItem, isSelected ? styles.modalOptionActive : null]}
                    onPress={() => {
                      setSelectedTimeSlot(t);
                      setActiveModal(null);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected ? styles.modalOptionTextActive : null]}>
                      {t}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderEditGameForm = () => {
    return (
      <ScrollView showsVerticalScrollIndicator={false} style={{ width: "100%", paddingHorizontal: 5 }}>
        <Text style={[styles.detailsSectionTitle, { marginTop: 10, marginBottom: 15 }]}>Edit Match Details</Text>
        
        {/* Title */}
        <View style={styles.editInputWrapper}>
          <Text style={styles.editLabel}>Game Title *</Text>
          <TextInput
            style={styles.editInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="Game Name"
          />
        </View>

        {/* Location */}
        <View style={styles.editInputWrapper}>
          <Text style={styles.editLabel}>Court / Venue Location Address *</Text>
          <TextInput
            style={styles.editInput}
            value={editLocation}
            onChangeText={setEditLocation}
            placeholder="Venue Location"
          />
        </View>

        {/* Player Count */}
        <View style={styles.editInputWrapper}>
          <Text style={styles.editLabel}>Player Capacity *</Text>
          <TextInput
            style={styles.editInput}
            value={editPlayerCount}
            onChangeText={setEditPlayerCount}
            keyboardType="numeric"
            placeholder="e.g. 10"
          />
        </View>

        {/* Access visibility */}
        <View style={styles.editInputWrapper}>
          <Text style={styles.editLabel}>Visibility</Text>
          <View style={styles.editRadioContainer}>
            <TouchableOpacity 
              style={[styles.editRadioBtn, editAccess === "public" ? styles.editRadioActive : null]}
              onPress={() => setEditAccess("public")}
            >
              <Text style={[styles.editRadioText, editAccess === "public" ? styles.editRadioActiveText : null]}>Public</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.editRadioBtn, editAccess === "private" ? styles.editRadioActive : null]}
              onPress={() => setEditAccess("private")}
            >
              <Text style={[styles.editRadioText, editAccess === "private" ? styles.editRadioActiveText : null]}>Private</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Gender Restriction */}
        <View style={styles.editInputWrapper}>
          <Text style={styles.editLabel}>Gender Restriction</Text>
          <View style={styles.editRadioContainer}>
            {["all", "male", "female"].map((g) => (
              <TouchableOpacity 
                key={g}
                style={[styles.editRadioBtn, editGender === g ? styles.editRadioActive : null]}
                onPress={() => setEditGender(g)}
              >
                <Text style={[styles.editRadioText, editGender === g ? styles.editRadioActiveText : null]}>
                  {g.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Equipment */}
        <View style={styles.editInputWrapper}>
          <Text style={styles.editLabel}>Gear / Equipment Required</Text>
          <TextInput
            style={styles.editInput}
            value={editEquipment}
            onChangeText={setEditEquipment}
            placeholder="e.g. Bats, gloves"
          />
        </View>

        {/* Description */}
        <View style={styles.editInputWrapper}>
          <Text style={styles.editLabel}>About this Game</Text>
          <TextInput
            style={[styles.editInput, { height: 80, textAlignVertical: "top" }]}
            value={editDescription}
            onChangeText={setEditDescription}
            multiline
            placeholder="Add game notes, guidelines, skill level..."
          />
        </View>

        {/* Save & Cancel Actions */}
        <View style={styles.editActionsRow}>
          <TouchableOpacity 
            style={[styles.editBtn, styles.editCancelBtn]} 
            onPress={() => setIsEditingGame(false)}
          >
            <Text style={styles.editCancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.editBtn, styles.editSaveBtn]} 
            onPress={handleSaveGameEdits}
          >
            <Text style={styles.editSaveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderGameDetailsModal = () => {
    return (
      <Modal
        visible={showGameDetailsModal && selectedGame !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowGameDetailsModal(false);
          setIsEditingGame(false);
        }}
      >
        <TouchableOpacity 
          style={styles.detailsModalBackdrop} 
          activeOpacity={1} 
          onPress={() => {
            setShowGameDetailsModal(false);
            setIsEditingGame(false);
          }}
        >
          <View style={styles.detailsModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalDragHandle} />
            
            {selectedGame && (
              <>
                {/* Header */}
                <View style={styles.detailsHeader}>
                  <View style={styles.detailsTitleContainer}>
                    <MaterialCommunityIcons 
                      name={getSportIcon(selectedGame.sport_type) as any} 
                      size={28} 
                      color={COLORS.primary} 
                      style={{ marginRight: 10 }}
                    />
                    <View>
                      <Text style={styles.detailsGameName}>{selectedGame.name}</Text>
                      <Text style={styles.detailsSportType}>{selectedGame.sport_type}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {selectedGame.host_id === auth.user?.id && !isEditingGame && (
                      <>
                        <TouchableOpacity 
                          onPress={startEditingGame}
                          style={{ marginRight: 15 }}
                        >
                          <Ionicons name="create-outline" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => handleDeleteGame(selectedGame.id)}
                          style={{ marginRight: 15 }}
                        >
                          <Ionicons name="trash-outline" size={24} color={COLORS.error} />
                        </TouchableOpacity>
                      </>
                    )}
                    <TouchableOpacity onPress={() => {
                      setShowGameDetailsModal(false);
                      setIsEditingGame(false);
                    }}>
                      <Ionicons name="close-circle" size={28} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {isEditingGame ? (
                  renderEditGameForm()
                ) : (
                  <>
                    <ScrollView 
                      showsVerticalScrollIndicator={false} 
                      contentContainerStyle={styles.detailsScrollContent}
                    >
                      {/* Host Info Row */}
                      <View style={styles.detailsHostRow}>
                        <Image 
                          source={{ uri: selectedGame.host_profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }}
                          style={styles.detailsHostAvatar}
                        />
                        <View>
                          <Text style={styles.detailsHostLabel}>Hosted by</Text>
                          <Text style={styles.detailsHostName}>@{selectedGame.host_username}</Text>
                        </View>
                      </View>

                      {/* Date & Time block */}
                      <View style={styles.detailsInfoCard}>
                        <View style={styles.detailsInfoItem}>
                          <Ionicons name="calendar-outline" size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
                          <Text style={styles.detailsInfoText}>{selectedGame.game_date}</Text>
                        </View>
                        <View style={[styles.detailsInfoItem, { marginTop: 10 }]}>
                          <Ionicons name="time-outline" size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
                          <Text style={styles.detailsInfoText}>
                            {selectedGame.start_time.slice(0, 5)} - {selectedGame.end_time.slice(0, 5)}
                          </Text>
                        </View>
                      </View>

                      {/* Location block */}
                      <View style={styles.detailsInfoCard}>
                        <View style={styles.detailsInfoItem}>
                          <Ionicons name="location-outline" size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
                          <Text style={styles.detailsInfoText} numberOfLines={3}>{selectedGame.location}</Text>
                        </View>
                      </View>

                      {/* Details Grid */}
                      <View style={styles.detailsGrid}>
                        <View style={styles.detailsGridItem}>
                          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textSecondary} style={{ marginBottom: 4 }} />
                          <Text style={styles.gridLabel}>Visibility</Text>
                          <Text style={styles.gridValue}>{selectedGame.access}</Text>
                        </View>
                        <View style={styles.detailsGridItem}>
                          <Ionicons name="cash-outline" size={18} color={COLORS.textSecondary} style={{ marginBottom: 4 }} />
                          <Text style={styles.gridLabel}>Entry Pricing</Text>
                          <Text style={styles.gridValue}>
                            {parseFloat(selectedGame.entry_fee) === 0 ? "Free" : `Rs. ${selectedGame.entry_fee}`}
                          </Text>
                        </View>
                        <View style={styles.detailsGridItem}>
                          <Ionicons name="transgender-outline" size={18} color={COLORS.textSecondary} style={{ marginBottom: 4 }} />
                          <Text style={styles.gridLabel}>Gender</Text>
                          <Text style={styles.gridValue}>{selectedGame.gender}</Text>
                        </View>
                        <View style={styles.detailsGridItem}>
                          <Ionicons name="construct-outline" size={18} color={COLORS.textSecondary} style={{ marginBottom: 4 }} />
                          <Text style={styles.gridLabel}>Equipment</Text>
                          <Text style={styles.gridValue} numberOfLines={1}>
                            {selectedGame.equipment_required || "None"}
                          </Text>
                        </View>
                      </View>

                      {/* Description */}
                      {selectedGame.description ? (
                        <View style={styles.detailsDescriptionCard}>
                          <Text style={styles.detailsSectionTitle}>About this Game</Text>
                          <Text style={styles.detailsDescriptionText}>{selectedGame.description}</Text>
                        </View>
                      ) : null}

                      {/* Participants List */}
                      {(() => {
                        const joinedParts = (selectedGame.participants || []).filter((p: any) => p.status !== "waiting");
                        const waitingParts = (selectedGame.participants || []).filter((p: any) => p.status === "waiting");
                        
                        return (
                          <>
                            <View style={styles.detailsParticipantsSection}>
                              <Text style={styles.detailsSectionTitle}>
                                Fixed Players ({joinedParts.length}/{selectedGame.player_count})
                              </Text>
                              
                              {joinedParts.length > 0 ? (
                                <ScrollView 
                                  horizontal 
                                  showsHorizontalScrollIndicator={false}
                                  contentContainerStyle={styles.detailsPartsScroll}
                                >
                                  {joinedParts.map((p: any) => (
                                    <View key={p.user_id} style={styles.detailsPartCard}>
                                      <Image 
                                        source={{ uri: p.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }}
                                        style={styles.detailsPartAvatar}
                                      />
                                      <Text style={styles.detailsPartName} numberOfLines={1}>
                                        {p.username}
                                      </Text>
                                    </View>
                                  ))}
                                </ScrollView>
                              ) : (
                                <Text style={styles.noPartsText}>No participants have joined yet.</Text>
                              )}
                            </View>

                            {waitingParts.length > 0 && (
                              <View style={[styles.detailsParticipantsSection, { marginTop: 15 }]}>
                                <Text style={[styles.detailsSectionTitle, { color: "#FB8C00" }]}>
                                  Waiting List Players ({waitingParts.length})
                                </Text>
                                
                                <ScrollView 
                                  horizontal 
                                  showsHorizontalScrollIndicator={false}
                                  contentContainerStyle={styles.detailsPartsScroll}
                                >
                                  {waitingParts.map((p: any) => (
                                    <View key={p.user_id} style={styles.detailsPartCard}>
                                      <View style={{ position: "relative" }}>
                                        <Image 
                                          source={{ uri: p.profile_pic || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }}
                                          style={[styles.detailsPartAvatar, { borderColor: "#FFB74D", borderWidth: 1.5 }]}
                                        />
                                        <View style={{
                                          position: "absolute",
                                          bottom: 4,
                                          right: 0,
                                          backgroundColor: "#FB8C00",
                                          paddingHorizontal: 4,
                                          paddingVertical: 1,
                                          borderRadius: 4,
                                        }}>
                                          <Text style={{ fontSize: 7, color: COLORS.surface, fontFamily: "Poppins_700Bold" }}>WAIT</Text>
                                        </View>
                                      </View>
                                      <Text style={styles.detailsPartName} numberOfLines={1}>
                                        {p.username}
                                      </Text>
                                    </View>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </>
                        );
                      })()}
                    </ScrollView>

                    {/* Join / Leave Footer Button */}
                    {(() => {
                      const userPart = (selectedGame.participants || []).find((p: any) => p.user_id === auth.user?.id);
                      const isWaiting = userPart && userPart.status === "waiting";
                      const isFull = selectedGame.joined_count >= selectedGame.player_count;
                      
                      let btnText = "Join Game";
                      let btnStyle: any = styles.detailsJoinBtn;
                      let textStyle: any = null;
                      
                      if (selectedGame.is_joined) {
                        if (isWaiting) {
                          btnText = "Leave Waiting List";
                          btnStyle = styles.detailsLeaveBtn;
                          textStyle = { color: COLORS.error };
                        } else {
                          btnText = "Leave Game";
                          btnStyle = styles.detailsLeaveBtn;
                          textStyle = { color: COLORS.error };
                        }
                      } else {
                        if (isFull) {
                          btnText = "Join Waiting List";
                          btnStyle = [styles.detailsJoinBtn, { backgroundColor: "#FF9800" }];
                        } else {
                          btnText = "Join Game";
                          btnStyle = styles.detailsJoinBtn;
                        }
                      }
                      
                      return (
                        <View style={styles.detailsFooter}>
                          <TouchableOpacity
                            style={[
                              styles.detailsActionBtn,
                              btnStyle,
                              actionLoading === selectedGame.id ? styles.detailsBtnDisabled : null
                            ]}
                            onPress={() => handleJoinLeaveGame(selectedGame.id, !!selectedGame.is_joined)}
                            disabled={actionLoading === selectedGame.id}
                          >
                            {actionLoading === selectedGame.id ? (
                              <ActivityIndicator color={COLORS.surface} />
                            ) : (
                              <Text style={[styles.detailsActionBtnText, textStyle]}>
                                {btnText}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })()}
                  </>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {renderSearchBarSection()}
        {renderFindPlayersList()}
        {renderFindGamesSection()}
      </ScrollView>
      {renderFilterModal()}
      {renderGameDetailsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7FD", // Light background matching mockup
  },

  scrollContent: {
    paddingBottom: 40,
  },
  searchBarSection: {
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    gap: 12,
  },
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingHorizontal: SPACING.md,
    height: 48,
    ...SHADOWS.soft,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  filterIconBtn: {
    padding: 4,
  },
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "#E4ECFA",
    borderRadius: 20,
    padding: 4,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  segmentedTabActive: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.soft,
  },
  segmentedText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  segmentedTextActive: {
    color: COLORS.surface,
    fontFamily: "Poppins_600SemiBold",
  },
  playersSection: {
    marginTop: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  playersCardContainer: {
    backgroundColor: "#DDE8F9",
    borderRadius: 16,
    paddingVertical: SPACING.lg,
    marginHorizontal: SPACING.xl,
  },
  playersScroll: {
    paddingHorizontal: SPACING.md,
    gap: 16,
  },
  playerItem: {
    alignItems: "center",
    width: 72,
  },
  playerAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: COLORS.surface,
    marginBottom: 6,
  },
  playerName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  emptyPlayersCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginHorizontal: SPACING.xl,
    borderWidth: 1.5,
    borderColor: "#E4ECFA",
  },
  emptyPlayersText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  gamesSection: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  monthLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 8,
  },
  datesScroll: {
    gap: 12,
    paddingBottom: 4,
  },
  dateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    width: 60,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E4ECFA",
    ...SHADOWS.soft,
  },
  dateCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  dayTextActive: {
    color: COLORS.surface + "C0",
  },
  dateNumberText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  dateNumberActive: {
    color: COLORS.surface,
  },
  filterPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    gap: 10,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E4ECFA",
    ...SHADOWS.soft,
  },
  filterPillText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  gameCard: {
    flexDirection: "row",
    backgroundColor: "#DDE8F9",
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: "center",
    justifyContent: "space-between",
  },
  gameCardLeft: {
    flex: 1,
    gap: 6,
  },
  gameTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  gameSportText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  gameSeparator: {
    marginHorizontal: 8,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  gameSlotsText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  gameTimeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  gameVenueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  gameVenueText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  joinGameBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 16,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveGameBtn: {
    backgroundColor: COLORS.error,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  joinGameBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.surface,
  },
  emptyGamesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E4ECFA",
    marginTop: 10,
  },
  emptyGamesText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    maxHeight: "75%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
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
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  modalCloseBtn: {
    padding: 2,
  },
  modalOptionsContainer: {
    gap: 10,
  },
  modalOptionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F4F7FD",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4ECFA",
  },
  modalOptionActive: {
    backgroundColor: "#E4ECFA",
    borderColor: COLORS.primary + "30",
  },
  modalOptionText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  modalOptionTextActive: {
    color: COLORS.primary,
    fontFamily: "Poppins_600SemiBold",
  },
  detailsModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  detailsModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 24,
    paddingTop: SPACING.sm,
    height: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E4ECFA",
  },
  detailsTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailsGameName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  detailsSportType: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -2,
  },
  detailsScrollContent: {
    paddingVertical: 20,
    gap: 16,
  },
  detailsHostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailsHostAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  detailsHostLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  detailsHostName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: -2,
  },
  detailsInfoCard: {
    backgroundColor: "#F4F7FD",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4ECFA",
  },
  detailsInfoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailsInfoText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  detailsGridItem: {
    backgroundColor: "#F4F7FD",
    borderWidth: 1,
    borderColor: "#E4ECFA",
    borderRadius: 16,
    padding: 12,
    width: "48%",
    alignItems: "center",
  },
  gridLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  gridValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.textPrimary,
    marginTop: 2,
    textTransform: "capitalize",
  },
  detailsDescriptionCard: {
    backgroundColor: "#F4F7FD",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4ECFA",
  },
  detailsSectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  detailsDescriptionText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  detailsParticipantsSection: {
    marginTop: 8,
  },
  detailsPartsScroll: {
    gap: 12,
    paddingVertical: 8,
  },
  detailsPartCard: {
    alignItems: "center",
    width: 60,
  },
  detailsPartAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 6,
  },
  detailsPartName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  noPartsText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
  detailsFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E4ECFA",
    backgroundColor: COLORS.surface,
  },
  detailsActionBtn: {
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsJoinBtn: {
    backgroundColor: COLORS.primary,
  },
  detailsLeaveBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.error,
  },
  detailsBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  detailsActionBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: COLORS.surface,
  },
  editInputWrapper: {
    marginBottom: 15,
  },
  editLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  editInput: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.textPrimary,
    borderWidth: 1.5,
    borderColor: "#E4ECFA",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: "#F8FAFD",
  },
  editRadioContainer: {
    flexDirection: "row",
    gap: 10,
  },
  editRadioBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E4ECFA",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFD",
  },
  editRadioActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  editRadioText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  editRadioActiveText: {
    color: COLORS.surface,
  },
  editActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 30,
    gap: 12,
  },
  editBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  editCancelBtn: {
    backgroundColor: "#F4F7FD",
    borderWidth: 1,
    borderColor: "#E4ECFA",
  },
  editCancelBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  editSaveBtn: {
    backgroundColor: COLORS.primary,
  },
  editSaveBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    color: COLORS.surface,
  },
});
