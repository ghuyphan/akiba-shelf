import { GACHA_GAME_TYPES } from "../../../lib/gacha/gachaGames";
import type {
  GachaGameConfiguration,
  GachaGameType,
  GachaLiveStatusesByGame,
} from "../../../types/gacha";
import {
  createGameState,
  persistedGameState,
  type GachaState,
  type GachaStatesByGame,
} from "./gachaState";
import type { GachaGameHistory } from "./useGachaHistory";

type GachaWorkspaceResponse = {
  configurations: Partial<Record<GachaGameType, GachaGameConfiguration>>;
  liveByGame: GachaLiveStatusesByGame;
};

export function createGachaWorkspace(
  shopId: string,
  response: GachaWorkspaceResponse,
) {
  const states = Object.fromEntries(
    GACHA_GAME_TYPES.map((gameType) => [
      gameType,
      createGameState(shopId, gameType, response.configurations[gameType]),
    ]),
  ) as Record<GachaGameType, GachaState>;
  return { states, liveByGame: response.liveByGame };
}

export function getGachaDirtyByGame(
  histories: Record<GachaGameType, GachaGameHistory>,
  baselines: GachaStatesByGame,
) {
  const result = {} as Record<GachaGameType, boolean>;
  for (const gameType of GACHA_GAME_TYPES) {
    const present = histories[gameType].present;
    const baseline = baselines[gameType];
    if (!present || !baseline) {
      result[gameType] = Boolean(present || baseline);
      continue;
    }
    result[gameType] =
      JSON.stringify(persistedGameState(present)) !==
      JSON.stringify(persistedGameState(baseline));
  }
  return result;
}
