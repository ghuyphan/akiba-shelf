export const SIMULATORS = [
  {
    game: "genshin",
    label: "Genshin",
    workspaceName: "matsuri-wish-simulator",
    workspaceRoot: "vendor/gacha-simulator",
    devDir: ".gacha-dist",
    distDir: "dist/gacha-simulator",
    routeRoot: "gacha-simulator",
    envVar: "GACHA_OUTPUT_DIR",
  },
  {
    game: "hsr",
    label: "HSR",
    workspaceName: "matsuri-hsr-warp-simulator",
    workspaceRoot: "vendor/hsr-simulator",
    devDir: ".hsr-gacha-dist",
    distDir: "dist/hsr-simulator",
    routeRoot: "hsr-simulator",
    envVar: "GACHA_OUTPUT_DIR",
  },
];

export function getSimulator(game) {
  return SIMULATORS.find((simulator) => simulator.game === game) ?? null;
}
