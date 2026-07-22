import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import { ColorPicker } from "./ColorPicker";

function Harness() {
  const [value, setValue] = useState("#5f8d55");
  return <ColorPicker label="Accent" value={value} onChange={setValue} />;
}

describe("ColorPicker", () => {
  afterEach(cleanup);

  it("selects presets and accepts valid hex values without a native color input", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PlatformI18nProvider>
        <Harness />
      </PlatformI18nProvider>,
    );

    expect(container.querySelector('input[type="color"]')).toBeNull();
    await user.click(screen.getByRole("button", { name: "Accent: #5f8d55" }));
    await user.click(screen.getByRole("button", { name: "#e76f51" }));
    expect(screen.getByRole("button", { name: "Accent: #e76f51" })).toBeInTheDocument();

    const hex = screen.getByRole("textbox", { name: "Hex color" });
    await user.clear(hex);
    await user.type(hex, "#123abc");
    expect(screen.getByRole("button", { name: "Accent: #123abc" })).toBeInTheDocument();
  });
});
