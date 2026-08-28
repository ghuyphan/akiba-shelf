import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatsuriIcon, type MatsuriIconName } from "./MatsuriIcon";

describe("MatsuriIcon", () => {
  const iconNames: MatsuriIconName[] = [
    "gacha-capsule",
    "tote-bag",
    "booth-awning",
    "lantern",
    "star-sparkle",
    "acrylic-stand",
    "pin-badge",
    "art-print",
  ];

  it.each(iconNames)("renders the %s icon correctly", (name) => {
    const { container } = render(<MatsuriIcon name={name} size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveClass(`matsuri-icon-${name}`);
  });

  it("applies custom class names and accessibility attributes", () => {
    const { container } = render(
      <MatsuriIcon
        name="gacha-capsule"
        className="custom-capsule"
        aria-label="Play Gacha"
        aria-hidden={false}
      />
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("custom-capsule");
    expect(svg).toHaveAttribute("aria-label", "Play Gacha");
    expect(svg).toHaveAttribute("aria-hidden", "false");
  });
});
