import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import { getGachaGameDescriptor } from "../../../lib/gacha/gachaGames";
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
});
