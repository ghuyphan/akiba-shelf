import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogLocaleProvider } from "../../../lib/i18n/catalogI18n";
import { CatalogToolbar } from "./CatalogToolbar";

function renderToolbar(
  overrides: Partial<React.ComponentProps<typeof CatalogToolbar>> = {},
) {
  const props: React.ComponentProps<typeof CatalogToolbar> = {
    searchQuery: "",
    onSearchChange: vi.fn(),
    sort: "recommended",
    viewMode: "grid",
    onSortChange: vi.fn(),
    onViewModeChange: vi.fn(),
    ...overrides,
  };

  render(
    <CatalogLocaleProvider locale="en">
      <CatalogToolbar {...props} />
    </CatalogLocaleProvider>,
  );
  return props;
}

describe("CatalogToolbar", () => {
  afterEach(cleanup);

  it("selects a sort option with the shared listbox keyboard behavior", async () => {
    const user = userEvent.setup();
    const props = renderToolbar();
    const trigger = screen.getByRole("button", {
      name: "Sort by: Recommended",
    });

    trigger.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(props.onSortChange).toHaveBeenCalledWith("price-asc");
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("exposes the selected grid or list view as a pressed state", async () => {
    const user = userEvent.setup();
    const props = renderToolbar({ viewMode: "list" });
    const grid = screen.getByRole("button", { name: "Grid view" });
    const list = screen.getByRole("button", { name: "List view" });

    expect(grid).toHaveAttribute("aria-pressed", "false");
    expect(list).toHaveAttribute("aria-pressed", "true");

    await user.click(grid);
    expect(props.onViewModeChange).toHaveBeenCalledWith("grid");
  });
});
