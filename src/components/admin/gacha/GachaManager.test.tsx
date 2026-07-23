import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import { ToastProvider } from "../../ui/ToastProvider";
import { GachaManager } from "./GachaManager";

const apiMocks = vi.hoisted(() => ({
  getAdminGachaConfiguration: vi.fn(),
  publishGachaConfiguration: vi.fn(),
  saveGachaDraft: vi.fn(),
}));

vi.mock("../../../lib/api/gacha", () => apiMocks);

const workspace = { configurations: {}, liveByGame: {} };

function renderManager() {
  return render(
    <PlatformI18nProvider>
      <ToastProvider enabled={false}>
        <GachaManager shopId="shop-id" shopSlug="shop" products={[]} />
      </ToastProvider>
    </PlatformI18nProvider>,
  );
}

describe("GachaManager recovery and safety", () => {
  afterEach(cleanup);

  beforeEach(() => {
    apiMocks.getAdminGachaConfiguration.mockReset();
    apiMocks.publishGachaConfiguration.mockReset();
    apiMocks.saveGachaDraft.mockReset();
    apiMocks.getAdminGachaConfiguration.mockResolvedValue(workspace);
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("shows a persistent load error and retries the workspace request", async () => {
    const user = userEvent.setup();
    apiMocks.getAdminGachaConfiguration
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(workspace);

    renderManager();

    expect(
      await screen.findByRole("heading", { name: "Gacha unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Network unavailable")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry loading" }));

    expect(
      await screen.findByRole("heading", { name: "1 · Status & copy" }),
    ).toBeInTheDocument();
    expect(apiMocks.getAdminGachaConfiguration).toHaveBeenCalledTimes(2);
  });

  it("attaches publish validation to the invalid title and focuses it", async () => {
    const user = userEvent.setup();
    renderManager();
    const title = await screen.findByRole("textbox", {
      name: "Minigame title",
    });

    await user.clear(title);
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Give the minigame a title.")).toBeInTheDocument();
    await waitFor(() => expect(title).toHaveFocus());
    expect(apiMocks.publishGachaConfiguration).not.toHaveBeenCalled();
  });

  it("uses the shared confirmation dialog before discarding a draft", async () => {
    const user = userEvent.setup();
    renderManager();
    const title = await screen.findByRole("textbox", {
      name: "Minigame title",
    });
    await user.type(title, " updated");

    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    const dialog = screen.getByRole("dialog", { name: "Discard changes?" });
    expect(
      within(dialog).getByText(
        "Discard all unpublished changes for this game?",
      ),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByText("Keep editing", { selector: "button span" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Discard changes?" }),
      ).not.toBeInTheDocument(),
    );
    expect(title).toHaveValue("Wish upon the shelf updated");
  });

  it("keeps autosave failures visible and supports an explicit retry", async () => {
    const user = userEvent.setup();
    apiMocks.saveGachaDraft
      .mockRejectedValueOnce(new Error("Draft sync failed"))
      .mockImplementation(async (_shopId, _gameType, config) => config);
    renderManager();
    const title = await screen.findByRole("textbox", {
      name: "Minigame title",
    });

    fireEvent.focus(title);
    await user.type(title, " updated");

    expect(
      await screen.findByText("Draft sync failed", {}, { timeout: 2500 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry saving" }));

    await waitFor(() =>
      expect(screen.queryByText("Draft sync failed")).not.toBeInTheDocument(),
    );
    expect(apiMocks.saveGachaDraft).toHaveBeenCalledTimes(2);
  });
});
