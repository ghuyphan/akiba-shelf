import { ChevronDown, Gamepad2 } from "lucide-react";
import type { GachaGameDescriptor } from "../../../lib/gachaGames";
import { usePlatformI18n } from "../../../lib/platformI18n";
import type { GachaSettings } from "../../../types/gacha";
import { Field, TextArea, TextInput } from "../../ui/Field";
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

export function GachaGeneralSection({
  settings,
  descriptor,
  onUpdateSettings,
  onTextFocus,
}: Props) {
  const { t } = usePlatformI18n();

  return (
    <AdminCard
      className="gacha-setup-card"
      icon={<Gamepad2 size={18} />}
      title={t("Game setup")}
      description={t(
        "Availability, public copy, rates, and pity rules for this game.",
      )}
    >
      <div className="gacha-setup-grid">
        <section className="gacha-panel">
          <header className="gacha-panel-heading">
            <h3>{t("Availability")}</h3>
            <p>{t("Turn this minigame on or off for customers.")}</p>
          </header>
          <div
            className={`gacha-availability ${settings.enabled ? "is-open" : ""}`}
          >
            <label className="gacha-toggle">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) =>
                  onUpdateSettings({ enabled: event.target.checked })
                }
              />
              <span aria-hidden="true" />
            </label>
            <span className="gacha-availability-copy">
              <strong>{t(settings.enabled ? "Open" : "Closed")}</strong>
              <small>
                {t(
                  settings.enabled
                    ? "Customers can play from the storefront."
                    : "Only staff can preview it until you open it.",
                )}
              </small>
            </span>
          </div>
          <p className="gacha-panel-note">
            {t("Each game keeps its own banners and prize pool.")}
          </p>
        </section>

        <section className="gacha-panel">
          <header className="gacha-panel-heading">
            <h3>{t("Public copy")}</h3>
            <p>
              {t(
                "Name the experience and briefly tell customers what they can win.",
              )}
            </p>
          </header>
          <div className="gacha-copy-fields">
            <Field label={t("Minigame title")}>
              <TextInput
                maxLength={80}
                value={settings.title}
                onFocus={onTextFocus}
                onChange={(event) =>
                  onUpdateSettings({ title: event.target.value }, true)
                }
              />
            </Field>
            <Field label={t("Introduction")}>
              <TextArea
                maxLength={240}
                value={settings.description}
                onFocus={onTextFocus}
                onChange={(event) =>
                  onUpdateSettings({ description: event.target.value }, true)
                }
              />
            </Field>
          </div>
        </section>

        <details className="gacha-pity">
          <summary>
            <span className="gacha-pity-heading">
              <strong>{t("Rates and pity rules")}</strong>
              <small>
                {t("Base odds and maximum pulls before each guarantee.")}
              </small>
            </span>
            <span className="gacha-pity-values">
              <span>4★ · {settings.rare_pity}</span>
              <span>5★ · {settings.legendary_pity}</span>
              {descriptor.hasLightconePity && (
                <span>LC 5★ · {settings.lightcone_legendary_pity}</span>
              )}
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="gacha-pity-fields">
            <Field
              label={t("4-star base rate")}
              hint={t("Chance per pull before pity increases the rate.")}
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
              hint={t("Chance per pull before pity increases the rate.")}
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
                hint={t("Chance per pull before pity increases the rate.")}
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
              label={t("4-star pity")}
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
              label={t("4-star soft pity")}
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
                  ? "Character 5-star pity"
                  : "5-star pity",
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
                  ? "Character 5-star soft pity"
                  : "5-star soft pity",
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
                  label={t("Light Cone 5-star pity")}
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
                  label={t("Light Cone 5-star soft pity")}
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
              label={t("Featured-item rate")}
              hint={t("Chance that a 4-star or 5-star pull uses its featured pool.")}
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
            <Field
              label={t("Featured guarantee")}
              hint={t("After a non-featured pull, guarantee the next item of that rarity is featured.")}
            >
              <label className="gacha-toggle">
                <input
                  type="checkbox"
                  checked={settings.featured_guaranteed_after_loss}
                  onChange={(event) =>
                    onUpdateSettings({
                      featured_guaranteed_after_loss: event.target.checked,
                    })
                  }
                />
                <span aria-hidden="true" />
              </label>
            </Field>
          </div>
        </details>
      </div>
    </AdminCard>
  );
}
