import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  Gamepad2,
  Layers3,
  LoaderCircle,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Star,
  Sword,
  Trash2,
  Undo2,
  UserRound,
} from "lucide-react";
import "../../styles/gacha-admin.css";
import {
  getAdminGachaConfiguration,
  saveGachaConfiguration,
} from "../../lib/api";
import { safePublicUrl } from "../../lib/branding";
import { getErrorMessage } from "../../lib/errors";
import {
  capGachaFeaturedEntries,
  getGachaFeaturedItemLimit,
  HSR_SECONDARY_FEATURED_LIMIT,
  matchesGachaBannerKind,
  normalizeGachaBanners,
  normalizeGachaDisplayLimit,
} from "../../lib/gachaLimits";
import { usePlatformI18n } from "../../lib/platformI18n";
import type { Product } from "../../types/catalog";
import {
  defaultGachaBanner,
  defaultGachaSettings,
  type GachaBanner,
  type GachaElement,
  type GachaGameConfiguration,
  type GachaGameConfigurations,
  type GachaGameType,
  type GachaItemKind,
  type GachaPoolEntry,
  type GachaRarity,
  type GachaSettings,
  type GachaWeaponType,
} from "../../types/gacha";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Field, TextArea, TextInput } from "../ui/Field";
import { SelectMenu, type SelectMenuOption } from "../ui/SelectMenu";
import { useToast } from "../ui/ToastProvider";
import { AdminCard } from "./AdminCard";
import hsrPhysicalIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-physical.webp";
import hsrFireIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-fire.webp";
import hsrIceIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-ice.webp";
import hsrLightningIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-lightning.webp";
import hsrWindIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-wind.webp";
import hsrQuantumIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-quantum.webp";
import hsrImaginaryIcon from "../../../vendor/hsr-simulator/src/images/utils/combat-imaginary.webp";

type Props = { shopId: string; shopSlug: string; products: Product[] };

