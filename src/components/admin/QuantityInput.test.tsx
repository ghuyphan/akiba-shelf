import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PlatformI18nProvider } from "../../lib/platformI18n";
import { QuantityInput } from "./QuantityInput";

afterEach(cleanup);

function QuantityHarness() {
  const [value, setValue] = useState(0);
  return <PlatformI18nProvider><QuantityInput value={value} onChange={setValue} /><span data-testid="stored-quantity">{value}</span></PlatformI18nProvider>;
}

describe("QuantityInput", () => {
  it("supports stepper controls", async () => {
    const user = userEvent.setup();
    render(<QuantityHarness />);

    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(screen.getByTestId("stored-quantity")).toHaveTextContent("1");
    await user.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(screen.getByTestId("stored-quantity")).toHaveTextContent("0");
  });

  it("normalizes leading zeroes and warns about unusually large stock", async () => {
    const user = userEvent.setup();
    render(<QuantityHarness />);
    const input = screen.getByPlaceholderText("0");

    await user.clear(input);
    await user.type(input, "03200");
    await user.tab();

    expect(input).toHaveValue("3200");
    expect(screen.getByText("Large quantity — double-check this number.")).toBeInTheDocument();
  });
});
