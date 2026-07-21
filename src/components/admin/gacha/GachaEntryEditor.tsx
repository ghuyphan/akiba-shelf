import { useMemo } from "react";
import { Star, Sword, Trash2, UserRound } from "lucide-react";
import type { GachaGameDescriptor } from "../../../lib/gacha/gachaGames";
import { matchesGachaBannerKind } from "../../../lib/gacha/gachaLimits";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import type {
  GachaBanner,
  GachaElement,
  GachaItemKind,
  GachaPoolEntry,
  GachaRarity,
  GachaWeaponType,
} from "../../../types/gacha";
import { Field, TextInput } from "../../ui/Field";
import type { SelectMenuOption } from "../../ui/SelectMenu";
import { DropdownField } from "./DropdownField";
import { GachaElementIcon } from "./GachaElementIcon";

type Props = {
  entry: GachaPoolEntry;
  productActive: boolean;
  banner: GachaBanner;
  descriptor: GachaGameDescriptor;
  featuredCount: number;
  primaryFeaturedCount: number;
  secondaryFeaturedCount: number;
  onUpdateEntry: (changes: Partial<GachaPoolEntry>) => void;
  onToggleFeatured: (featured: boolean) => void;
  onRemove: () => void;
  onTextFocus: () => void;
};

const rarityOptions: SelectMenuOption[] = [3, 4, 5].map((rarity) => ({
  value: String(rarity),
  label: `${rarity}★`,
  icon: <Star size={15} />,
}));

export function GachaEntryEditor({
  entry,
  productActive,
  banner,
  descriptor,
  featuredCount,
  primaryFeaturedCount,
  secondaryFeaturedCount,
  onUpdateEntry,
  onToggleFeatured,
  onRemove,
  onTextFocus,
}: Props) {
  const { t } = usePlatformI18n();
  const gameType = descriptor.gameType;

  const kindOptions = useMemo<SelectMenuOption[]>(
    () => [
      {
        value: "character",
        label: t("Character"),
        icon: <UserRound size={15} />,
      },
      {
        value: descriptor.gearKind,
        label:
          descriptor.gearKind === "lightcone"
            ? t("Light Cone")
            : t("Weapon"),
        icon: <Sword size={15} />,
      },
    ],
    [descriptor, t],
  );

  const elementOptions = useMemo<SelectMenuOption[]>(
    () =>
      descriptor.elements.map((meta) => ({
        value: meta.id,
        label: t(meta.id[0].toUpperCase() + meta.id.slice(1)),
        icon: (
          <GachaElementIcon
            gameType={gameType}
            element={meta.id}
            size={18}
          />
        ),
      })),
    [descriptor, gameType, t],
  );

  const weaponOptions = useMemo<SelectMenuOption[]>(
    () =>
      descriptor.weaponTypes.map((value) => ({
        value,
        label: t(value[0].toUpperCase() + value.slice(1)),
      })),
    [descriptor, t],
  );

  const rule = descriptor.featuredRule;
  const roleFull =
    rule.kind === "primary-secondary" &&
    !entry.featured &&
    (!matchesGachaBannerKind(entry, banner) ||
      entry.rarity === 3 ||
      (entry.rarity === 5 && primaryFeaturedCount >= rule.primaryLimit) ||
      (entry.rarity === 4 &&
        secondaryFeaturedCount >=
          Math.min(
            rule.secondaryLimit,
            Math.max(0, banner.display_limit - rule.primaryLimit),
          )));

  const featuredSelectionDisabled =
    !productActive ||
    (!entry.featured && (featuredCount >= banner.display_limit || roleFull));

  return (
    <div
      className={`gacha-item-editor ${!productActive ? "is-disabled" : ""}`}
    >
      <DropdownField
        label={t("Role")}
        value={entry.kind}
        options={kindOptions}
        disabled={!productActive}
        onChange={(value) =>
          onUpdateEntry({
            kind: value as GachaItemKind,
            featured:
              gameType === "hsr" && entry.featured ? false : entry.featured,
          })
        }
      />
      <DropdownField
        label={t("Rarity")}
        value={String(entry.rarity)}
        options={rarityOptions}
        disabled={!productActive}
        onChange={(value) =>
          onUpdateEntry({
            rarity: Number(value) as GachaRarity,
            featured:
              gameType === "hsr" && entry.featured ? false : entry.featured,
          })
        }
      />
      {entry.kind === "character" ? (
        <DropdownField
          label={gameType === "hsr" ? t("Element") : t("Element icon")}
          value={entry.element}
          options={elementOptions}
          disabled={!productActive}
          onChange={(value) =>
            onUpdateEntry({
              element: value as GachaElement,
            })
          }
        />
      ) : (
        <DropdownField
          label={gameType === "hsr" ? t("Path") : t("Weapon class")}
          value={entry.weapon_type}
          options={weaponOptions}
          disabled={!productActive}
          onChange={(value) =>
            onUpdateEntry({
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
          disabled={!productActive}
          onFocus={onTextFocus}
          onChange={(event) =>
            onUpdateEntry({
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
          onChange={(event) => onToggleFeatured(event.target.checked)}
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
        className={`gacha-mini-check ${!productActive ? "is-disabled" : ""}`}
      >
        <input
          type="checkbox"
          checked={entry.active}
          disabled={!productActive}
          onChange={(event) =>
            onUpdateEntry({
              active: event.target.checked,
              featured: event.target.checked ? entry.featured : false,
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
      <button
        type="button"
        className="gacha-item-remove"
        onClick={onRemove}
      >
        <Trash2 size={14} /> {t("Remove from pool")}
      </button>
    </div>
  );
}
