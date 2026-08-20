import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderDateFilterPicker } from "./OrderDateFilterPicker";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";

function renderPicker(props: Partial<React.ComponentProps<typeof OrderDateFilterPicker>> = {}) {
  const onChange = vi.fn();
  render(
    <PlatformI18nProvider>
      <OrderDateFilterPicker
        value="today"
        onChange={onChange}
        {...props}
      />
    </PlatformI18nProvider>,
  );
  return { onChange };
}

describe("OrderDateFilterPicker", () => {
  afterEach(cleanup);

  it("renders trigger with Today by default", () => {
    renderPicker({ value: "today" });
    expect(
      screen.getByRole("button", { name: /date filter: today/i }),
    ).toBeInTheDocument();
  });

  it("opens popover and allows selecting All time preset", async () => {
    const { onChange } = renderPicker({ value: "today" });
    const user = userEvent.setup();

    const trigger = screen.getByRole("button", { name: /date filter: today/i });
    await user.click(trigger);

    const allTimeBtn = screen.getByRole("button", { name: /^all time$/i });
    await user.click(allTimeBtn);

    expect(onChange).toHaveBeenCalledWith(false);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).toBeNull(),
    );
  });

  it("allows selecting a specific day from the calendar", async () => {
    const { onChange } = renderPicker({ value: "2026-08-20" });
    const user = userEvent.setup();

    const trigger = screen.getByRole("button", { name: /date filter:/i });
    await user.click(trigger);

    const day15 = screen.getByRole("button", { name: /august 15, 2026/i });
    await user.click(day15);

    expect(onChange).toHaveBeenCalledWith("2026-08-15");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).toBeNull(),
    );
  });
});
