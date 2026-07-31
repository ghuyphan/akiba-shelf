import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import { ColorPicker, hexToHsv, hsvToHex } from "./ColorPicker";

function Harness({
  initial = "#5f8d55",
  recommendation,
}: {
  initial?: string;
  recommendation?: ComponentProps<typeof ColorPicker>["recommendation"];
}) {
  const [value, setValue] = useState(initial);
  return (
    <ColorPicker
      label="Accent"
      value={value}
      recommendation={recommendation}
      onChange={setValue}
    />
  );
}

describe("ColorPicker", () => {
  afterEach(cleanup);

  it("selects presets, accepts hex values, and exposes the system picker", async () => {
    const user = userEvent.setup();
    render(
      <PlatformI18nProvider>
        <Harness />
      </PlatformI18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Accent: #5f8d55" }));
    expect(screen.getByLabelText("Open system color picker")).toHaveAttribute(
      "type",
      "color",
    );
    await user.click(screen.getByRole("button", { name: "#e76f51" }));
    expect(
      screen.getByRole("button", { name: "Accent: #e76f51" }),
    ).toBeInTheDocument();

    const hex = screen.getByRole("textbox", { name: "Hex color" });
    await user.clear(hex);
    await user.type(hex, "#123abc");
    expect(
      screen.getByRole("button", { name: "Accent: #123abc" }),
    ).toBeInTheDocument();
  });

  it("does not mask an invalid controlled value with the default green", async () => {
    const user = userEvent.setup();
    render(
      <PlatformI18nProvider>
        <Harness initial="invalid" />
      </PlatformI18nProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Accent: invalid" });
    expect(trigger).toHaveAttribute("data-invalid", "true");
    await user.click(trigger);
    expect(screen.getByText("Use a 3 or 6 digit hex color.")).toBeInTheDocument();
  });

  it("round-trips RGB colors through HSV", () => {
    for (const color of ["#000000", "#ffffff", "#e76f51", "#123abc"]) {
      expect(hsvToHex(hexToHsv(color))).toBe(color);
    }
  });

  it("applies an explicit accessible recommendation", async () => {
    const user = userEvent.setup();
    render(
      <PlatformI18nProvider>
        <Harness
          initial="#ffffff"
          recommendation={{
            color: "#a93945",
            label: "Recommended accessible shade",
            description: "Current contrast is too low.",
            actionLabel: "Use #a93945",
          }}
        />
      </PlatformI18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Accent: #ffffff" }));
    await user.click(screen.getByRole("button", { name: "Use #a93945" }));
    expect(
      screen.getByRole("button", { name: "Accent: #a93945" }),
    ).toBeInTheDocument();
  });
});
