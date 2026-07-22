import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import { DateTimeInput } from "./DateTimeInput";

function Harness() {
  const [value, setValue] = useState("2026-07-22T10:30");
  return (
    <>
      <DateTimeInput label="Event starts" value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe("DateTimeInput", () => {
  afterEach(cleanup);

  it("chooses a date and time without a native datetime input", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PlatformI18nProvider>
        <Harness />
      </PlatformI18nProvider>,
    );

    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    await user.click(screen.getByRole("button", { name: /Event starts:/ }));
    await user.click(screen.getByRole("button", { name: "23" }));
    await user.click(screen.getByRole("button", { name: "Hour: 10" }));
    await user.click(screen.getByRole("option", { name: "11" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByTestId("value")).toHaveTextContent("2026-07-23T11:30");
  });

  it("clears an optional schedule with its custom action", async () => {
    const user = userEvent.setup();
    render(
      <PlatformI18nProvider>
        <Harness />
      </PlatformI18nProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Clear Event starts" }));
    expect(screen.getByTestId("value")).toBeEmptyDOMElement();
  });
});
