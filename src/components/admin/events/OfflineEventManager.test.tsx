import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  defaultBooth,
  defaultPayment,
  defaultPromotion,
} from "../../../lib/constants";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import {
  createOfflineEventOrder,
  loadOfflineEventSession,
  saveOfflineEventSession,
  useMemoryOfflineEventLedgerForTests,
} from "../../../lib/offline/offlineEvents";
import { setEventDevicePin } from "../../../lib/offline/eventAccess";
import type { OfflineEventSession, Product } from "../../../types/catalog";
import { ToastProvider } from "../../ui/ToastProvider";

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>(
    "react-router",
  );
  return { ...actual, useNavigate: () => vi.fn() };
});

const apiMocks = vi.hoisted(() => ({
  activateOfflineEventSession: vi.fn(),
  finalizeOfflineEventSession: vi.fn(),
  getOfflineEventDraft: vi.fn(),
  listOfflineEvents: vi.fn(),
  recoverOfflineEventSession: vi.fn(),
  saveOfflineEventDraft: vi.fn(),
  syncOfflineEventOrders: vi.fn(),
}));
const preparationMocks = vi.hoisted(() => ({
  prepareStorefrontOffline: vi.fn(),
  refreshGachaLaunch: vi.fn(),
  downloadGachaOfflinePacks: vi.fn(),
}));

vi.mock("../../../lib/api/offlineEvents", () => apiMocks);
vi.mock("../../../lib/offline/storefrontOffline", () => ({
  prepareStorefrontOffline: preparationMocks.prepareStorefrontOffline,
}));
vi.mock("../../../lib/gacha/gachaLaunch", () => ({
  refreshGachaLaunch: preparationMocks.refreshGachaLaunch,
}));
vi.mock("../../../lib/offline/offlinePack", () => ({
  downloadGachaOfflinePacks: preparationMocks.downloadGachaOfflinePacks,
  gachaCatalogOfflineUrls: vi.fn(() => []),
}));

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

async function submitTabletPin(mode: "setup" | "verify") {
  const dialog = screen.getByRole("dialog", {
    name: mode === "setup" ? "Protect this tablet" : "Confirm tablet PIN",
  });
  await userEvent.type(
    within(dialog).getByLabelText("6-digit tablet PIN"),
    "123456",
  );
  if (mode === "setup")
    await userEvent.type(
      within(dialog).getByLabelText("Confirm tablet PIN"),
      "123456",
    );
  await userEvent.click(
    within(dialog).getByRole("button", {
      name: mode === "setup" ? "Save PIN" : "Continue",
    }),
  );
}

