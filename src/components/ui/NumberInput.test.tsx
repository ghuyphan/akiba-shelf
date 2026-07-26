import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Field } from "./Field";
import { NumberInput } from "./NumberInput";

afterEach(cleanup);

function NumberHarness({ initial = 0.6 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Field label="Rate">
        <NumberInput
          value={value}
          min={0.01}
          max={99.99}
          step={0.1}
          onChange={setValue}
        />
      </Field>
      <output data-testid="stored-value">{value}</output>
    </>
  );
}

describe("NumberInput", () => {
  it("keeps decimal typing stable instead of collapsing intermediate input to zero", async () => {
    const user = userEvent.setup();
    render(<NumberHarness />);
    const input = screen.getByRole("textbox", { name: "Rate" });

    await user.click(input);
    await user.keyboard("0.7");

    expect(input).toHaveValue("0.7");
    expect(screen.getByTestId("stored-value")).toHaveTextContent("0.7");
    expect(input).toHaveAttribute("inputmode", "decimal");
  });

  it("allows a temporary blank value and restores the bounded value on blur", async () => {
    const user = userEvent.setup();
    render(<NumberHarness initial={10} />);
    const input = screen.getByRole("textbox", { name: "Rate" });

    await user.clear(input);
    expect(input).toHaveValue("");
    expect(screen.getByTestId("stored-value")).toHaveTextContent("10");

    await user.tab();
    expect(input).toHaveValue("10");
  });

  it("replaces the current value on the first click", async () => {
    const user = userEvent.setup();
    render(<NumberHarness initial={10} />);
    const input = screen.getByRole("textbox", { name: "Rate" });

    await user.click(input);
    await user.keyboard("12");

    expect(input).toHaveValue("12");
    expect(screen.getByTestId("stored-value")).toHaveTextContent("12");
  });

  it("supports precise arrow-key stepping", async () => {
    const user = userEvent.setup();
    render(<NumberHarness />);
    const input = screen.getByRole("textbox", { name: "Rate" });

    await user.click(input);
    await user.keyboard("{ArrowUp}");

    expect(input).toHaveValue("0.7");
    expect(screen.getByTestId("stored-value")).toHaveTextContent("0.7");
  });
});
