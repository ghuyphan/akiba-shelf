import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("exposes a stable tone class while preserving its label", () => {
    render(<StatusPill tone="danger">Cancelled</StatusPill>);
    expect(screen.getByText("Cancelled").parentElement).toHaveClass(
      "status-pill-danger",
    );
  });
});