const rarityOptions: SelectMenuOption[] = [3, 4, 5].map((rarity) => ({
  value: String(rarity),
  label: `${rarity}★`,
  icon: <Star size={15} />,
}));
const elementPaths: Record<string, string> = {
  anemo:
    "M238 88c13 4 7 2 18 9 11-7 5-5 19-9-5-18-9-12-14-33z m-10 18c16 14 19 11 24 28l9 0c4-15-3-2 8-15l15-13c-18 2-17 7-28 7-11 0-9-5-28-7z m-191 248c0-109 117-88 168-117 50-28 57-82 16-105-29-16-19 2-53 2 2-27 23-26 47-60 10-14 32-51 37-70l9 0c17 72 81 100 84 130-33 0-23-16-50-3-47 22-52 103 74 124 153 26 99 126 88 173l-10 0c0-148-169-152-186-214l-9 0c-6 23-30 37-50 48-26 14-42 21-66 37-37 24-71 74-71 134-17-13-28-49-28-79z m275-215c19 0 26-1 28 23-65 6-43 56-14 56 27 0 73-42 121-27 87 28 61 120 61 139-32-21-41-87-135-88-63-1-100-31-90-71 3-15 15-32 29-32z m-312 149c0-62 50-120 125-92 12 4 89 49 89-6 0-18-23-26-42-28 5-55 87-6 51 46-42 59-99 10-163 61-30 24-36 49-55 61-1-21-5-18-5-42z m359 154c0-78-22-122-79-172 50 4 139 53 139 107 0 73-7 93-79 131 6-23 19-37 19-66z m-266-32c0-45 5-73 47-103 18-13 65-35 93-37-7 9-18 15-29 26-37 38-50 91-50 146 0 29 13 43 18 66-27-15-30-13-52-36-15-15-27-35-27-62z",
  geo: "M361 185z m0 0c-4-42-78-140-106-159-15 23-36 44-53 66-35 46-124 176-128 230-17-5-47-44-53-62-5-12-2-10 7-24 36-58 36-50 66-88 29-37 119-120 161-148 12 3 55 39 65 49 21 21 40 33 60 56l37 46c18 29-20 68-30 109-20-5-104-100-128-97-17 9-18 11-30 27l-23 39c17 26 41 33 58 58-7 9-9 15-18 22-14-4-37-22-47-32-16-15-30-23-41-39 5-24 28-54 42-73l55-64c38 26 68 59 106 84z m-269 164c0-27 28-80 39-102 22 15 36 37 57 54 22 17 42 34 67 48 26-18 38-39 53-67l-59-61 23-24 45 37c14 11 29 24 39 39-7 34-75 116-101 133-19-12-89-79-106-84 23 49 12 35 46 87 10 15 48 64 60 72 14-9 18-15 28-29l78-103c20-30 76-124 79-164l9 0c10 36 63 45 37 90-61 106-222 231-227 237l-89-74c-12-13-78-77-78-89z",
  electro:
    "M469 121c-10-3-166-115-224 17-21 48 6 96 40 112 52 25 101-11 73-68 59 13 92 73 93 130 1 25-9 40-9 65 45-30 45-65 65-79 0 87-83 159-152 192-43 20-76 13-94 21 8-24 39-9 96-75 29-34 36-89 8-131-23-34-83-52-122-20-15 12-29 30-27 53 3 28 19 39 49 39l0 9c-17 5-82 60-167 0-14-10-28-24-42-33 3 37 28 71 42 98-40-11-80-93-90-133-14-53-11-126 17-177 6-9 4-5 8-11 0 65 0 100 25 143 20 33 58 60 117 46 101-22 61-184-14-140l-21 21c-1-34-8-71 31-113 18-19 44-33 69-42l20-8c1 0 3-1 4-1 0-1 2-1 3-2 0 0 2 0 3-1-17-4-28-9-48-12-19-3-39-2-59-2 12-10 22-11 41-15 15-4 30-4 52-4 97 0 199 68 213 121z m0 0l5 0-4 6z m38 177l0-5 5 4z",
  dendro:
    "M53 242z m0 0c-36 17-24-2-53-10l0-10c37-9 16-27 57 0 22-46 10-59 92-109 37-22 89-34 104-101 22 16 8 26 42 59 35 34 152 60 159 151 15-3 32-32 57 5-15 23-29 25-52 10 0 99-14 68-24 110l38 0c11 16 22 32 24 57-48 0-70 2-72-48-29 16-38 34-86 34-40 0-62-17-76-43l14-19c20 13 17 24 48 28 121 15 148-144 21-207-107-52-57-39-93-65-15 66-133 46-161 149-19 67 15 130 94 124 43-4 27-22 58-24 6 25 10 25-12 40-14 9-26 15-46 17-47 4-69-16-95-34-12 50-18 48-77 48 24-49 4-57 67-57-9-17-16-23-21-46-5-21-7-35-7-59z m243 57c26 0 31 2 41-17 26-54-42-81-50-112 17 4 10 5 24 14 43 26 44 24 91 24-5 17-5 18-24 19 5 21 19 28 19 43 0 65-97 78-101 29z m-176-14c0-31-2-22 19-53-18-9-18-8-29-24 37 0 42 4 67-9l52-29c-23 43-57 45-57 91 0 31 15 38 48 38-4 44-65 30-82 15-6-4-18-21-18-29z m95 138c0-24 28-47 43-57 17 11 47 37 41 64-5 22-31 60-46 70-15-29-38-55-38-77z",
  hydro:
    "M381 62z m5 5l-5-5z m5 5l-5-5z m5 5l-5-5z m0 0c4 16 97 128-14 239-14 14-25 26-45 35-47 22-92 25-138 10-30-10-30-20-30-57 41-27 31-12 78-7 27 4 62-9 81-21 123-78 64-294-141-242-30 8-52 22-78 28 70-104 315-79 385 99 22 54 25 117 5 176-58 167-254 222-387 131-130-89-78-150-38-139 25 8 84 128 233 93 33-8 53-21 77-39 39-29 73-84 78-145 5-67-28-136-66-161z m-232 71c0-34-1-53 24-77 56-56 133-20 143 16-23-14-75-55-118-11-55 55 33 124 59 74 9-18 6-38 34-40 41-2 45 59 15 89-55 55-157 12-157-51z m-90 101c0 73-105 29-65-19 25-31 65-3 65 19z m-15-96l0-25c10-8 14-12 30-15l8 7c30 31 0 39-18 48-8-6 3 2-8-7-6-4-8-5-12-8z",
  pyro: "M406 249z m-291 9l-5-4z m0 0z m138 53z m153-62c30-8 80-76-8-126-74-43-62-32-140-85-68 60-179 76-186 144-4 33 15 65 38 72-5-18-13-18-15-44-4-51 32-79 72-100-6 21-45 53-10 110 18 29 55 52 101 53-1 0-3 2-3 1-13 7-39 19-83 35-84 92l-35-52c-30-40-106-116-71-178 14-24 125-80 182-124 12-9 13-15 29-19 34 23 34 37 100 72 34 17 78 45 98 79 39 71-73 148-84 164-7 9-10 17-16 28-6 14-7 23-12 35-13-9-29-35-28-57 1-28 21-39 28-63-16 11-36 39-43 58-10 29-2 60 5 86-42-11-58-48-58-91-36 42 29 84 39 100 21 30-26 96-44 101-1-77-82-101-65-165 16-58 95-65 140-95 51-35 62-114-1-143-26-13-70-22-97-3-12 9-18 19-15 42 3 22 14 23 24 39-29 0-43 2-56-16-14-18-12-36 2-53 66-79 225-18 235 64 5 36-7 41-9 67z m-215-48c13 3 24 10 38 10 42 0 76-40 48-82 35 3 85 44 37 95-14 16-18 18-44 23-42 7-63-16-79-46z",
  cryo: "M258 167c1-34 16-45 19-74-23-6-5-8-28-14-4 14 0 10-14 14l23 74z m0 47c-1 9 6 17 3 3 0 0 0-19-3-3z m-9 0c-2 9 6 17 3 3 0 0 0-19-3-3z m5 19c-2 8 6 16 3 3 0-1 0-20-3-3z m28 4l-11 9c13-3 6 2 11-9z m-52 0c3 12-2 7 10 10z m42 28z m-32 0z m42 10c0-1 8-9 9-10l-19 0 10 10z m-28 9l4 0z m-24-9l10-10-19 0c0 0 9 9 9 10z m66 0c4 4 17-8 5-3 0 0-13-5-5 3z m-89 0c5 4 18-8 5-3 0 0-13-5-5 3z m79 4l-4-4z m-56-4l-4 4z m33 27c0-2 0-7 0-9-3-8-2-4-5-9 0 2 0 7 1 9 2 8 1 5 4 9z m-9-18c-5 6-5-10-5 14 4-6 3 5 5-14z m83 18z m-162 0z m162 0c11 17 19 17 42 52 10-5 19-8 33-10-5-10-8-18-9-32-30 0-41-7-66-10z m-162 0c-25 3-36 10-66 10-1 14-4 22-9 32 14 2 23 5 33 10 23-35 31-35 42-52z m60 108l20 22 23-21-24-67c-1 19-12 49-19 66z m-9-131c-20 5-28 21-39 36l-31 48 15 18c-45 1-99-3-136 5l70-121c10 43 46 15 97 14-11-17-12-9-23-23 9-13 12-17 33-19 1 1 2 3 3 2 0-1 2 1 2 1 10 0 3 1 9-3l4 0-4-4-10-10-4-4c0-19 1-19 4-33 18 4 23 8 33 19-1-17-9-36-15-50-7-15-19-30-22-43-8 4-15 5-23 9l65-121c16 12 23 39 34 58 11 18 31 46 35 63-8-4-15-5-23-9-5 18-34 53-37 93 10-11 15-15 33-19 3 14 4 14 4 33l-4 4-5 5-5 5-4 4 4 0c1 1 3 3 3 2 0-1 2 1 3 1 9 0 3 1 8-3 21 2 24 6 33 19-11 14-12 6-24 23 17 1 44 7 58 9 43 5 27-10 45-23 7 30 60 98 65 121-37-8-91-4-135-4l15-18-15-24c-11-19-35-55-56-61 22 32 13 6 10 47-17-9-21-10-33-24 0 22 11 46 18 61 22 44 25 32 42 28l-51 89c-6 11-8 20-14 32l-69-121c17 4 13 10 26-2 10-9 33-62 34-87-12 14-16 15-33 24-8-36-6-23 10-47z m111-70c12-2 20-6 30-8 16-3 22-2 35-6 3-11 5-23 10-32-22 0-19-3-37-5-6 20-27 36-38 51z m-37 28l-14 0 0-4 5-5 5-5 4-4c24-16 33-36 48-59 6-9 2-4 8-11-8-21 1 2-7-11-5-8-4-2-7-12 29 0 37 5 65 5 25-1 39-5 70-5-6 21-56 80-65 121-9-10-8-7-10-24-16 0-39-1-55 1l-47 13z m-163-79c-18 2-15 5-37 5 5 9 7 21 9 32l66 14c-11-15-32-31-38-51z m75 61l4 4 10 10 0 4-14 0-44-12c-18-3-39-2-59-2-1 17 0 14-9 24-8-37-60-101-65-121 30 0 42 3 65 4 30 2 40-4 70-4-4 15-8 6-14 23 4 5 1 0 6 8 16 23 25 45 50 62z",
};

const elementColors: Record<string, string> = {
  // Genshin
  anemo: "#33af8f",
  geo: "#de9d3c",
  electro: "#af89ef",
  dendro: "#8bc33a",
  hydro: "#3da9fc",
  pyro: "#e35b5b",
  cryo: "#62c4c7",
  // HSR
  physical: "#9aa2af",
  fire: "#f2615a",
  ice: "#4bc2f1",
  lightning: "#d772f1",
  wind: "#51eb99",
  quantum: "#7c55f1",
  imaginary: "#f1ca4b",
};

const hsrElementIcons: Record<string, string> = {
  physical: hsrPhysicalIcon,
  fire: hsrFireIcon,
  ice: hsrIceIcon,
  lightning: hsrLightningIcon,
  wind: hsrWindIcon,
  quantum: hsrQuantumIcon,
  imaginary: hsrImaginaryIcon,
};

function GachaElementIcon({
  element,
  size = 16,
  className = "",
}: {
  element: string;
  size?: number;
  className?: string;
}) {
  const hsrIcon = hsrElementIcons[element];
  if (hsrIcon) {
    return (
      <img
        src={hsrIcon}
        alt=""
        width={size}
        height={size}
        className={`gacha-element-icon is-hsr ${className}`.trim()}
      />
    );
  }

  const path = elementPaths[element];
  const color = elementColors[element];
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`gacha-element-icon is-genshin ${className}`.trim()}
      style={{ display: "inline-block", verticalAlign: "middle", color }}
      fill="currentColor"
    >
      <g transform="translate(0, 480) scale(1, -1)">
        <path d={path} />
      </g>
    </svg>
  );
}

