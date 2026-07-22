import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultBooth, defaultPayment, defaultPromotion } from "../../lib/constants";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import {
  loadOfflineEventSession,
  saveOfflineEventSession,
  useMemoryOfflineEventLedgerForTests,
} from "../../lib/offline/offlineEvents";
import type { OfflineEventSession, Product } from "../../types/catalog";
import { ToastProvider } from "../ui/ToastProvider";

const apiMocks = vi.hoisted(() => ({
  finalizeOfflineEventSession: vi.fn(),
  recoverOfflineEventSession: vi.fn(),
  startOfflineEventSession: vi.fn(),
  syncOfflineEventOrders: vi.fn(),
}));

vi.mock("../../lib/api", () => apiMocks);

import { OfflineEventManager } from "./OfflineEventManager";

const product: Product = {
  id: "event-print",
  name: "Event Print",
  collection: "Convention",
  description: "",
  price_vnd: 100_000,
  item_code: "EVT-PRINT",
  quantity_available: 3,
  category: "Prints",
  stock_status: "limited",
  stock_note: "",
  images: [],
  featured: false,
  sort_order: 1,
  active: true,
};

function closingSession(): OfflineEventSession {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: "71000000-0000-4000-8000-000000000001",
    shopId: "70000000-0000-4000-8000-000000000001",
    shopSlug: "event-shop",
    deviceId: "72000000-0000-4000-8000-000000000001",
    name: "Convention day",
    status: "closing",
    allocations: [{ product, quantityAllocated: 3, quantitySold: 0 }],
    payment: defaultPayment,
    promotion: defaultPromotion,
    createdAt: now,
    updatedAt: now,
  };
}

describe("OfflineEventManager", () => {
  let resetLedger: () => void;

  beforeEach(() => {
    localStorage.clear();
    resetLedger = useMemoryOfflineEventLedgerForTests();
    vi.stubGlobal("navigator", {
      ...navigator,
      language: "en-US",
      onLine: true,
    });
    apiMocks.finalizeOfflineEventSession.mockReset();
    apiMocks.recoverOfflineEventSession.mockReset();
    apiMocks.startOfflineEventSession.mockReset();
    apiMocks.syncOfflineEventOrders.mockReset();
  });

  afterEach(() => {
    cleanup();
    resetLedger();
    vi.unstubAllGlobals();
  });

  it("keeps a frozen event manageable and retries finalization", async () => {
    const frozen = closingSession();
    await saveOfflineEventSession(frozen);
    apiMocks.finalizeOfflineEventSession
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce({ acknowledgements: [], status: "closed" });

    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <OfflineEventManager
            shopId={frozen.shopId}
            shopSlug={frozen.shopSlug}
            products={[product]}
            booth={defaultBooth}
            payment={defaultPayment}
            promotion={defaultPromotion}
          />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    const launcher = await screen.findByRole("button", {
      name: "Event mode: Convention day",
    });
    await userEvent.click(launcher);

    expect(
      screen.getByText(
        "This event is frozen. Retry closing to finish synchronization and return unused stock.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Prepare this device for an offline event"),
    ).not.toBeInTheDocument();

    const retry = screen.getByRole("button", {
      name: "Retry sync and close event",
    });
    await userEvent.click(retry);
    await waitFor(() =>
      expect(apiMocks.finalizeOfflineEventSession).toHaveBeenCalledTimes(1),
    );
    expect(
      await screen.findByRole("button", {
        name: "Retry sync and close event",
      }),
    ).toBeEnabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Retry sync and close event" }),
    );
    await waitFor(() =>
      expect(apiMocks.finalizeOfflineEventSession).toHaveBeenCalledTimes(2),
    );
    await waitFor(async () =>
      expect((await loadOfflineEventSession(frozen.shopId))?.status).toBe(
        "closed",
      ),
    );
  });
});
