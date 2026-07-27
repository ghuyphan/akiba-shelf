import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionMenu } from "./ActionMenu";

describe("ActionMenu", () => {
  afterEach(cleanup);

  it("navigates enabled actions and restores trigger focus", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(
      <ActionMenu
        label="More actions"
        triggerIcon={<span>...</span>}
        items={[
          {
            id: "settings",
            label: "Settings",
            disabled: true,
            onSelect: () => select("settings"),
          },
          {
            id: "alerts",
            label: "Enable alerts",
            onSelect: () => select("alerts"),
          },
          {
            id: "sign-out",
            label: "Sign out",
            onSelect: () => select("sign-out"),
          },
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "More actions" });
    await user.click(trigger);
    expect(screen.getByRole("menu", { name: "More actions" })).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "Enable alerts" }),
    ).toHaveFocus();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(select).toHaveBeenCalledWith("sign-out");
    expect(trigger).toHaveFocus();
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    render(
      <ActionMenu
        label="Banner actions"
        triggerIcon={<span>...</span>}
        items={[
          {
            id: "duplicate",
            label: "Duplicate banner",
            onSelect: () => undefined,
          },
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Banner actions" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});