function newEntry(
  shopId: string,
  bannerId: string,
  productId: string,
  kind: GachaItemKind,
  gameType: "genshin" | "hsr",
): GachaPoolEntry {
  return {
    shop_id: shopId,
    banner_id: bannerId,
    product_id: productId,
    kind,
    element: gameType === "hsr" ? "physical" : "anemo",
    weapon_type: gameType === "hsr" ? "destruction" : "sword",
    rarity: 3,
    weight: 100,
    featured: false,
    active: true,
  };
}

function productImage(product: Product) {
  return safePublicUrl(
    product.image_variants?.[0]?.thumbnail ?? product.images[0] ?? "",
  );
}

function DropdownField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`field ${disabled ? "is-disabled" : ""}`}>
      <span className="field-label">{label}</span>
      <SelectMenu
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

interface GachaState {
  settings: GachaSettings;
  banners: GachaBanner[];
  entries: GachaPoolEntry[];
  selectedBannerId: string;
}

type GachaStatesByGame = Partial<Record<GachaGameType, GachaState>>;

function createGameState(
  shopId: string,
  gameType: GachaGameType,
  configuration?: GachaGameConfiguration,
): GachaState {
  const fallbackBanner = {
    ...defaultGachaBanner(shopId),
    name: gameType === "hsr" ? "Merch Event Warp" : "Merch Event Wish",
    theme: gameType === "hsr" ? ("physical" as const) : ("anemo" as const),
    display_limit: normalizeGachaDisplayLimit(
      gameType === "hsr" ? 4 : 3,
      gameType,
    ),
  };
  const settings = configuration?.settings ?? {
    ...defaultGachaSettings(shopId),
    game_type: gameType,
    title: gameType === "hsr" ? "Warp upon the shelf" : "Wish upon the shelf",
    description:
      gameType === "hsr"
        ? "Discover a featured character or Light Cone from this shop."
        : "Meet a surprise character or discover a featured weapon from this shop.",
    legendary_pity: gameType === "hsr" ? 90 : 50,
    lightcone_legendary_pity: 80,
  };
  const banners = normalizeGachaBanners(
    configuration?.banners.length ? configuration.banners : [fallbackBanner],
    gameType,
  );
  const entries = capGachaFeaturedEntries(
    configuration?.entries ?? [],
    banners,
    gameType,
  );
  return {
    settings: { ...settings, game_type: gameType },
    banners,
    entries,
    selectedBannerId: banners[0]?.id ?? "",
  };
}

function persistedGameState(state: GachaState): GachaGameConfiguration {
  const gameType = state.settings.game_type;
  const banners = normalizeGachaBanners(state.banners, gameType);
  return {
    settings: state.settings,
    banners,
    entries: capGachaFeaturedEntries(state.entries, banners, gameType),
  };
}

type HistoryAction =
  | { type: "LOAD_STATE"; state: GachaState }
  | { type: "RESET"; initialState: GachaState }
  | {
      type: "UPDATE_STATE";
      updater: (curr: GachaState) => GachaState;
      pushHistory: boolean;
    }
  | { type: "RECORD_SNAPSHOT" }
  | { type: "UNDO" }
  | { type: "REDO" };

interface HistoryStoreState {
  past: GachaState[];
  present: GachaState | null;
  future: GachaState[];
}

function historyReducer(
  state: HistoryStoreState,
  action: HistoryAction,
): HistoryStoreState {
  switch (action.type) {
    case "LOAD_STATE":
      return {
        past: [],
        present: action.state,
        future: [],
      };
    case "RESET":
      return {
        past: [],
        present: action.initialState,
        future: [],
      };
    case "RECORD_SNAPSHOT": {
      if (!state.present) return state;
      return {
        past: [...state.past, state.present].slice(-50),
        present: state.present,
        future: [],
      };
    }
    case "UPDATE_STATE": {
      if (!state.present) return state;
      const nextPresent = action.updater(state.present);

      if (
        JSON.stringify(state.present.settings) ===
          JSON.stringify(nextPresent.settings) &&
        JSON.stringify(state.present.banners) ===
          JSON.stringify(nextPresent.banners) &&
        JSON.stringify(state.present.entries) ===
          JSON.stringify(nextPresent.entries) &&
        state.present.selectedBannerId === nextPresent.selectedBannerId
      ) {
        return state;
      }

      if (action.pushHistory) {
        return {
          past: [...state.past, state.present].slice(-49),
          present: nextPresent,
          future: [],
        };
      } else {
        return {
          ...state,
          present: nextPresent,
        };
      }
    }
    case "UNDO": {
      if (state.past.length === 0 || !state.present) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0 || !state.present) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        past: [...state.past, state.present],
        present: next,
        future: newFuture,
      };
    }
    default:
      return state;
  }
}

