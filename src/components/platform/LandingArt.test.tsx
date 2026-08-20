import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  ArtistPaletteArt,
  BenefitBadgeArt,
  ClipboardClampArt,
  DoodleSparkleArt,
  DoodleStarArt,
  GachaCapsuleArt,
  HighlighterStrokeArt,
  PaperClipArt,
  PushPinArt,
  WashiTapeArt,
} from "./LandingArt";

describe("LandingArt components", () => {
  afterEach(cleanup);

  it("renders PaperClipArt with metallic gradient and aria-hidden", () => {
    const { container } = render(
      <PaperClipArt variant="rosegold" width={30} height={60} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("landing-art-paperclip");
  });

  it("renders PushPinArt with 3D highlight and custom color", () => {
    const { container } = render(<PushPinArt color="mint" size={32} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("landing-art-pushpin");
  });

  it("renders WashiTapeArt with torn deckled edges and patterns", () => {
    const { container } = render(
      <WashiTapeArt pattern="grid" color="rgba(244, 207, 120, 0.8)" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("landing-art-washitape");
  });

  it("renders HighlighterStrokeArt brush underline", () => {
    const { container } = render(<HighlighterStrokeArt color="#d95c64" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("landing-art-highlighter");
  });

  it("renders ClipboardClampArt for order clipboard", () => {
    const { container } = render(<ClipboardClampArt />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("landing-art-clipboard-clamp");
  });

  it("renders ArtistPaletteArt with paint dollops and brush", () => {
    const { container } = render(<ArtistPaletteArt />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("landing-art-palette");
  });

  it("renders DoodleSparkleArt and DoodleStarArt", () => {
    const { container: sparkleContainer } = render(<DoodleSparkleArt />);
    expect(sparkleContainer.querySelector("svg")).toHaveClass(
      "landing-art-sparkle",
    );

    const { container: starContainer } = render(<DoodleStarArt />);
    expect(starContainer.querySelector("svg")).toHaveClass("landing-art-star");
  });

  it("renders GachaCapsuleArt with lucky star prize", () => {
    const { container } = render(<GachaCapsuleArt size={36} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("landing-art-capsule");
  });

  it("renders BenefitBadgeArt for each kind", () => {
    const kinds: Array<"scan" | "stock" | "orders" | "style"> = [
      "scan",
      "stock",
      "orders",
      "style",
    ];
    for (const kind of kinds) {
      const { container } = render(<BenefitBadgeArt kind={kind} />);
      expect(container.querySelector("svg")).toHaveClass("benefit-badge-art");
      cleanup();
    }
  });
});
