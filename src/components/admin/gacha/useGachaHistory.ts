import { useCallback, useReducer, useRef } from "react";
import { GACHA_GAME_TYPES } from "../../../lib/gachaGames";
import type { GachaGameType } from "../../../types/gacha";
import type { GachaState, GachaStatesByGame } from "./gachaState";

/**
 * Undo/redo store for the gacha workspace. Every game keeps its own
 * past/present/future stacks so switching games (or saving one game) never
 * wipes another game's editing history.
 */

export interface GachaGameHistory {
  past: GachaState[];
  present: GachaState | null;
  future: GachaState[];
}

interface GachaHistoryState {
  activeGame: GachaGameType;
  games: Record<GachaGameType, GachaGameHistory>;
}

type GachaHistoryAction =
  | {
      type: "LOAD_ALL";
      states: GachaStatesByGame;
      activeGame?: GachaGameType;
    }
  | { type: "RESET_GAME"; gameType: GachaGameType; state: GachaState }
  | { type: "SWITCH_GAME"; gameType: GachaGameType }
  | {
      type: "UPDATE_STATE";
      updater: (curr: GachaState) => GachaState;
      pushHistory: boolean;
    }
  | { type: "RECORD_SNAPSHOT" }
  | { type: "UNDO" }
  | { type: "REDO" };

const HISTORY_LIMIT = 50;

function emptyHistory(): GachaGameHistory {
  return { past: [], present: null, future: [] };
}

function initialHistoryState(): GachaHistoryState {
  return {
    activeGame: "genshin",
    games: Object.fromEntries(
      GACHA_GAME_TYPES.map((gameType) => [gameType, emptyHistory()]),
    ) as Record<GachaGameType, GachaGameHistory>,
  };
}

function updateActiveGame(
  state: GachaHistoryState,
  updater: (game: GachaGameHistory) => GachaGameHistory,
): GachaHistoryState {
  return {
    ...state,
    games: {
      ...state.games,
      [state.activeGame]: updater(state.games[state.activeGame]),
    },
  };
}

function gachaHistoryReducer(
  state: GachaHistoryState,
  action: GachaHistoryAction,
): GachaHistoryState {
  switch (action.type) {
    case "LOAD_ALL":
      return {
        activeGame: action.activeGame ?? state.activeGame,
        games: Object.fromEntries(
          GACHA_GAME_TYPES.map((gameType) => [
            gameType,
            {
              past: [] as GachaState[],
              present: action.states[gameType] ?? null,
              future: [] as GachaState[],
            },
          ]),
        ) as Record<GachaGameType, GachaGameHistory>,
      };
    case "RESET_GAME":
      return {
        ...state,
        games: {
          ...state.games,
          [action.gameType]: {
            past: [],
            present: action.state,
            future: [],
          },
        },
      };
    case "SWITCH_GAME":
      return { ...state, activeGame: action.gameType };
    case "RECORD_SNAPSHOT":
      return updateActiveGame(state, (game) => {
        if (!game.present) return game;
        return {
          past: [...game.past, game.present].slice(-HISTORY_LIMIT),
          present: game.present,
          future: [],
        };
      });
    case "UPDATE_STATE":
      return updateActiveGame(state, (game) => {
        if (!game.present) return game;
        const nextPresent = action.updater(game.present);

        if (
          JSON.stringify(game.present.settings) ===
            JSON.stringify(nextPresent.settings) &&
          JSON.stringify(game.present.banners) ===
            JSON.stringify(nextPresent.banners) &&
          JSON.stringify(game.present.entries) ===
            JSON.stringify(nextPresent.entries) &&
          game.present.selectedBannerId === nextPresent.selectedBannerId
        ) {
          return game;
        }

        if (action.pushHistory) {
          return {
            past: [...game.past, game.present].slice(-(HISTORY_LIMIT - 1)),
            present: nextPresent,
            future: [],
          };
        }
        return { ...game, present: nextPresent };
      });
    case "UNDO":
      return updateActiveGame(state, (game) => {
        if (game.past.length === 0 || !game.present) return game;
        const previous = game.past[game.past.length - 1];
        return {
          past: game.past.slice(0, game.past.length - 1),
          present: previous,
          future: [game.present, ...game.future],
        };
      });
    case "REDO":
      return updateActiveGame(state, (game) => {
        if (game.future.length === 0 || !game.present) return game;
        const next = game.future[0];
        return {
          past: [...game.past, game.present],
          present: next,
          future: game.future.slice(1),
        };
      });
    default:
      return state;
  }
}

export function useGachaHistory() {
  const [state, dispatch] = useReducer(
    gachaHistoryReducer,
    undefined,
    initialHistoryState,
  );
  // Tracks whether the focused text control already pushed its pre-edit
  // snapshot, so a whole typing session collapses into one undo step.
  const textSessionHasSnapshot = useRef(false);

  const loadAll = useCallback(
    (states: GachaStatesByGame, activeGame?: GachaGameType) => {
      textSessionHasSnapshot.current = false;
      dispatch({ type: "LOAD_ALL", states, activeGame });
    },
    [],
  );

  const resetGame = useCallback(
    (gameType: GachaGameType, nextState: GachaState) => {
      textSessionHasSnapshot.current = false;
      dispatch({ type: "RESET_GAME", gameType, state: nextState });
    },
    [],
  );

  const switchGame = useCallback((gameType: GachaGameType) => {
    textSessionHasSnapshot.current = false;
    dispatch({ type: "SWITCH_GAME", gameType });
  }, []);

  const update = useCallback(
    (updater: (curr: GachaState) => GachaState, pushHistory = true) => {
      dispatch({ type: "UPDATE_STATE", updater, pushHistory });
    },
    [],
  );

  const beginTextSession = useCallback(() => {
    textSessionHasSnapshot.current = false;
  }, []);

  const updateText = useCallback(
    (updater: (curr: GachaState) => GachaState) => {
      if (!textSessionHasSnapshot.current) {
        dispatch({ type: "RECORD_SNAPSHOT" });
        textSessionHasSnapshot.current = true;
      }
      dispatch({ type: "UPDATE_STATE", updater, pushHistory: false });
    },
    [],
  );

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  return {
    activeGame: state.activeGame,
    histories: state.games,
    loadAll,
    resetGame,
    switchGame,
    update,
    updateText,
    beginTextSession,
    undo,
    redo,
  };
}
