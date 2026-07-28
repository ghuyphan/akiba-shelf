import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
  useNavigate,
} from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import {
  AdminUnsavedChangesProvider,
  useAdminNavigationGuard,
  useAdminUnsavedChanges,
} from "./AdminUnsavedChanges";

afterEach(cleanup);

function DirtyEditor({ navigate }: { navigate: () => void }) {
  const [dirty, setDirty] = useState(true);
  const requestNavigation = useAdminNavigationGuard();
  useAdminUnsavedChanges("test-editor", dirty, () => setDirty(false));
  return (
    <button type="button" onClick={() => requestNavigation(navigate)}>
      Leave editor
    </button>
  );
}

function DirtyHistoryEditor() {
  const [dirty, setDirty] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  useAdminUnsavedChanges("history-editor", dirty, () => setDirty(false));
  return (
    <>
      <span>{location.search}</span>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </>
  );
}

describe("AdminUnsavedChangesProvider", () => {
  it("requires confirmation before leaving a dirty editor", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <PlatformI18nProvider>
            <AdminUnsavedChangesProvider>
              <DirtyEditor navigate={navigate} />
            </AdminUnsavedChangesProvider>
          </PlatformI18nProvider>
        ),
      },
    ]);
    render(<RouterProvider router={router} />);

    await user.click(screen.getByRole("button", { name: "Leave editor" }));
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("keeps the current location after cancelling a blocked POP", async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        {
          path: "/admin",
          element: (
            <PlatformI18nProvider>
              <AdminUnsavedChangesProvider>
                <DirtyHistoryEditor />
              </AdminUnsavedChangesProvider>
            </PlatformI18nProvider>
          ),
        },
      ],
      {
        initialEntries: ["/admin", "/admin?view=products"],
        initialIndex: 1,
      },
    );
    render(<RouterProvider router={router} />);

    await user.click(screen.getByRole("button", { name: "Back" }));
    const confirmation = screen.getByRole("dialog", {
      name: "Discard unsaved changes?",
    });
    const confirmationActions = confirmation.querySelector(
      ".confirmation-dialog-actions",
    );
    expect(confirmationActions).not.toBeNull();
    await user.click(
      within(confirmationActions as HTMLElement).getByRole("button", {
        name: "Keep editing",
      }),
    );

    expect(router.state.location.search).toBe("?view=products");
    expect(screen.getByText("?view=products")).toBeInTheDocument();
  });
});