describe("OfflineEventManager", () => {
  let resetLedger: () => void;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetLedger = useMemoryOfflineEventLedgerForTests();
    vi.stubGlobal("navigator", {
      ...navigator,
      language: "en-US",
      onLine: true,
    });
    apiMocks.finalizeOfflineEventSession.mockReset();
    apiMocks.activateOfflineEventSession.mockReset();
    apiMocks.getOfflineEventDraft.mockReset();
    apiMocks.listOfflineEvents.mockReset().mockResolvedValue([]);
    apiMocks.recoverOfflineEventSession.mockReset().mockResolvedValue(null);
    apiMocks.saveOfflineEventDraft.mockReset();
    apiMocks.syncOfflineEventOrders.mockReset();
    preparationMocks.prepareStorefrontOffline
      .mockReset()
      .mockResolvedValue(undefined);
    preparationMocks.refreshGachaLaunch.mockReset().mockResolvedValue({
      catalogs: {},
    });
    preparationMocks.downloadGachaOfflinePacks
      .mockReset()
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    resetLedger();
    vi.unstubAllGlobals();
  });

  it("keeps a frozen event manageable and retries finalization", async () => {
    const frozen = closingSession();
    await saveOfflineEventSession(frozen);
    await setEventDevicePin(frozen.shopId, "123456");
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
      name: "Event Mode: Convention day",
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
      name: "Retry ending event",
    });
    await userEvent.click(retry);
    await submitTabletPin("verify");
    const closeDialog = await screen.findByRole("dialog", {
      name: "End offline event?",
    });
    await userEvent.click(
      within(closeDialog).getByRole("button", {
        name: "Retry ending event",
      }),
    );
    await waitFor(() =>
      expect(apiMocks.finalizeOfflineEventSession).toHaveBeenCalledTimes(1),
    );
    const retryDialog = screen.getByRole("dialog", {
      name: "End offline event?",
    });
    expect(
      within(retryDialog).getByRole("button", {
        name: "Retry ending event",
      }),
    ).toBeEnabled();
    await userEvent.click(
      within(retryDialog).getByRole("button", {
        name: "Retry ending event",
      }),
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

  it("does not finalize a frozen event when its local orders cannot be read", async () => {
    resetLedger();
    const orderReadFailure: { current?: Error } = {};
    resetLedger = useMemoryOfflineEventLedgerForTests({
      getOrdersError: () => orderReadFailure.current,
    });
    const frozen = closingSession();
    await saveOfflineEventSession(frozen);
    await setEventDevicePin(frozen.shopId, "123456");

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

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Event Mode: Convention day",
      }),
    );
    orderReadFailure.current = new Error("IndexedDB read failed");
    await userEvent.click(
      screen.getByRole("button", { name: "Retry ending event" }),
    );
    await submitTabletPin("verify");
    const closeDialog = await screen.findByRole("dialog", {
      name: "End offline event?",
    });
    await userEvent.click(
      within(closeDialog).getByRole("button", {
        name: "Retry ending event",
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/storage could not be read on this device/i),
      ).toBeInTheDocument(),
    );
    expect(apiMocks.finalizeOfflineEventSession).not.toHaveBeenCalled();
    expect((await loadOfflineEventSession(frozen.shopId))?.status).toBe(
      "closing",
    );
  });

  it("saves a scheduled draft with only the selected stock", async () => {
    const now = new Date().toISOString();
    apiMocks.saveOfflineEventDraft.mockImplementation(async (input) => ({
      version: 1,
      id: "71000000-0000-4000-8000-000000000002",
      shopId: "70000000-0000-4000-8000-000000000001",
      shopSlug: "event-shop",
      name: input.name,
      status: "draft",
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
      allocations: [{ product, quantityAllocated: 1, quantitySold: 0 }],
      createdAt: now,
      updatedAt: now,
    }));

    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <OfflineEventManager
            shopId="70000000-0000-4000-8000-000000000001"
            shopSlug="event-shop"
            products={[product]}
            booth={defaultBooth}
            payment={defaultPayment}
            promotion={defaultPromotion}
          />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Event Mode: Set up" }),
    );
    fireEvent.change(screen.getByLabelText("Event name"), {
      target: { value: "Artist alley" },
    });
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Allocate Event Print" }),
    );
    const save = await screen.findByRole("button", { name: "Save draft" });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);

    await waitFor(() =>
      expect(apiMocks.saveOfflineEventDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Artist alley",
          products: [{ id: product.id, quantity: 1 }],
        }),
      ),
    );
  });

  it("shows an explicit empty-stock state instead of an empty allocation box", async () => {
    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <OfflineEventManager
            shopId="70000000-0000-4000-8000-000000000001"
            shopSlug="event-shop"
            products={[]}
            booth={defaultBooth}
            payment={defaultPayment}
            promotion={defaultPromotion}
          />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Event Mode: Set up" }),
    );

    expect(
      await screen.findByText("No stock available for an event"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add stock to an active product before preparing Event Mode.",
      ),
    ).toBeInTheDocument();
  });

  it("does not reserve stock when durable device storage is unavailable", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      language: "en-US",
      onLine: true,
      storage: {
        persisted: vi.fn().mockResolvedValue(false),
        persist: vi.fn().mockResolvedValue(false),
      },
    });
    apiMocks.saveOfflineEventDraft.mockResolvedValue({
      id: "71000000-0000-4000-8000-000000000002",
    });

    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <OfflineEventManager
            shopId="70000000-0000-4000-8000-000000000001"
            shopSlug="event-shop"
            products={[product]}
            booth={defaultBooth}
            payment={defaultPayment}
            promotion={defaultPromotion}
          />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Event Mode: Set up" }),
    );
    fireEvent.change(screen.getByLabelText("Event name"), {
      target: { value: "Artist alley" },
    });
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Allocate Event Print" }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Prepare device and reserve stock",
      }),
    );
    await submitTabletPin("setup");

    expect(
      await screen.findByText(/Persistent storage is unavailable/i),
    ).toBeInTheDocument();
    expect(preparationMocks.prepareStorefrontOffline).not.toHaveBeenCalled();
    expect(apiMocks.activateOfflineEventSession).not.toHaveBeenCalled();
  });

  it("does not reserve stock when the local event ledger is read-only", async () => {
    resetLedger();
    resetLedger = useMemoryOfflineEventLedgerForTests({
      probeWriteError: new Error("IndexedDB write failed"),
    });
    apiMocks.saveOfflineEventDraft.mockResolvedValue({
      id: "71000000-0000-4000-8000-000000000002",
    });

    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <OfflineEventManager
            shopId="70000000-0000-4000-8000-000000000001"
            shopSlug="event-shop"
            products={[product]}
            booth={defaultBooth}
            payment={defaultPayment}
            promotion={defaultPromotion}
          />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Event Mode: Set up" }),
    );
    fireEvent.change(screen.getByLabelText("Event name"), {
      target: { value: "Artist alley" },
    });
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Allocate Event Print" }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Prepare device and reserve stock",
      }),
    );
    await submitTabletPin("setup");

    expect(
      await screen.findByText(/storage could not be read on this device/i),
    ).toBeInTheDocument();
    expect(apiMocks.activateOfflineEventSession).not.toHaveBeenCalled();
  });

  it("ignores a delayed draft response after switching shops", async () => {
    let resolveOldDraftList: (events: unknown[]) => void = () => undefined;
    const oldDraftList = new Promise<unknown[]>((resolve) => {
      resolveOldDraftList = resolve;
    });
    apiMocks.listOfflineEvents.mockImplementation((shopId: string) =>
      shopId === "shop-old" ? oldDraftList : Promise.resolve([]),
    );
    const ui = (shopId: string, shopSlug: string) => (
      <PlatformI18nProvider>
        <ToastProvider>
          <OfflineEventManager
            shopId={shopId}
            shopSlug={shopSlug}
            products={[product]}
            booth={defaultBooth}
            payment={defaultPayment}
            promotion={defaultPromotion}
          />
        </ToastProvider>
      </PlatformI18nProvider>
    );
    const view = render(ui("shop-old", "old-shop"));

    await userEvent.click(
      await screen.findByRole("button", { name: "Event Mode: Set up" }),
    );
    expect(screen.getByText("Loading saved event…")).toBeInTheDocument();

    view.rerender(ui("shop-new", "new-shop"));
    expect(await screen.findByLabelText("Event name")).toHaveValue("");
    resolveOldDraftList([
      {
        id: "old-draft",
        status: "draft",
      },
    ]);

    await waitFor(() =>
      expect(apiMocks.getOfflineEventDraft).not.toHaveBeenCalled(),
    );
    expect(screen.getByLabelText("Event name")).toHaveValue("");
  });

  it("shows local item details and confirms cancellation before restoring stock", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      language: "en-US",
      onLine: false,
    });
    const active = { ...closingSession(), status: "active" as const };
    await saveOfflineEventSession(active);
    const order = await createOfflineEventOrder(
      active,
      [{ product, quantity: 2 }],
      "Walk-up buyer",
      "cash",
    );

    render(
      <PlatformI18nProvider>
        <ToastProvider>
          <OfflineEventManager
            shopId={active.shopId}
            shopSlug={active.shopSlug}
            products={[product]}
            booth={defaultBooth}
            payment={defaultPayment}
            promotion={defaultPromotion}
          />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Event Mode: Convention day",
      }),
    );
    expect(screen.getByText("Event Print")).toBeInTheDocument();
    expect(screen.getByText("2×")).toBeInTheDocument();
    expect(screen.getByText("Device only")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const cancelDialog = screen.getByRole("dialog", {
      name: "Cancel local order",
    });
    expect(cancelDialog).toHaveTextContent(order.orderCode);
    await userEvent.click(
      within(cancelDialog).getByRole("button", { name: "Cancel order" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Cancelled")).toBeInTheDocument(),
    );
    expect(
      (await loadOfflineEventSession(active.shopId))?.allocations[0]
        .quantitySold,
    ).toBe(0);
  });
});
