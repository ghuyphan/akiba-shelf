import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesignerStyleOptions } from "./DesignerStyleOptions";

describe("DesignerStyleOptions", () => {
  it("exposes the selected option and reports changes", () => {
    const onChange = vi.fn();
    render(
      <DesignerStyleOptions
        options={[
          ["soft", "Soft", "Gentle surfaces"],
          ["outlined", "Outlined", "Clean and crisp"],
        ] as const}
        value="soft"
        sampleClassName={(value) => `sample-${value}`}
        translate={(value) => value}
        onChange={onChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Soft: Gentle surfaces" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      screen.getByRole("button", { name: "Outlined: Clean and crisp" }),
    );
    expect(onChange).toHaveBeenCalledWith("outlined");
  });

  it("applies dynamic sampleStyle to sample elements", () => {
    const { container } = render(
      <DesignerStyleOptions
        options={[
          ["soft", "Soft", "Gentle surfaces"],
          ["outlined", "Outlined", "Clean and crisp"],
        ] as const}
        value="soft"
        sampleClassName={(value) => `sample-${value}`}
        sampleStyle={() => ({ ["--sample-radius" as string]: "6px" })}
        translate={(value) => value}
        onChange={() => undefined}
      />,
    );

    const sample = container.querySelector(".sample-soft");
    expect(sample).toBeInTheDocument();
    expect(sample?.getAttribute("style")).toContain("--sample-radius: 6px");
  });
});
