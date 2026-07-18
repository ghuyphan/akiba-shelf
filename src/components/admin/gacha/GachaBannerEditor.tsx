import { useMemo } from "react";
import { Clock3, Sparkles, Sword, UserRound } from "lucide-react";
import type { GachaGameDescriptor } from "../../../lib/gachaGames";
import { usePlatformI18n } from "../../../lib/platformI18n";
import type { GachaBanner, GachaElement, GachaItemKind } from "../../../types/gacha";
import { Field, TextArea, TextInput } from "../../ui/Field";
import type { SelectMenuOption } from "../../ui/SelectMenu";
import { DropdownField } from "./DropdownField";
import { GachaElementIcon } from "./GachaElementIcon";

type Props = {
  banner: GachaBanner;
  descriptor: GachaGameDescriptor;
  onUpdateBanner: (changes: Partial<GachaBanner>) => void;
  onUpdateDisplayLimit: (displayLimit: number) => void;
  onTextFocus: () => void;
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function fromLocalDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function GachaBannerEditor({
  banner,
  descriptor,
  onUpdateBanner,
  onUpdateDisplayLimit,
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

  const displayLimitOptions = useMemo<SelectMenuOption[]>(
    () =>
      Array.from(
        { length: descriptor.displayLimitMax },
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
    [descriptor, gameType, t],
  );

  return (
    <div className="gacha-banner-editor">
      <header className="gacha-banner-editor-head">
        <div className="gacha-banner-editor-id">
          <span className={`gacha-banner-kind ${banner.kind}`}>
            {banner.kind !== "character" ? (
              <Sword size={16} />
            ) : (
              <UserRound size={16} />
            )}
          </span>
          <span className="gacha-banner-editor-name">
            <small>{t("Editing banner")}</small>
            <strong>{banner.name}</strong>
          </span>
        </div>
        <div className="gacha-banner-editor-actions">
          <label className="gacha-mini-check banner-active">
            <input
              type="checkbox"
              checked={banner.active}
              onChange={(event) =>
                onUpdateBanner({ active: event.target.checked })
              }
            />
            <Sparkles size={15} /> {t("Banner active")}
          </label>
        </div>
      </header>

      <div className="gacha-banner-fields">
        <Field
          className="gacha-field-title"
          label={t("Banner title")}
          hint={t("Bilingual: English | Tiếng Việt or [en]English[vi]Tiếng Việt")}
        >
          <TextInput
            maxLength={80}
            value={banner.name}
            onFocus={onTextFocus}
            onChange={(event) =>
              onUpdateBanner({ name: event.target.value })
            }
          />
        </Field>
        <DropdownField
          className="gacha-field-type"
          label={t("Banner type")}
          value={banner.kind}
          options={kindOptions}
          onChange={(value) =>
            onUpdateBanner({ kind: value as GachaItemKind })
          }
        />
        <Field
          className="gacha-field-copy"
          label={t("Banner copy")}
          hint={t("Bilingual: English | Tiếng Việt or [en]English[vi]Tiếng Việt")}
        >
          <TextArea
            maxLength={240}
            value={banner.description}
            onFocus={onTextFocus}
            onChange={(event) =>
              onUpdateBanner({ description: event.target.value })
            }
          />
        </Field>
        <DropdownField
          className="gacha-field-slots"
          label={t(
            gameType === "hsr"
              ? "Featured banner slots"
              : "Featured items shown",
          )}
          value={String(banner.display_limit)}
          options={displayLimitOptions}
          onChange={(value) => onUpdateDisplayLimit(Number(value))}
        />
        <DropdownField
          className="gacha-field-theme"
          label={t(gameType === "hsr" ? "Banner element" : "Banner theme")}
          value={banner.theme}
          options={elementOptions}
          onChange={(value) =>
            onUpdateBanner({ theme: value as GachaElement })
          }
        />
        <Field
          label={t("Banner starts")}
          hint={t("Leave empty to make it available immediately.")}
        >
          <TextInput
            type="datetime-local"
            value={toLocalDateTime(banner.starts_at)}
            onChange={(event) =>
              onUpdateBanner({
                starts_at: fromLocalDateTime(event.target.value),
              })
            }
          />
        </Field>
        <Field
          label={t("Banner ends")}
          hint={t("Leave empty to keep it running until you close it.")}
        >
          <TextInput
            type="datetime-local"
            min={toLocalDateTime(banner.starts_at)}
            value={toLocalDateTime(banner.ends_at)}
            onChange={(event) =>
              onUpdateBanner({
                ends_at: fromLocalDateTime(event.target.value),
              })
            }
          />
        </Field>
        {(banner.starts_at || banner.ends_at) && (
          <p className="field-hint gacha-schedule-hint">
            <Clock3 size={14} aria-hidden="true" />
            {t("Times use your current device timezone.")}
          </p>
        )}
        {gameType === "hsr" && (
          <p className="field-hint gacha-slots-hint">
            {t(
              "HSR banners show one 5-star primary and up to three 4-star rate-ups.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}