export function GachaManager({ shopId, shopSlug, products }: Props) {
  const [historyState, dispatch] = useReducer(historyReducer, {
    past: [],
    present: null,
    future: [],
  });
  const [initialConfigs, setInitialConfigs] = useState<GachaStatesByGame>({});
  const gameDraftsRef = useRef<GachaStatesByGame>({});
  const [workspaceSection, setWorkspaceSection] = useState<
    "setup" | "banners" | "pool"
  >("setup");
  const [query, setQuery] = useState("");
  const [poolFilter, setPoolFilter] = useState<"included" | "available">(
    "included",
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const settings = historyState.present?.settings ?? null;
  const banners = historyState.present?.banners ?? [];
  const entries = historyState.present?.entries ?? [];
  const selectedBannerId = historyState.present?.selectedBannerId ?? "";

  const hasChanges = useMemo(() => {
    if (!historyState.present) return false;
    const activeGame = historyState.present.settings.game_type;
    const drafts = {
      ...gameDraftsRef.current,
      [activeGame]: historyState.present,
    };
    return (["genshin", "hsr"] as GachaGameType[]).some((gameType) => {
      const draft = drafts[gameType];
      const initial = initialConfigs[gameType];
      if (!draft || !initial) return Boolean(draft || initial);
      return (
        JSON.stringify(persistedGameState(draft)) !==
        JSON.stringify(persistedGameState(initial))
      );
    });
  }, [initialConfigs, historyState.present]);

  const hasChangedInFocusSession = useRef(false);

  const updateState = useCallback(
    (updater: (curr: GachaState) => GachaState, pushHistory = true) => {
      dispatch({
        type: "UPDATE_STATE",
        updater,
        pushHistory,
      });
    },
    [],
  );

  const startTextEditSession = useCallback(() => {
    hasChangedInFocusSession.current = false;
  }, []);

  const handleTextChange = useCallback(
    (updater: (curr: GachaState) => GachaState) => {
      if (!hasChangedInFocusSession.current) {
        dispatch({ type: "RECORD_SNAPSHOT" });
        hasChangedInFocusSession.current = true;
      }
      dispatch({
        type: "UPDATE_STATE",
        updater,
        pushHistory: false,
      });
    },
    [],
  );

  const setBanners = useCallback(
    (nextBanners: GachaBanner[] | ((curr: GachaBanner[]) => GachaBanner[])) => {
      updateState(
        (curr) => ({
          ...curr,
          banners:
            typeof nextBanners === "function"
              ? nextBanners(curr.banners)
              : nextBanners,
        }),
        true,
      );
    },
    [updateState],
  );

  const setEntries = useCallback(
    (
      nextEntries:
        | GachaPoolEntry[]
        | ((curr: GachaPoolEntry[]) => GachaPoolEntry[]),
    ) => {
      updateState(
        (curr) => ({
          ...curr,
          entries:
            typeof nextEntries === "function"
              ? nextEntries(curr.entries)
              : nextEntries,
        }),
        true,
      );
    },
    [updateState],
  );

  const setSelectedBannerId = useCallback(
    (id: string | ((curr: string) => string)) => {
      updateState(
        (curr) => ({
          ...curr,
          selectedBannerId:
            typeof id === "function" ? id(curr.selectedBannerId) : id,
        }),
        false,
      );
    },
    [updateState],
  );

  const resetChanges = useCallback(() => {
    const gameType = historyState.present?.settings.game_type;
    const initial = gameType ? initialConfigs[gameType] : null;
    if (!gameType || !initial) return;
    gameDraftsRef.current[gameType] = initial;
    dispatch({ type: "RESET", initialState: initial });
  }, [historyState.present?.settings.game_type, initialConfigs]);

  const stateRef = useRef({
    past: historyState.past,
    future: historyState.future,
  });
  useEffect(() => {
    stateRef.current = { past: historyState.past, future: historyState.future };
  }, [historyState.past, historyState.future]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      if (modifier && !event.altKey) {
        if (event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) {
            if (stateRef.current.future.length > 0) {
              dispatch({ type: "REDO" });
            }
          } else {
            if (stateRef.current.past.length > 0) {
              dispatch({ type: "UNDO" });
            }
          }
        } else if (event.key.toLowerCase() === "y") {
          event.preventDefault();
          if (stateRef.current.future.length > 0) {
            dispatch({ type: "REDO" });
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  const toast = useToast();
  const { t } = usePlatformI18n();
  const gameType = settings?.game_type ?? "genshin";

  const kindOptions = useMemo<SelectMenuOption[]>(
    () => [
      {
        value: "character",
        label: t("Character"),
        icon: <UserRound size={15} />,
      },
      {
        value: gameType === "hsr" ? "lightcone" : "weapon",
        label: gameType === "hsr" ? t("Light Cone") : t("Weapon"),
        icon: <Sword size={15} />,
      },
    ],
    [gameType, t],
  );

  const weaponOptions = useMemo<SelectMenuOption[]>(() => {
    const list =
      gameType === "hsr"
        ? [
            "destruction",
            "hunt",
            "erudition",
            "harmony",
            "nihility",
            "preservation",
            "abundance",
          ]
        : ["sword", "claymore", "polearm", "bow", "catalyst"];
    return list.map((value) => ({
      value,
      label: t(value[0].toUpperCase() + value.slice(1)),
    }));
  }, [gameType, t]);

  const elementOptions = useMemo<SelectMenuOption[]>(() => {
    const list =
      gameType === "hsr"
        ? [
            "physical",
            "fire",
            "ice",
            "lightning",
            "wind",
            "quantum",
            "imaginary",
          ]
        : ["anemo", "geo", "electro", "dendro", "hydro", "pyro", "cryo"];
    return list.map((value) => ({
      value,
      label: t(value[0].toUpperCase() + value.slice(1)),
      icon: <GachaElementIcon element={value} size={18} />,
    }));
  }, [gameType, t]);

  const displayLimitOptions = useMemo<SelectMenuOption[]>(
    () =>
      Array.from(
        { length: getGachaFeaturedItemLimit(gameType) },
        (_, index) => index + 1,
      ).map((value) => ({
        value: String(value),
        label:
          gameType === "hsr"
            ? value === 1
              ? t("1 primary item")
              : t("1 primary + {{count}} secondary", { count: value - 1 })
            : t(value === 1 ? "1 featured item" : "{{count}} featured items", {
                count: value,
              }),
      })),
    [gameType, t],
  );

  const load = useCallback(async () => {
    const next = await getAdminGachaConfiguration(shopId);
    const configs = (
      ["genshin", "hsr"] as GachaGameType[]
    ).reduce<GachaStatesByGame>((states, gameType) => {
      const state = createGameState(
        shopId,
        gameType,
        next.configurations[gameType],
      );
      state.entries = capGachaFeaturedEntries(
        state.entries,
        state.banners,
        gameType,
      );
      states[gameType] = state;
      return states;
    }, {});
    setInitialConfigs(configs);
    gameDraftsRef.current = configs;
    dispatch({
      type: "LOAD_STATE",
      state:
        configs[next.settings.game_type] ??
        createGameState(shopId, next.settings.game_type),
    });
  }, [shopId]);

  const switchGame = useCallback(
    (gameType: GachaGameType) => {
      const current = historyState.present;
      if (!current || current.settings.game_type === gameType) return;
      gameDraftsRef.current[current.settings.game_type] = current;
      const target =
        gameDraftsRef.current[gameType] ?? createGameState(shopId, gameType);
      gameDraftsRef.current[gameType] = target;
      dispatch({ type: "LOAD_STATE", state: target });
    },
    [historyState.present, shopId],
  );

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((error) =>
        toast.error(
          t(getErrorMessage(error, "Could not load the minigame.")),
          t("Gacha unavailable"),
        ),
      )
      .finally(() => setLoading(false));
  }, [load, t, toast]);

  const selectedBanner = banners.find(
    (banner) => banner.id === selectedBannerId,
  );
  const selectedEntries = entries.filter(
    (entry) => entry.banner_id === selectedBannerId,
  );
  const entriesByProduct = useMemo(
    () => new Map(selectedEntries.map((entry) => [entry.product_id, entry])),
    [selectedEntries],
  );
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const searched = normalized
      ? products.filter((product) =>
          [
            product.name,
            product.item_code,
            product.category,
            product.collection,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
        )
      : products;
    const filtered = searched.filter((product) => {
      return poolFilter === "included"
        ? entriesByProduct.has(product.id)
        : !entriesByProduct.has(product.id);
    });
    return [...filtered].sort(
      (a, b) =>
        Number(entriesByProduct.has(b.id)) - Number(entriesByProduct.has(a.id)),
    );
  }, [entriesByProduct, poolFilter, products, query]);

  function updateBanner(changes: Partial<GachaBanner>) {
    const isTextChange = "name" in changes || "description" in changes;
    const updater = (curr: GachaState) => ({
      ...curr,
      banners: curr.banners.map((banner) =>
        banner.id === curr.selectedBannerId
          ? { ...banner, ...changes }
          : banner,
      ),
    });
    if (isTextChange) {
      handleTextChange(updater);
    } else {
      updateState(updater, true);
    }
  }

  function updateDisplayLimit(displayLimit: number) {
    const normalizedLimit = normalizeGachaDisplayLimit(displayLimit, gameType);
    updateBanner({ display_limit: normalizedLimit });
    setEntries((current) =>
      capGachaFeaturedEntries(
        current,
        banners.map((banner) =>
          banner.id === selectedBannerId
            ? { ...banner, display_limit: normalizedLimit }
            : banner,
        ),
        gameType,
      ),
    );
  }

  function addBanner(source?: GachaBanner) {
    const banner = {
      ...(source ?? defaultGachaBanner(shopId)),
      id: crypto.randomUUID(),
      name: source ? `${source.name} copy` : `Banner ${banners.length + 1}`,
      theme: source?.theme ?? (gameType === "hsr" ? "physical" : "anemo"),
      display_limit: normalizeGachaDisplayLimit(
        source?.display_limit ?? (gameType === "hsr" ? 4 : 3),
        gameType,
      ),
      sort_order: banners.length,
    };
    setBanners((current) => [...current, banner]);
    if (source) {
      setEntries((current) => [
        ...current,
        ...current
          .filter((entry) => entry.banner_id === source.id)
          .map((entry) => ({ ...entry, banner_id: banner.id })),
      ]);
    }
    setSelectedBannerId(banner.id);
  }

  function removeBanner() {
    if (!selectedBanner || banners.length === 1) return;
    const next = banners.filter((banner) => banner.id !== selectedBanner.id);
    setBanners(next);
    setEntries((current) =>
      current.filter((entry) => entry.banner_id !== selectedBanner.id),
    );
    setSelectedBannerId(next[0]?.id ?? "");
  }

  function moveBanner(delta: number) {
    const index = banners.findIndex((banner) => banner.id === selectedBannerId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= banners.length) return;
    const next = [...banners];
    [next[index], next[target]] = [next[target], next[index]];
    setBanners(next.map((banner, sort_order) => ({ ...banner, sort_order })));
  }

  function toggleProduct(productId: string) {
    if (!selectedBanner) return;
    const isIncluded = entriesByProduct.has(productId);
    setEntries((current) => {
      const existing = current.some(
        (entry) =>
          entry.banner_id === selectedBanner.id &&
          entry.product_id === productId,
      );
      return existing
        ? current.filter(
            (entry) =>
              !(
                entry.banner_id === selectedBanner.id &&
                entry.product_id === productId
              ),
          )
        : [
            ...current,
            newEntry(
              shopId,
              selectedBanner.id,
              productId,
              selectedBanner.kind,
              gameType,
            ),
          ];
    });
    toast.success(t(isIncluded ? "Removed from pool." : "Added to pool."));
  }

  function updateEntry(productId: string, changes: Partial<GachaPoolEntry>) {
    const isTextChange = "weight" in changes;
    const updater = (curr: GachaState) => ({
      ...curr,
      entries: curr.entries.map((entry) =>
        entry.banner_id === curr.selectedBannerId &&
        entry.product_id === productId
          ? { ...entry, ...changes }
          : entry,
      ),
    });
    if (isTextChange) {
      handleTextChange(updater);
    } else {
      updateState(updater, true);
    }
  }

  function updateFeatured(productId: string, featured: boolean) {
    const entry = entriesByProduct.get(productId);
    if (!entry || !selectedBanner) return;
    if (featured && gameType === "hsr") {
      if (!matchesGachaBannerKind(entry, selectedBanner)) {
        toast.info(
          t("Featured items must match the HSR banner type."),
          t("Choose a matching role"),
        );
        return;
      }
      if (entry.rarity === 3) {
        toast.info(
          t("Only 5-star primary and 4-star secondary items can be featured."),
          t("Choose a featured rarity"),
        );
        return;
      }
      const sameRarityCount = activeEntries.filter(
        (candidate) =>
          candidate.featured && candidate.rarity === entry.rarity,
      ).length;
      const rarityLimit =
        entry.rarity === 5
          ? 1
          : Math.min(
              HSR_SECONDARY_FEATURED_LIMIT,
              Math.max(0, selectedBanner.display_limit - 1),
            );
      if (sameRarityCount >= rarityLimit) {
        toast.info(
          t(
            entry.rarity === 5
              ? "HSR banners support one primary 5-star item."
              : "This HSR banner has filled its 4-star rate-up slots.",
          ),
          t("Featured slots are full"),
        );
        return;
      }
    }
    if (featured && featuredCount >= selectedBanner.display_limit) {
      toast.info(
        t("This banner can show up to {{count}} featured items.", {
          count: selectedBanner.display_limit,
        }),
        t("Featured slots are full"),
      );
      return;
    }
    updateEntry(productId, {
      featured,
      active: featured ? true : entry.active,
    });
  }

  function openPreview() {
    if (!settings) return;
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );
    const previewEntries = capGachaFeaturedEntries(
      entries,
      banners,
      gameType,
    ).flatMap((entry) => {
        const product = productsById.get(entry.product_id);
        return product && entry.active ? [{ ...entry, product }] : [];
    });
    localStorage.setItem(
      `matsuri-gacha-preview-config:${shopSlug}`,
      JSON.stringify({ settings, banners, entries: previewEntries }),
    );
    window.open(
      `/s/${shopSlug}/play?preview=1`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function save() {
    if (!settings) return;
    const activeBanners = banners.filter((banner) => banner.active);
    if (
      !settings.title.trim() ||
      banners.some((banner) => !banner.name.trim())
    ) {
      toast.error(
        t("Give the minigame and every banner a title."),
        t("Check gacha settings"),
      );
      return;
    }
    if (settings.legendary_pity <= settings.rare_pity) {
      toast.error(
        t("The 5-star pity must be higher than the 4-star pity."),
        t("Check gacha settings"),
      );
      return;
    }
    if (
      settings.game_type === "hsr" &&
      settings.lightcone_legendary_pity <= settings.rare_pity
    ) {
      toast.error(
        t("The Light Cone 5-star pity must be higher than the 4-star pity."),
        t("Check warp settings"),
      );
      return;
    }
    if (
      settings.enabled &&
      activeBanners.some(
        (banner) =>
          !entries.some(
            (entry) => entry.banner_id === banner.id && entry.active,
          ),
      )
    ) {
      toast.error(
        t("Every active banner needs at least one active merch item."),
        t("Wish pool is empty"),
      );
      return;
    }
    if (
      settings.enabled &&
      settings.game_type === "hsr" &&
      activeBanners.some(
        (banner) =>
          entries.filter(
            (entry) =>
              entry.banner_id === banner.id &&
              entry.active &&
              entry.featured &&
              entry.rarity === 5 &&
              matchesGachaBannerKind(entry, banner),
          ).length !== 1,
      )
    ) {
      toast.error(
        t("Every active HSR banner needs one featured 5-star item."),
        t("Check warp settings"),
      );
      return;
    }
    setSaving(true);
    try {
      const normalizedBanners = normalizeGachaBanners(banners, gameType);
      const cappedEntries = capGachaFeaturedEntries(
        entries,
        normalizedBanners,
        gameType,
      );
      const activeState: GachaState = {
        settings,
        banners: normalizedBanners,
        entries: cappedEntries,
        selectedBannerId,
      };
      const draftStates = {
        ...gameDraftsRef.current,
        [settings.game_type]: activeState,
      };
      const configurations = (
        ["genshin", "hsr"] as GachaGameType[]
      ).reduce<GachaGameConfigurations>((configs, gameType) => {
        const state = draftStates[gameType];
        if (state) configs[gameType] = persistedGameState(state);
        return configs;
      }, {});
      await saveGachaConfiguration(
        shopId,
        settings,
        normalizedBanners,
        cappedEntries,
        configurations,
      );
      await load();
      toast.success(t("Gacha settings published."));
    } catch (error) {
      toast.error(
        t(getErrorMessage(error, "Could not save the minigame.")),
        t("Could not publish gacha"),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings || !selectedBanner) {
    return (
      <EmptyState
        tone="loading"
        icon={<LoaderCircle className="state-spinner" size={28} />}
        title={t("Loading gacha settings…")}
        message={t("Preparing the shop’s merch banners.")}
      />
    );
  }

  const activeEntries = selectedEntries.filter((entry) => entry.active);
  const featuredCount = activeEntries.filter((entry) => entry.featured).length;
  const primaryFeaturedCount = activeEntries.filter(
    (entry) => entry.featured && entry.rarity === 5,
  ).length;
  const secondaryFeaturedCount = activeEntries.filter(
    (entry) => entry.featured && entry.rarity === 4,
  ).length;
  const bannerIndex = banners.findIndex(
    (banner) => banner.id === selectedBanner.id,
  );
  const liveBannerCount = banners.filter((banner) => banner.active).length;
  const totalActiveEntries = entries.filter((entry) => entry.active).length;
  return (
    <div className="gacha-admin-page">
      <section className="gacha-workspace-overview">
        <div className="admin-filter-bar">
          <nav
            className="admin-filter-tabs gacha-workflow-nav"
            aria-label={t("Gacha setup steps")}
          >
            {(["setup", "banners", "pool"] as const).map((section, index) => (
              <button
                type="button"
                key={section}
                className={workspaceSection === section ? "active" : ""}
                aria-current={workspaceSection === section ? "step" : undefined}
                onClick={() => setWorkspaceSection(section)}
              >
                <span>
                  {t(
                    section === "setup"
                      ? "Game setup"
                      : section === "banners"
                        ? "Banners"
                        : "Prize pool",
                  )}
                </span>
                <b>
                  {section === "setup"
                    ? index + 1
                    : section === "banners"
                      ? banners.length
                      : selectedEntries.length}
                </b>
              </button>
            ))}
          </nav>
          <div className="gacha-header-actions">
            {hasChanges && (
              <span className="gacha-unsaved-badge">
                {t("Unsaved changes")}
              </span>
            )}
            <button
              type="button"
              className="icon-button"
              disabled={historyState.past.length === 0 || saving}
              onClick={() => dispatch({ type: "UNDO" })}
              title={t("Undo")}
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              disabled={historyState.future.length === 0 || saving}
              onClick={() => dispatch({ type: "REDO" })}
              title={t("Redo")}
            >
              <Redo2 size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              disabled={!hasChanges || saving}
              onClick={resetChanges}
              title={t("Reset changes")}
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={openPreview}
            >
              <Eye size={16} /> <span>{t("Preview")}</span>
            </button>
            <Button
              icon={<Save size={16} />}
              loading={saving}
              loadingText={t("Publishing…")}
              disabled={!hasChanges || saving}
              onClick={() => void save()}
            >
              {t("Publish")}
            </Button>
          </div>
        </div>

        <div className="admin-order-metrics gacha-workspace-metrics">
          <article>
            <span className="admin-metric-icon coral">
              <Gamepad2 size={19} />
            </span>
            <div>
              <small>{t("Game editor")}</small>
              <strong>{gameType === "hsr" ? "Star Rail" : "Genshin"}</strong>
              <p>
                {t(
                  settings.enabled
                    ? "Public minigame open"
                    : "Public minigame closed",
                )}
              </p>
            </div>
          </article>
          <article>
            <span className="admin-metric-icon teal">
              <Layers3 size={19} />
            </span>
            <div>
              <small>{t("Live banners")}</small>
              <strong>
                {liveBannerCount} / {banners.length}
              </strong>
              <p>{selectedBanner.name}</p>
            </div>
          </article>
          <article>
            <span className="admin-metric-icon mustard">
              <Star size={19} />
            </span>
            <div>
              <small>{t("Pool items")}</small>
              <strong>{totalActiveEntries}</strong>
              <p>
                {t("{{count}} featured on this banner", {
                  count: featuredCount,
                })}
              </p>
            </div>
          </article>
        </div>

        <div className="admin-section-heading">
          <div>
            <span>{t("Gacha workflow")}</span>
            <h2>
              {t(
                workspaceSection === "setup"
                  ? "Game setup"
                  : workspaceSection === "banners"
                    ? "Banners"
                    : "Prize pool",
              )}
            </h2>
          </div>
          <small>
            {t(
              workspaceSection === "setup"
                ? "Set the public experience."
                : workspaceSection === "banners"
                  ? "Choose what each banner shows."
                  : "Add and configure prize items.",
            )}
          </small>
        </div>
      </section>

      {workspaceSection === "setup" && (
        <AdminCard
          className="gacha-global-card"
          icon={<Gamepad2 size={18} />}
          title={t("Game setup")}
          description={t(
            "Choose the game, public copy, and advanced pity rules.",
          )}
        >
          <div className="gacha-global-rules">
            <section className="gacha-setup-section gacha-setup-basics">
              <div className="gacha-setup-section-heading">
                <span>1</span>
                <div>
                  <h3>{t("Availability & game")}</h3>
                  <p>
                    {t(
                      "Choose the simulator and whether customers can play it.",
                    )}
                  </p>
                </div>
              </div>
              <div className="gacha-setup-basics-controls">
                <div className="gacha-global-status">
                  <small>{t("Public minigame")}</small>
                  <label className="gacha-toggle">
                    <input
                      type="checkbox"
                      checked={settings.enabled}
                      onChange={(event) =>
                        updateState(
                          (curr) => ({
                            ...curr,
                            settings: {
                              ...curr.settings,
                              enabled: event.target.checked,
                            },
                          }),
                          true,
                        )
                      }
                    />
                    <span aria-hidden="true" />
                    <b>{t(settings.enabled ? "Open" : "Closed")}</b>
                  </label>
                </div>
                <DropdownField
                  label={t("Game editor")}
                  value={settings.game_type}
                  options={[
                    { value: "genshin", label: "Genshin Impact" },
                    { value: "hsr", label: "Honkai: Star Rail" },
                  ]}
                  onChange={(value) => switchGame(value as GachaGameType)}
                />
              </div>
            </section>

            <section className="gacha-setup-section gacha-setup-copy">
              <div className="gacha-setup-section-heading">
                <span>2</span>
                <div>
                  <h3>{t("Public copy")}</h3>
                  <p>
                    {t(
                      "Name the experience and briefly tell customers what they can win.",
                    )}
                  </p>
                </div>
              </div>
              <div className="gacha-rules-copy">
                <Field
                  label={t(gameType === "hsr" ? "Warp title" : "Wish title")}
                >
                  <TextInput
                    maxLength={80}
                    value={settings.title}
                    onFocus={startTextEditSession}
                    onChange={(event) =>
                      handleTextChange((curr) => ({
                        ...curr,
                        settings: {
                          ...curr.settings,
                          title: event.target.value,
                        },
                      }))
                    }
                  />
                </Field>
                <Field label={t("Introduction")}>
                  <TextArea
                    maxLength={240}
                    value={settings.description}
                    onFocus={startTextEditSession}
                    onChange={(event) =>
                      handleTextChange((curr) => ({
                        ...curr,
                        settings: {
                          ...curr.settings,
                          description: event.target.value,
                        },
                      }))
                    }
                  />
                </Field>
              </div>
            </section>

            <details className="gacha-pity-details">
              <summary>
                <span className="gacha-setup-step">3</span>
                <span>
                  <strong>{t("Pity rules")}</strong>
                  <small>{t("Advanced pull guarantees")}</small>
                </span>
                <span className="gacha-pity-values">
                  4★ {settings.rare_pity} · 5★ {settings.legendary_pity}
                  {gameType === "hsr" &&
                    ` · LC ${settings.lightcone_legendary_pity}`}
                </span>
                <ChevronDown size={17} />
              </summary>
              <div className="gacha-rules-pity">
                <Field label={t("4-star pity")}>
                  <TextInput
                    type="number"
                    min={2}
                    max={30}
                    value={settings.rare_pity}
                    onFocus={startTextEditSession}
                    onChange={(event) => {
                      const val = Number(event.target.value);
                      handleTextChange((curr) => ({
                        ...curr,
                        settings: { ...curr.settings, rare_pity: val },
                      }));
                    }}
                  />
                </Field>
                <Field
                  label={t(
                    gameType === "hsr"
                      ? "Character 5-star pity"
                      : "5-star pity",
                  )}
                >
                  <TextInput
                    type="number"
                    min={10}
                    max={100}
                    value={settings.legendary_pity}
                    onFocus={startTextEditSession}
                    onChange={(event) => {
                      const val = Number(event.target.value);
                      handleTextChange((curr) => ({
                        ...curr,
                        settings: { ...curr.settings, legendary_pity: val },
                      }));
                    }}
                  />
                </Field>
                {gameType === "hsr" && (
                  <Field label={t("Light Cone 5-star pity")}>
                    <TextInput
                      type="number"
                      min={10}
                      max={100}
                      value={settings.lightcone_legendary_pity}
                      onFocus={startTextEditSession}
                      onChange={(event) => {
                        const val = Number(event.target.value);
                        handleTextChange((curr) => ({
                          ...curr,
                          settings: {
                            ...curr.settings,
                            lightcone_legendary_pity: val,
                          },
                        }));
                      }}
                    />
                  </Field>
                )}
              </div>
            </details>
          </div>
        </AdminCard>
      )}

      {workspaceSection === "banners" && (
        <AdminCard
          className="gacha-banner-workspace"
          icon={<Layers3 size={18} />}
          title={t("Banners")}
          description={t(
            "Select a banner, edit its public copy, then choose its featured rewards.",
          )}
          action={
            <button
              type="button"
              className="button button-secondary gacha-add-banner"
              aria-label={t("Add banner")}
              onClick={() => addBanner()}
            >
              <Plus size={16} /> {t("Add banner")}
            </button>
          }
        >
          <div className="gacha-banner-list" aria-label={t("Banners")}>
            {banners.map((banner, index) => {
              const count = entries.filter(
                (entry) => entry.banner_id === banner.id && entry.active,
              ).length;
              return (
                <button
                  type="button"
                  key={banner.id}
                  className={`gacha-banner-item ${banner.id === selectedBannerId ? "active" : ""}`}
                  aria-pressed={banner.id === selectedBannerId}
                  onClick={() => setSelectedBannerId(banner.id)}
                >
                  <span className={`gacha-banner-kind ${banner.kind}`}>
                    {banner.kind !== "character" ? (
                      <Sword size={16} />
                    ) : (
                      <UserRound size={16} />
                    )}
                  </span>
                  <span>
                    <small>
                      {t("Banner {{number}}", { number: index + 1 })}
                    </small>
                    <strong>{banner.name}</strong>
                    <small>
                      {count} {t("items")} · {banner.display_limit} {t("shown")}
                    </small>
                  </span>
                  <i className={banner.active ? "is-live" : ""} />
                </button>
              );
            })}
          </div>

          <div className="gacha-banner-editor-bar">
            <div className="gacha-banner-editor-context">
              <span className={`gacha-banner-kind ${selectedBanner.kind}`}>
                {selectedBanner.kind !== "character" ? (
                  <Sword size={16} />
                ) : (
                  <UserRound size={16} />
                )}
              </span>
              <span>
                <small>{t("Editing banner")}</small>
                <strong>{selectedBanner.name}</strong>
              </span>
            </div>
            <div className="gacha-banner-editor-actions">
              <label className="gacha-mini-check banner-active">
                <input
                  type="checkbox"
                  checked={selectedBanner.active}
                  onChange={(event) =>
                    updateBanner({ active: event.target.checked })
                  }
                />
                <Sparkles size={15} /> {t("Banner active")}
              </label>
              <button
                type="button"
                className="icon-button"
                onClick={() => moveBanner(-1)}
                disabled={bannerIndex === 0}
                aria-label={t("Move banner up")}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => moveBanner(1)}
                disabled={bannerIndex === banners.length - 1}
                aria-label={t("Move banner down")}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => addBanner(selectedBanner)}
                aria-label={t("Duplicate banner")}
              >
                <Copy size={16} />
              </button>
              <button
                type="button"
                className="icon-button danger"
                onClick={removeBanner}
                disabled={banners.length === 1}
                aria-label={t("Delete banner")}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="gacha-banner-settings-grid">
            <Field
              label={t("Banner title")}
              hint="English | Tiếng Việt or [en]English[vi]Tiếng Việt"
            >
              <TextInput
                maxLength={80}
                value={selectedBanner.name}
                onFocus={startTextEditSession}
                onChange={(event) => updateBanner({ name: event.target.value })}
              />
            </Field>
            <DropdownField
              label={t("Banner type")}
              value={selectedBanner.kind}
              options={kindOptions}
              onChange={(value) =>
                updateBanner({ kind: value as GachaItemKind })
              }
            />
            <Field
              label={t("Banner copy")}
              hint="English | Tiếng Việt or [en]English[vi]Tiếng Việt"
            >
              <TextArea
                maxLength={240}
                value={selectedBanner.description}
                onFocus={startTextEditSession}
                onChange={(event) =>
                  updateBanner({ description: event.target.value })
                }
              />
            </Field>
            <DropdownField
              label={t(
                gameType === "hsr"
                  ? "Featured banner slots"
                  : "Featured items shown",
              )}
              value={String(selectedBanner.display_limit)}
              options={displayLimitOptions}
              onChange={(value) => updateDisplayLimit(Number(value))}
            />
            {gameType === "hsr" && (
              <p className="field-hint">
                {t(
                  "HSR banners show one 5-star primary and up to three 4-star rate-ups.",
                )}
              </p>
            )}
            <DropdownField
              label={t(gameType === "hsr" ? "Banner element" : "Banner theme")}
              value={selectedBanner.theme}
              options={elementOptions}
              onChange={(value) =>
                updateBanner({ theme: value as GachaElement })
              }
            />
          </div>
        </AdminCard>
      )}

      {workspaceSection === "pool" && (
        <AdminCard
          className="gacha-pool-editor"
          icon={<Star size={18} />}
          title={t(gameType === "hsr" ? "Warp pool" : "Wish pool")}
          description={t(
            "Add merch, then tune rarity, role, and featured placement.",
          )}
          action={
            <div className="gacha-pool-banner-context">
              <small>{t("Current banner")}</small>
              <strong>{selectedBanner.name}</strong>
              <span>
                {featuredCount}/{selectedBanner.display_limit} {t("featured")}
              </span>
            </div>
          }
        >
          <div className="gacha-pool-tools">
            <div
              className="gacha-pool-filters"
              aria-label={t("Filter pool items")}
            >
              {(["included", "available"] as const).map((filter) => (
                <button
                  type="button"
                  key={filter}
                  className={poolFilter === filter ? "active" : ""}
                  aria-pressed={poolFilter === filter}
                  onClick={() => setPoolFilter(filter)}
                >
                  {filter === "included"
                    ? t("Pool items ({{count}})", {
                        count: selectedEntries.length,
                      })
                    : t("Add products ({{count}})", {
                        count: products.filter(
                          (product) => !entriesByProduct.has(product.id),
                        ).length,
                      })}
                </button>
              ))}
            </div>
            <label className="gacha-product-search">
              <Search size={17} />
              <input
                value={query}
                placeholder={t("Search merch…")}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="gacha-product-list">
            {visibleProducts.length ? (
              visibleProducts.map((product) => {
                const entry = entriesByProduct.get(product.id);
                const image = productImage(product);
                const hsrFeaturedRoleFull = Boolean(
                  entry &&
                    gameType === "hsr" &&
                    !entry.featured &&
                    (!matchesGachaBannerKind(entry, selectedBanner) ||
                      entry.rarity === 3 ||
                      (entry.rarity === 5 && primaryFeaturedCount >= 1) ||
                      (entry.rarity === 4 &&
                        secondaryFeaturedCount >=
                          Math.min(
                            HSR_SECONDARY_FEATURED_LIMIT,
                            Math.max(0, selectedBanner.display_limit - 1),
                          ))),
                );
                const featuredSelectionDisabled = Boolean(
                  entry &&
                    (!product.active ||
                      (!entry.featured &&
                        (featuredCount >= selectedBanner.display_limit ||
                          hsrFeaturedRoleFull))),
                );
                const identity = (
                  <span className="gacha-product-identity gacha-product-identity-compact">
                    <span className="gacha-product-image">
                      {image ? (
                        <img
                          src={image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Sparkles size={20} />
                      )}
                    </span>
                    <span className="gacha-product-copy">
                      <strong>{product.name}</strong>
                      <small>{product.item_code || product.category}</small>
                    </span>
                  </span>
                );

                if (!entry) {
                  return (
                    <article
                      key={product.id}
                      className={`gacha-product-row is-available ${!product.active ? "is-inactive" : ""}`}
                    >
                      <div className="gacha-product-identity">
                        {identity}
                        {!product.active && (
                          <span className="admin-badge-hidden">
                            {t("Hidden")}
                          </span>
                        )}
                        <button
                          type="button"
                          className="gacha-pool-membership add"
                          disabled={!product.active}
                          onClick={() => toggleProduct(product.id)}
                        >
                          <Plus size={15} /> {t("Add to pool")}
                        </button>
                      </div>
                    </article>
                  );
                }

                return (
                  <details
                    key={product.id}
                    className={`gacha-product-row is-included ${!product.active ? "is-inactive" : ""}`}
                  >
                    <summary className="gacha-product-summary">
                      {identity}
                      <span className="gacha-product-reward">
                        <small>{t("Reward setup")}</small>
                        <span>
                          <b className={`rarity-${entry.rarity}`}>
                            {entry.rarity}★
                          </b>
                          {entry.kind === "character" && (
                            <GachaElementIcon
                              element={entry.element}
                              size={20}
                            />
                          )}
                          <strong>
                            {t(
                              entry.kind === "character"
                                ? entry.element[0].toUpperCase() +
                                    entry.element.slice(1)
                                : entry.weapon_type[0].toUpperCase() +
                                    entry.weapon_type.slice(1),
                            )}
                          </strong>
                          <em>
                            {t(
                              entry.kind === "character"
                                ? "Character"
                                : gameType === "hsr"
                                  ? "Light Cone"
                                  : "Weapon",
                            )}
                          </em>
                        </span>
                      </span>
                      <span className="gacha-product-summary-tags">
                        {entry.featured && (
                          <span className="featured">
                            {t(
                              gameType === "hsr"
                                ? entry.rarity === 5
                                  ? "Primary"
                                  : "Rate-up"
                                : "Featured",
                            )}
                          </span>
                        )}
                        <span className={entry.active ? "active" : "inactive"}>
                          {t(entry.active ? "Active" : "Inactive")}
                        </span>
                      </span>
                      <span className="gacha-product-edit-label">
                        {t("Configure")} <ChevronDown size={16} />
                      </span>
                    </summary>
                    <div
                      className={`gacha-product-controls ${!product.active ? "is-disabled" : ""}`}
                    >
                      <DropdownField
                        label={t("Role")}
                        value={entry.kind}
                        options={kindOptions}
                        disabled={!product.active}
                        onChange={(value) =>
                          updateEntry(product.id, {
                            kind: value as GachaItemKind,
                            featured:
                              gameType === "hsr" && entry.featured
                                ? false
                                : entry.featured,
                          })
                        }
                      />
                      <DropdownField
                        label={t("Rarity")}
                        value={String(entry.rarity)}
                        options={rarityOptions}
                        disabled={!product.active}
                        onChange={(value) =>
                          updateEntry(product.id, {
                            rarity: Number(value) as GachaRarity,
                            featured:
                              gameType === "hsr" && entry.featured
                                ? false
                                : entry.featured,
                          })
                        }
                      />
                      {entry.kind === "character" ? (
                        <DropdownField
                          label={
                            gameType === "hsr"
                              ? t("Element")
                              : t("Element icon")
                          }
                          value={entry.element}
                          options={elementOptions}
                          disabled={!product.active}
                          onChange={(value) =>
                            updateEntry(product.id, {
                              element: value as GachaElement,
                            })
                          }
                        />
                      ) : (
                        <DropdownField
                          label={
                            gameType === "hsr" ? t("Path") : t("Weapon class")
                          }
                          value={entry.weapon_type}
                          options={weaponOptions}
                          disabled={!product.active}
                          onChange={(value) =>
                            updateEntry(product.id, {
                              weapon_type: value as GachaWeaponType,
                            })
                          }
                        />
                      )}
                      <Field label={t("Weight")}>
                        <TextInput
                          type="number"
                          min={1}
                          max={1000}
                          value={entry.weight}
                          disabled={!product.active}
                          onFocus={startTextEditSession}
                          onChange={(event) =>
                            updateEntry(product.id, {
                              weight: Number(event.target.value),
                            })
                          }
                        />
                      </Field>
                      <label
                        className={`gacha-mini-check ${featuredSelectionDisabled ? "is-disabled" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={entry.featured}
                          disabled={featuredSelectionDisabled}
                          onChange={(event) =>
                            updateFeatured(product.id, event.target.checked)
                          }
                        />
                        <Star size={15} />
                        {t(
                          gameType === "hsr"
                            ? entry.rarity === 5
                              ? "Primary featured"
                              : entry.rarity === 4
                                ? "Secondary rate-up"
                                : "Featured"
                            : "Featured",
                        )}
                      </label>
                      <label
                        className={`gacha-mini-check ${!product.active ? "is-disabled" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={entry.active}
                          disabled={!product.active}
                          onChange={(event) =>
                            updateEntry(product.id, {
                              active: event.target.checked,
                              featured: event.target.checked
                                ? entry.featured
                                : false,
                            })
                          }
                        />
                        {entry.kind !== "character" ? (
                          <Sword size={15} />
                        ) : (
                          <UserRound size={15} />
                        )}
                        {t("Active")}
                      </label>
                    </div>
                    <div className="gacha-product-row-footer">
                      <button
                        type="button"
                        className="gacha-pool-membership remove"
                        onClick={() => toggleProduct(product.id)}
                      >
                        <Trash2 size={14} /> {t("Remove from pool")}
                      </button>
                    </div>
                  </details>
                );
              })
            ) : (
              <EmptyState
                variant="compact"
                icon={<Search size={24} />}
                title={t("No matching merch")}
                message={t("Try another product name, code, or category.")}
              />
            )}
          </div>
        </AdminCard>
      )}
    </div>
  );
}
