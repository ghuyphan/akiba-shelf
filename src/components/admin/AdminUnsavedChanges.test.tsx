import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import {
  AdminUnsavedChangesProvider,
  useAdminNavigationGuard,
  useAdminUnsavedChanges,
} from "./AdminUnsavedChanges";

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

describe("AdminUnsavedChangesProvider", () => {
  it("requires confirmation before leaving a dirty editor", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <PlatformI18nProvider>
        <AdminUnsavedChangesProvider>
          <DirtyEditor navigate={navigate} />
        </AdminUnsavedChangesProvider>
      </PlatformI18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Leave editor" }));
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(navigate).toHaveBeenCalledOnce();
  });
});
