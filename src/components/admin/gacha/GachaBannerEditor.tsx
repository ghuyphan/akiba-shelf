import { useMemo } from "react";
import { Clock3, Sparkles, Sword, UserRound } from "lucide-react";
import {
  getGachaBannerFeaturedRule,
  type GachaGameDescriptor,
} from "../../../lib/gacha/gachaGames";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import type {
  GachaBanner,
  GachaElement,
  GachaItemKind,
} from "../../../types/gacha";
import { Field, TextArea, TextInput } from "../../ui/Field";
import { Alert } from "../../ui/Alert";
import { DateTimeInput } from "../../ui/DateTimeInput";
import type { SelectMenuOption } from "../../ui/SelectMenu";
import { DropdownField } from "./DropdownField";
import { GachaElementIcon } from "./GachaElementIcon";

type Props = {
  banner: GachaBanner;
  descriptor: GachaGameDescriptor;
  error?: string;
  errorField?: "title" | "schedule";
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
  error = "",
  errorField,
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
          descriptor.gearKind === "lightcone" ? t("Light Cone") : t("Weapon"),
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
          <GachaElementIcon gameType={gameType} element={meta.id} size={18} />
        ),
      })),
    [descriptor, gameType, t],
  );

  const displayLimitOptions = useMemo<SelectMenuOption[]>(() => {
    const rule = getGachaBannerFeaturedRule(gameType, banner.kind);
    return [
      {
        value: String(rule.displayLimit),
        label: t("{{count}} slots: {{five}}×5★ + {{four}}×4★", {
          count: rule.displayLimit,
          five: rule.fiveStarLimit,
          four: rule.fourStarLimit,
        }),
      },
    ];
  }, [banner.kind, gameType, t]);

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
        {error && !errorField && (
          <Alert className="gacha-section-error" variant="error">
            {error}
          </Alert>
        )}
        <Field
          className="gacha-field-title"
          label={t("Banner title")}
          error={errorField === "title" ? error : undefined}
          hint={t(
            "Bilingual: English | Tiếng Việt or [en]English[vi]Tiếng Việt",
          )}
        >
          <TextInput
            maxLength={80}
            value={banner.name}
            aria-invalid={errorField === "title"}
            onFocus={onTextFocus}
            onChange={(event) => onUpdateBanner({ name: event.target.value })}
          />
        </Field>
        <DropdownField
          className="gacha-field-type"
          label={t("Banner type")}
          value={banner.kind}
          options={kindOptions}
          onChange={(value) => onUpdateBanner({ kind: value as GachaItemKind })}
        />
        <Field
          className="gacha-field-copy"
          label={t("Banner copy")}
          hint={t(
            "Bilingual: English | Tiếng Việt or [en]English[vi]Tiếng Việt",
          )}
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
            gameType === "hsr" ? "Featured banner slots" : "Official lineup",
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
          onChange={(value) => onUpdateBanner({ theme: value as GachaElement })}
        />
        <Field
          label={t("Banner starts")}
          hint={t("Leave empty to make it available immediately.")}
        >
          <DateTimeInput
            label={t("Banner starts")}
            value={toLocalDateTime(banner.starts_at)}
            onChange={(value) =>
              onUpdateBanner({
                starts_at: fromLocalDateTime(value),
              })
            }
          />
        </Field>
        <Field
          label={t("Banner ends")}
          hint={t("Leave empty to keep it running until you close it.")}
          error={errorField === "schedule" ? error : undefined}
        >
          <DateTimeInput
            label={t("Banner ends")}
            min={toLocalDateTime(banner.starts_at)}
            value={toLocalDateTime(banner.ends_at)}
            invalid={errorField === "schedule"}
            onChange={(value) =>
              onUpdateBanner({
                ends_at: fromLocalDateTime(value),
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
              "HSR event banners show exactly one 5-star primary and three 4-star rate-ups. Leave every featured slot empty for a standard warp.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}
