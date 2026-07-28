import { describe, expect, it } from "vitest";
import type { GachaGameHistory } from "./useGachaHistory";
import { createGachaWorkspace, getGachaDirtyByGame } from "./gachaWorkspace";

describe("gacha workspace helpers", () => {
  it("creates one normalized editor state per game", () => {
    const workspace = createGachaWorkspace("shop", {
      configurations: {},
      liveByGame: {},
    });
    expect(workspace.states.genshin.settings.game_type).toBe("genshin");
    expect(workspace.states.hsr.settings.game_type).toBe("hsr");
    expect(workspace.states.genshin.settings.shop_id).toBe("shop");
    expect(workspace.states.hsr.banners).toHaveLength(1);
  });

  it("compares persisted configuration while ignoring editor selection", () => {
    const { states } = createGachaWorkspace("shop", {
      configurations: {},
      liveByGame: {},
    });
    const history = (gameType: "genshin" | "hsr"): GachaGameHistory => ({
      past: [],
      present: { ...states[gameType], selectedBannerId: "editor-only" },
      future: [],
    });
    const histories = {
      genshin: history("genshin"),
      hsr: history("hsr"),
    };

    expect(getGachaDirtyByGame(histories, states)).toEqual({
      genshin: false,
      hsr: false,
    });
    histories.hsr.present = {
      ...histories.hsr.present!,
      settings: { ...histories.hsr.present!.settings, title: "Changed" },
    };
    expect(getGachaDirtyByGame(histories, states).hsr).toBe(true);
  });
});
