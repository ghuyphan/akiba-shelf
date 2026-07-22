import { ChevronDown, Sparkles } from "lucide-react";
import {
  GACHA_PRESETS,
  type GachaGameDescriptor,
} from "../../../lib/gacha/gachaGames";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import type { GachaSettings } from "../../../types/gacha";
import { Field, FieldLabel, TextInput } from "../../ui/Field";
import { AdminCard } from "../AdminCard";

type Props = {
  settings: GachaSettings;
  descriptor: GachaGameDescriptor;
  onUpdateSettings: (
    changes: Partial<GachaSettings>,
    asTextEdit?: boolean,
  ) => void;
  onTextFocus: () => void;
};

export function GachaLuckSection({
  settings,
  descriptor,
  onUpdateSettings,
  onTextFocus,
}: Props) {
  const { t } = usePlatformI18n();

  return (
    <AdminCard
      className="gacha-luck-card"
      icon={<Sparkles size={18} />}
      title={t("3 · Luck & guarantees")}
      description={t(
        "Start with a simple preset. Advanced odds stay out of the way until needed.",
      )}
    >
      <details className="gacha-luck-disclosure">
        <summary>
          <span>
            <strong>{t("Review luck settings")}</strong>
            <small>
              {t("5★ guaranteed by pull #{{count}}", {
                count: settings.legendary_pity,
              })}
            </small>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>

        <div className="gacha-luck-content">
          <div className="gacha-presets-section">
            <span className="gacha-presets-title">
              <Sparkles size={14} aria-hidden="true" />
              {t("Choose a preset")}
            </span>
            <div
              className="gacha-preset-grid"
              role="radiogroup"
              aria-label={t("Odds presets")}
            >
              {(["booth_fast", "official"] as const).map((presetId) => {
                const preset = GACHA_PRESETS[descriptor.gameType][presetId];
                const isActive =
                  settings.legendary_pity === preset.settings.legendary_pity &&
                  settings.rare_pity === preset.settings.rare_pity;
                return (
                  <button
                    key={presetId}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`gacha-preset-card ${isActive ? "is-active" : ""}`}
                    onClick={() => onUpdateSettings(preset.settings)}
                  >
                    <strong>{t(preset.name)}</strong>
                    <small>{t(preset.description)}</small>
                  </button>
                );
              })}
            </div>
            <p className="gacha-preset-summary">
              <span>
                {t("4★ guaranteed by pull #{{count}}", {
                  count: settings.rare_pity,
                })}
              </span>
              <span>
                {t("5★ guaranteed by pull #{{count}}", {
                  count: settings.legendary_pity,
                })}
              </span>
              {descriptor.hasLightconePity && (
                <span>
                  {t("Light Cone 5★ guaranteed by pull #{{count}}", {
                    count: settings.lightcone_legendary_pity,
                  })}
                </span>
              )}
            </p>
          </div>

          <details className="gacha-pity">
            <summary>
              <div className="gacha-pity-summary-content">
                <span className="gacha-pity-heading">
                  <strong>{t("Customize odds")}</strong>
                  <small>
                    {t(
                      "Fine-tune base rates, luck ramps, and promoted-prize rules.",
                    )}
                  </small>
                </span>
                <span className="gacha-pity-values">
                  <span>4★ · {settings.rare_pity}</span>
                  <span>5★ · {settings.legendary_pity}</span>
                  {descriptor.hasLightconePity && (
                    <span>LC 5★ · {settings.lightcone_legendary_pity}</span>
                  )}
                </span>
              </div>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>

            <div className="gacha-pity-fields">
              <Field
                label={t("4-star base rate")}
                hint={t("Chance per pull before luck starts improving.")}
              >
                <TextInput
                  type="number"
                  min={0.01}
                  max={99.99}
                  step={0.1}
                  value={settings.rare_base_rate}
                  onFocus={onTextFocus}
                  onChange={(event) =>
                    onUpdateSettings(
                      { rare_base_rate: Number(event.target.value) },
                      true,
                    )
                  }
                />
              </Field>
              <Field
                label={t(
                  descriptor.hasLightconePity
                    ? "Character 5-star base rate"
                    : "5-star base rate",
                )}
                hint={t("Chance per pull before luck starts improving.")}
              >
                <TextInput
                  type="number"
                  min={0.01}
                  max={99.99}
                  step={0.1}
                  value={settings.legendary_base_rate}
                  onFocus={onTextFocus}
                  onChange={(event) =>
                    onUpdateSettings(
                      { legendary_base_rate: Number(event.target.value) },
                      true,
                    )
                  }
                />
              </Field>
              {descriptor.hasLightconePity && (
                <Field
                  label={t("Light Cone 5-star base rate")}
                  hint={t("Chance per pull before luck starts improving.")}
                >
                  <TextInput
                    type="number"
                    min={0.01}
                    max={99.99}
                    step={0.1}
                    value={settings.lightcone_legendary_base_rate}
                    onFocus={onTextFocus}
                    onChange={(event) =>
                      onUpdateSettings(
                        {
                          lightcone_legendary_base_rate: Number(
                            event.target.value,
                          ),
                        },
                        true,
                      )
                    }
                  />
                </Field>
              )}
              <Field
                label={t("4★ guaranteed within N pulls")}
                hint={t("Guarantee a 4-star or higher within this many pulls.")}
              >
                <TextInput
                  type="number"
                  min={2}
                  max={30}
                  value={settings.rare_pity}
                  onFocus={onTextFocus}
                  onChange={(event) => {
                    const rarePity = Number(event.target.value);
                    onUpdateSettings(
                      {
                        rare_pity: rarePity,
                        rare_soft_pity: Math.min(
                          settings.rare_soft_pity,
                          rarePity - 1,
                        ),
                      },
                      true,
                    );
                  }}
                />
              </Field>
              <Field
                label={t("4★ luck improves after pull #")}
                hint={t("Start increasing the 4-star rate from this pull.")}
              >
                <TextInput
                  type="number"
                  min={1}
                  max={settings.rare_pity - 1}
                  value={settings.rare_soft_pity}
                  onFocus={onTextFocus}
                  onChange={(event) =>
                    onUpdateSettings(
                      { rare_soft_pity: Number(event.target.value) },
                      true,
                    )
                  }
                />
              </Field>
              <Field
                label={t(
                  descriptor.hasLightconePity
                    ? "Character 5★ guaranteed within N pulls"
                    : "5★ guaranteed within N pulls",
                )}
                hint={t("Guarantee a 5-star within this many pulls.")}
              >
                <TextInput
                  type="number"
                  min={10}
                  max={100}
                  value={settings.legendary_pity}
                  onFocus={onTextFocus}
                  onChange={(event) => {
                    const legendaryPity = Number(event.target.value);
                    onUpdateSettings(
                      {
                        legendary_pity: legendaryPity,
                        legendary_soft_pity: Math.min(
                          settings.legendary_soft_pity,
                          legendaryPity - 1,
                        ),
                      },
                      true,
                    );
                  }}
                />
              </Field>
              <Field
                label={t(
                  descriptor.hasLightconePity
                    ? "Character 5★ luck improves after pull #"
                    : "5★ luck improves after pull #",
                )}
                hint={t("Start increasing the 5-star rate from this pull.")}
              >
                <TextInput
                  type="number"
                  min={1}
                  max={settings.legendary_pity - 1}
                  value={settings.legendary_soft_pity}
                  onFocus={onTextFocus}
                  onChange={(event) =>
                    onUpdateSettings(
                      { legendary_soft_pity: Number(event.target.value) },
                      true,
                    )
                  }
                />
              </Field>
              {descriptor.hasLightconePity && (
                <>
                  <Field
                    label={t("Light Cone 5★ guaranteed within N pulls")}
                    hint={t("Guarantee a 5-star within this many pulls.")}
                  >
                    <TextInput
                      type="number"
                      min={10}
                      max={100}
                      value={settings.lightcone_legendary_pity}
                      onFocus={onTextFocus}
                      onChange={(event) => {
                        const lightconePity = Number(event.target.value);
                        onUpdateSettings(
                          {
                            lightcone_legendary_pity: lightconePity,
                            lightcone_legendary_soft_pity: Math.min(
                              settings.lightcone_legendary_soft_pity,
                              lightconePity - 1,
                            ),
                          },
                          true,
                        );
                      }}
                    />
                  </Field>
                  <Field
                    label={t("Light Cone 5★ luck improves after pull #")}
                    hint={t("Start increasing the 5-star rate from this pull.")}
                  >
                    <TextInput
                      type="number"
                      min={1}
                      max={settings.lightcone_legendary_pity - 1}
                      value={settings.lightcone_legendary_soft_pity}
                      onFocus={onTextFocus}
                      onChange={(event) =>
                        onUpdateSettings(
                          {
                            lightcone_legendary_soft_pity: Number(
                              event.target.value,
                            ),
                          },
                          true,
                        )
                      }
                    />
                  </Field>
                </>
              )}
              <Field
                label={t("Promoted-prize chance")}
                hint={t(
                  "Chance that a 4★ or 5★ pull lands on a promoted prize.",
                )}
              >
                <TextInput
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.featured_item_rate}
                  onFocus={onTextFocus}
                  onChange={(event) =>
                    onUpdateSettings(
                      { featured_item_rate: Number(event.target.value) },
                      true,
                    )
                  }
                />
              </Field>
              <div className="field">
                <FieldLabel>
                  {t("Guarantee promoted prize after a miss")}
                </FieldLabel>
                <label className="gacha-toggle">
                  <input
                    type="checkbox"
                    aria-label={t("Guarantee promoted prize after a miss")}
                    checked={settings.featured_guaranteed_after_loss}
                    onChange={(event) =>
                      onUpdateSettings({
                        featured_guaranteed_after_loss: event.target.checked,
                      })
                    }
                  />
                  <span aria-hidden="true" />
                </label>
                <span className="field-hint">
                  {t(
                    "After a 4★ or 5★ pull misses the promoted prize, the next one is guaranteed.",
                  )}
                </span>
              </div>
            </div>
          </details>
        </div>
      </details>
    </AdminCard>
  );
}
