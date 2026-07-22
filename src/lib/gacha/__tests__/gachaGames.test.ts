import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getGachaGameDescriptor } from "../gachaGames";

describe("Genshin element icons", () => {
  it("keeps element paths aligned with the vendored icon font", () => {
    const font = readFileSync(
      resolve(
        process.cwd(),
        "vendor/gacha-simulator/static/fonts/genshin-icon.svg",
      ),
      "utf8",
    );

    for (const element of getGachaGameDescriptor("genshin").elements) {
      expect(element.visual.type).toBe("path");
      if (element.visual.type !== "path") continue;

      const glyph = font.match(
        new RegExp(`glyph-name="${element.id}"[^>]* d="([^"]+)"`),
      );

      expect(glyph?.[1], `${element.id} icon path`).toBe(element.visual.d);
    }
  });
});
