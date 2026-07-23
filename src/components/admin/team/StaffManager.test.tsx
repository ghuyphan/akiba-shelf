import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getShopInvitations.mockResolvedValue([]);
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
});
