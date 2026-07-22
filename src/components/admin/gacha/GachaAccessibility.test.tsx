import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import {
  GACHA_PRESETS,
  getGachaGameDescriptor,
} from "../../../lib/gacha/gachaGames";
import { defaultGachaSettings } from "../../../types/gacha";
import { GachaGeneralSection } from "./GachaGeneralSection";
import { GachaLuckSection } from "./GachaLuckSection";

const settings = defaultGachaSettings("shop-id");

describe("gacha settings accessibility", () => {
  it("gives both toggle checkboxes explicit accessible names", () => {
    render(
      <PlatformI18nProvider>
        <GachaGeneralSection
          settings={settings}
          onUpdateSettings={vi.fn()}
          onTextFocus={vi.fn()}
        />
        <GachaLuckSection
          settings={settings}
          descriptor={getGachaGameDescriptor("genshin")}
          onUpdateSettings={vi.fn()}
          onTextFocus={vi.fn()}
        />
      </PlatformI18nProvider>,
    );

    expect(
      screen.getByRole("checkbox", { name: "Minigame availability" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: "Guarantee promoted prize after a miss",
      }),
    ).toBeInTheDocument();
  });

  it("shows custom odds when any setting differs from the selected preset", () => {
    const boothSettings = {
      ...settings,
      ...GACHA_PRESETS.genshin.booth_fast.settings,
    };
    const props = {
      descriptor: getGachaGameDescriptor("genshin"),
      onUpdateSettings: vi.fn(),
      onTextFocus: vi.fn(),
    };
    const { container, rerender } = render(
      <PlatformI18nProvider>
        <GachaLuckSection settings={boothSettings} {...props} />
      </PlatformI18nProvider>,
    );
    const luckSection = within(container);

    const boothPreset = luckSection.getByRole("radio", {
      name: /Convention Booth Mode/,
    });
    expect(boothPreset).toBeChecked();
    expect(
      luckSection.queryByText("Custom odds active"),
    ).not.toBeInTheDocument();

    rerender(
      <PlatformI18nProvider>
        <GachaLuckSection
          settings={{ ...boothSettings, rare_base_rate: 5.9 }}
          {...props}
        />
      </PlatformI18nProvider>,
    );

    expect(boothPreset).not.toBeChecked();
    expect(luckSection.getAllByText("Custom odds active")).toHaveLength(2);
  });

  it("supports arrow-key selection across the odds radio group", () => {
    const onUpdateSettings = vi.fn();
    const { container } = render(
      <PlatformI18nProvider>
        <GachaLuckSection
          settings={{
            ...settings,
            ...GACHA_PRESETS.genshin.booth_fast.settings,
          }}
          descriptor={getGachaGameDescriptor("genshin")}
          onUpdateSettings={onUpdateSettings}
          onTextFocus={vi.fn()}
        />
      </PlatformI18nProvider>,
    );
    const luckSection = within(container);

    fireEvent.keyDown(
      luckSection.getByRole("radio", { name: /Convention Booth Mode/ }),
      { key: "ArrowRight" },
    );

    expect(onUpdateSettings).toHaveBeenCalledWith(
      GACHA_PRESETS.genshin.official.settings,
    );
    expect(
      luckSection.getByRole("radio", { name: /Official Genshin Replica/ }),
    ).toHaveFocus();
  });
});
