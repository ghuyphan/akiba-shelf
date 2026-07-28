import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import { ToastProvider } from "../../ui/ToastProvider";
import { StaffManager } from "./StaffManager";

const apiMocks = vi.hoisted(() => ({
  deleteStaffMember: vi.fn(),
  getShopInvitations: vi.fn(),
  getStaffMembers: vi.fn(),
  inviteShopMember: vi.fn(),
  saveStaffMember: vi.fn(),
  updateShopInvitation: vi.fn(),
}));

vi.mock("../../../lib/api/staff", () => apiMocks);

describe("StaffManager", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getShopInvitations.mockResolvedValue([]);
    apiMocks.getStaffMembers.mockResolvedValue([]);
  });

  it("keeps load failures distinct from a genuinely empty team", async () => {
    const user = userEvent.setup();
    apiMocks.getStaffMembers
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce([]);

    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <StaffManager shopId="shop-1" />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Could not load staff" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No members yet")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.getByText("No members yet")).toBeInTheDocument(),
    );
  });

  it("keeps invite validation in context and returns focus to email", async () => {
    const user = userEvent.setup();
    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <StaffManager shopId="shop-1" />
        </ToastProvider>
      </PlatformI18nProvider>,
    );
    const email = await screen.findByRole("textbox", { name: "Email" });

    await user.type(email, "invalid");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    const error = await screen.findByText("Enter a valid email address.");
    expect(error).toHaveAttribute("role", "alert");
    expect(email).toHaveAttribute("aria-describedby", error.id);
    await waitFor(() => expect(email).toHaveFocus());

    await user.type(email, "@example.com");
    expect(error).not.toBeInTheDocument();
  });

  it("supports arrow-key invitation roles and contextual access labels", async () => {
    const user = userEvent.setup();
    apiMocks.getStaffMembers.mockResolvedValue([
      {
        user_id: "member-1",
        email: "staff@example.com",
        role: "staff",
        active: true,
      },
    ]);

    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <StaffManager shopId="shop-1" />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    const roleGroup = await screen.findByRole("radiogroup", {
      name: "Invitation role",
    });
    const [staffRole, adminRole] = within(roleGroup).getAllByRole("radio");
    expect(staffRole).toHaveAttribute("aria-checked", "true");
    expect(staffRole).toHaveAttribute("tabindex", "0");
    expect(adminRole).toHaveAttribute("tabindex", "-1");

    staffRole.focus();
    await user.keyboard("{ArrowRight}");
    expect(adminRole).toHaveFocus();
    expect(adminRole).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("checkbox", { name: "Access for staff@example.com" }),
    ).toBeChecked();
  });
});
