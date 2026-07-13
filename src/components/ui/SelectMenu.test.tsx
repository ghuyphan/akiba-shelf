import { cleanup, render, screen } from "@testing-library/react";
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
    const trigger = screen.getByRole("button", { name: "Role: Staff" });
    trigger.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
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
    const trigger = screen.getByRole("button", { name: "Role: Staff" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
