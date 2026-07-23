import cacheNames from "../../../config/offline-cache-names.json";

const simulatorVersion =
  typeof __MATSURI_SIMULATOR_CACHE_VERSION__ === "undefined"
    ? ""
    : `-${__MATSURI_SIMULATOR_CACHE_VERSION__}`;

export const OFFLINE_CACHE_NAMES = {
  ...cacheNames,
  simulatorShell: `${cacheNames.simulatorShell}${simulatorVersion}`,
  simulatorMedia: `${cacheNames.simulatorMedia}${simulatorVersion}`,
  simulatorStatic: `${cacheNames.simulatorStatic}${simulatorVersion}`,
};
