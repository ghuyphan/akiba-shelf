import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectMenu } from "./SelectMenu";

describe("SelectMenu", () => {
  afterEach(cleanup);
  it("supports keyboard navigation, skips disabled options, and restores trigger focus", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <SelectMenu
        label="Role"
        value="staff"
        onChange={change}
        options={[
          { value: "staff", label: "Staff" },
          { value: "admin", label: "Admin", disabled: true },
          { value: "owner", label: "Owner" },
        ]}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Role: Staff" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(change).toHaveBeenCalledWith("owner");
    expect(trigger).toHaveFocus();
  });

  it("closes with Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(
      <SelectMenu
        label="Role"
        value="staff"
        onChange={() => undefined}
        options={[
          { value: "staff", label: "Staff" },
          { value: "owner", label: "Owner" },
        ]}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Role: Staff" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it("keeps fixed actions outside the scrolling option list", async () => {
    const user = userEvent.setup();
    render(
      <SelectMenu
        label="Shop"
        value="shop-a"
        onChange={() => undefined}
        options={[
          { value: "shop-a", label: "Shop A" },
          { value: "shop-b", label: "Shop B" },
          { value: "all", label: "All shops", fixed: true },
        ]}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Shop: Shop A" }));
    expect(
      screen.getByText("Shop B").closest(".select-menu-options"),
    ).not.toBeNull();
    expect(
      screen.getByText("All shops").closest(".select-menu-fixed-options"),
    ).not.toBeNull();
  });

  it("supports typeahead from the trigger", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <SelectMenu
        label="Bank"
        value="a"
        onChange={change}
        options={[
          { value: "a", label: "A Bank" },
          { value: "m", label: "Matsuri Bank" },
          { value: "z", label: "Zen Bank" },
        ]}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Bank: A Bank" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("z");
    await user.keyboard("{Enter}");
    expect(change).toHaveBeenCalledWith("z");
  });
});
