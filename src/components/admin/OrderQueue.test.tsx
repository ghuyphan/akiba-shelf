import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import type { Order } from "../../types/catalog";
import { formatVnd } from "../../utils/format";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import { ToastProvider } from "../ui/ToastProvider";

const apiMocks = vi.hoisted(() => ({
  confirmOrderPayment: vi.fn(),
  cancelOrder: vi.fn(),
  updateOrderFulfillment: vi.fn(),
  listOfflineEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../lib/api", () => apiMocks);

import { OrderQueue } from "./OrderQueue";

// Testing Library's default normalizer collapses the NBSP inside formatVnd
// output to a plain space; mirror that so exact text matchers line up.
const vnd = (value: number) => formatVnd(value).replace(/\s+/g, " ");

beforeAll(() => {
  // jsdom does not implement PointerEvent: testing-library falls back to a
  // generic Event, dropping clientX and silently breaking swipe simulation.
  // Polyfill it on top of MouseEvent so pointer gestures carry coordinates.
  if (!window.PointerEvent) {
    class PointerEventPolyfill extends MouseEvent {
      public readonly pointerId: number;
      public readonly isPrimary: boolean;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.isPrimary = init.isPrimary ?? true;
      }
    }
    window.PointerEvent =
      PointerEventPolyfill as unknown as typeof PointerEvent;
  }
  // jsdom does not reliably implement pointer capture for synthetic pointer
  // events, so the swipe-gesture tests stub the capture calls out.
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
});

const pendingOrder: Order = {
  id: "order-1",
  order_code: "AKB-0042",
  customer_name: "Huy",
  total_amount: 330000,
  status: "pending",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  confirmed_at: null,
  cancelled_at: null,
  expired_at: null,
  order_items: [
    {
      id: "oi-1",
      order_id: "order-1",
      product_id: "prod-stand",
      quantity: 2,
      unit_price: 150000,
      product: {
        id: "prod-stand",
        name: "Acrylic Stand — Miku",
        item_code: "STAND-MIKU",
        images: [],
      },
    },
    {
      id: "oi-2",
      order_id: "order-1",
      product_id: "prod-badge",
      quantity: 1,
      unit_price: 30000,
      product: {
        id: "prod-badge",
        name: "Holo Badge — Rin",
        item_code: "BADGE-RIN",
        images: [],
      },
    },
  ],
};

type QueueProps = ComponentProps<typeof OrderQueue>;

function renderQueue(overrides: Partial<QueueProps> = {}) {
  const props: QueueProps = {
    shopId: "shop-1",
    orders: [pendingOrder],
    filter: "pending",
    selectedEventId: "",
    todayOnly: false,
    counts: { pending: 1, confirmed: 0, cancelled: 0, expired: 0, all: 1 },
    eventCount: 0,
    page: 1,
    pageSize: 10,
    total: 1,
    loading: false,
    onFilterChange: vi.fn(),
    onSelectedEventChange: vi.fn(),
    onTodayOnlyChange: vi.fn(),
    onPageChange: vi.fn(),
    onOrderUpdated: vi.fn(),
    ...overrides,
  };
  render(
    <PlatformI18nProvider>
      <ToastProvider>
        <OrderQueue {...props} />
      </ToastProvider>
    </PlatformI18nProvider>,
  );
  return props;
}

function getOrderCard() {
  const card = screen.getByText("AKB-0042").closest("article");
  if (!card) throw new Error("Order card not found");
  return card;
}

describe("OrderQueue", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    apiMocks.confirmOrderPayment.mockReset();
    apiMocks.cancelOrder.mockReset();
    apiMocks.updateOrderFulfillment.mockReset();
    apiMocks.listOfflineEvents.mockReset().mockResolvedValue([]);
  });

  it("renders a pending order with customer, code, items, and total", () => {
    renderQueue();

    const card = within(getOrderCard());
    expect(card.getByText("pending")).toBeInTheDocument();
    expect(card.getByText("Huy")).toBeInTheDocument();
    expect(card.getByText("Acrylic Stand — Miku")).toBeInTheDocument();
    expect(card.getByText("Holo Badge — Rin")).toBeInTheDocument();
    expect(card.getByText("2×")).toBeInTheDocument();
    expect(card.getByText("1×")).toBeInTheDocument();
    expect(card.getByText(vnd(330000))).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "What needs to be packed" }),
    ).not.toBeInTheDocument();
  });

  it("renders expired orders with the shared warning status", () => {
    renderQueue({
      orders: [
        {
          ...pendingOrder,
          status: "expired",
          expires_at: null,
          expired_at: new Date().toISOString(),
        },
      ],
      filter: "expired",
    });

    expect(
      within(getOrderCard()).getByText("expired").closest(".status-pill"),
    ).toHaveClass("status-pill-warning");
  });

  it("marks the queue busy and locks filter changes while refreshing", () => {
    renderQueue({ loading: true });

    expect(document.querySelector(".admin-orders-view")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: /pending 1/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^today$/i })).toBeDisabled();
  });

  it("summarizes only confirmed orders that have not been picked up", () => {
    const confirmed = {
      ...pendingOrder,
      id: "confirmed-order",
      order_code: "AKB-0043",
      status: "confirmed" as const,
      fulfillment_status: "preparing" as const,
    };
    const pickedUp = {
      ...pendingOrder,
      id: "picked-up-order",
      order_code: "AKB-0044",
      status: "confirmed" as const,
      fulfillment_status: "picked_up" as const,
    };

    renderQueue({ orders: [pendingOrder, confirmed, pickedUp], filter: "all" });

    const summary = screen
      .getByRole("heading", { name: "What needs to be packed" })
      .closest("section");
    if (!summary) throw new Error("Packing summary not found");
    expect(within(summary).getByText("3 total units")).toBeInTheDocument();
    expect(
      within(summary).getByText("Acrylic Stand — Miku"),
    ).toBeInTheDocument();
    expect(within(summary).getByText("Holo Badge — Rin")).toBeInTheDocument();
  });

  it("shows the staff actor for the latest fulfilment update", async () => {
    const user = userEvent.setup();
    renderQueue({
      orders: [
        {
          ...pendingOrder,
          status: "confirmed",
          fulfillment_status: "ready",
          fulfillment_updated_at: "2026-07-22T01:00:00.000Z",
          fulfillment_updated_by_email: "staff@example.com",
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Order details" }));

    expect(screen.getByText("Fulfilment handled by")).toBeInTheDocument();
    expect(screen.getByText("staff@example.com")).toBeInTheDocument();
  });

  it("makes long order item lists independently scrollable", () => {
    const longOrder = {
      ...pendingOrder,
      order_items: Array.from({ length: 4 }, (_, index) => ({
        ...pendingOrder.order_items![0],
        id: `oi-${index + 1}`,
        product_id: `prod-${index + 1}`,
        product: {
          ...pendingOrder.order_items![0].product!,
          id: `prod-${index + 1}`,
          name: `Product ${index + 1}`,
        },
      })),
    } satisfies Order;

    renderQueue({ orders: [longOrder] });

    const items = screen.getByLabelText("Order items");
    expect(items).toHaveClass("is-scrollable");
    expect(items).toHaveAttribute("tabindex", "0");
    expect(within(items).getAllByText(/Product \d/)).toHaveLength(4);
  });

  it("confirms a pending order through the swipe gesture", async () => {
    apiMocks.confirmOrderPayment.mockResolvedValue({
      outcome: "confirmed",
      order: { ...pendingOrder, status: "confirmed" },
    });
    const props = renderQueue();
    const track = screen.getByRole("button", {
      name: /swipe right or press enter/i,
    });

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 300 });
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 300 });

    await waitFor(() =>
      expect(apiMocks.confirmOrderPayment).toHaveBeenCalledWith("order-1"),
    );
    await waitFor(() => expect(props.onOrderUpdated).toHaveBeenCalled());
    expect(await screen.findByText("Payment confirmed")).toBeInTheDocument();
    expect(screen.getByText("Stock updated")).toBeInTheDocument();
    expect(await screen.findByText("Payment confirmed.")).toBeInTheDocument();
  });

  it("confirms a pending order from the keyboard", async () => {
    apiMocks.confirmOrderPayment.mockResolvedValue({
      outcome: "confirmed",
      order: { ...pendingOrder, status: "confirmed" },
    });
    const props = renderQueue();

    fireEvent.keyDown(
      screen.getByRole("button", { name: /swipe right or press enter/i }),
      { key: "Enter" },
    );

    await waitFor(() =>
      expect(apiMocks.confirmOrderPayment).toHaveBeenCalledWith("order-1"),
    );
    await waitFor(() => expect(props.onOrderUpdated).toHaveBeenCalled());
  });

  it("cancels a pending order after the staff confirms the prompt", async () => {
    apiMocks.cancelOrder.mockResolvedValue({
      outcome: "cancelled",
      order: { ...pendingOrder, status: "cancelled" },
    });
    const props = renderQueue();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /cancel and release stock/i }),
    );
    expect(
      screen.getByRole("dialog", { name: "Cancel order" }),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("dialog", { name: "Cancel order" })).getByRole(
        "button",
        { name: /cancel and release stock/i },
      ),
    );
    await waitFor(() =>
      expect(apiMocks.cancelOrder).toHaveBeenCalledWith("order-1"),
    );
    await waitFor(() => expect(props.onOrderUpdated).toHaveBeenCalled());
    expect(
      await screen.findByText("Order cancelled and stock released."),
    ).toBeInTheDocument();
  });

  it("leaves the order alone when the cancel prompt is dismissed", async () => {
    const props = renderQueue();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /cancel and release stock/i }),
    );
    const cancelDialog = screen.getByRole("dialog", { name: "Cancel order" });
    await user.click(
      cancelDialog.querySelector<HTMLButtonElement>(
        ".confirmation-dialog-actions .button-secondary",
      )!,
    );

    expect(apiMocks.cancelOrder).not.toHaveBeenCalled();
    expect(props.onOrderUpdated).not.toHaveBeenCalled();
  });

  it("toggles the today-only filter from the filter bar", async () => {
    const props = renderQueue();
    const user = userEvent.setup();

    const toggle = screen.getByRole("button", { name: /^today$/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    expect(props.onTodayOnlyChange).toHaveBeenCalledWith(true);
  });

  it("opens the Event source view from the order filters", async () => {
    const props = renderQueue({ eventCount: 3 });
    const user = userEvent.setup();

    const eventFilter = screen.getByRole("button", { name: /event 3/i });
    expect(eventFilter).toHaveAttribute("aria-pressed", "false");
    await user.click(eventFilter);

    expect(props.onFilterChange).toHaveBeenCalledWith("event");
  });

  it("filters Event orders by a saved event", async () => {
    apiMocks.listOfflineEvents.mockResolvedValue([
      {
        id: "71000000-0000-4000-8000-000000000001",
        shopId: "shop-1",
        name: "Artist alley",
        status: "closed",
        scheduledStartAt: "2026-08-01T01:00:00.000Z",
        scheduledEndAt: "2026-08-01T09:00:00.000Z",
        startedAt: "2026-08-01T01:00:00.000Z",
        closedAt: "2026-08-01T09:00:00.000Z",
        createdAt: "2026-07-22T00:00:00.000Z",
        updatedAt: "2026-08-01T09:00:00.000Z",
        productCount: 1,
        quantityAllocated: 3,
        quantitySold: 2,
        orderCount: 2,
        orderTotal: 200000,
      },
    ]);
    const props = renderQueue({ filter: "event" });
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "Event: All events" }),
    );
    await user.click(screen.getByRole("option", { name: /Artist alley/ }));

    expect(props.onSelectedEventChange).toHaveBeenCalledWith(
      "71000000-0000-4000-8000-000000000001",
    );
  });

  it("renders event orders as read-only queue records", () => {
    renderQueue({
      filter: "event",
      eventCount: 1,
      orders: [
        {
          ...pendingOrder,
          source: "offline_event",
          offline_event_session_id: "71000000-0000-4000-8000-000000000001",
          offline_event_name: "Convention day",
          payment_method: "vietqr",
          payment_state: "bank_verification_pending",
        },
      ],
    });

    const card = within(getOrderCard());
    expect(card.getByText("Convention day")).toBeInTheDocument();
    expect(card.getByText(/designated Event Mode device/i)).toBeInTheDocument();
    expect(
      card.queryByRole("button", { name: /swipe right/i }),
    ).not.toBeInTheDocument();
    expect(
      card.queryByRole("button", { name: /cancel and release stock/i }),
    ).not.toBeInTheDocument();
  });

  it("advances a confirmed online order to ready", async () => {
    const confirmed = {
      ...pendingOrder,
      status: "confirmed" as const,
      fulfillment_status: "preparing" as const,
      confirmed_at: new Date().toISOString(),
    };
    apiMocks.updateOrderFulfillment.mockResolvedValue({
      outcome: "updated",
      order: { ...confirmed, fulfillment_status: "ready" },
    });
    const props = renderQueue({ orders: [confirmed], filter: "confirmed" });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Mark ready" }));

    expect(apiMocks.updateOrderFulfillment).toHaveBeenCalledWith(
      "order-1",
      "ready",
    );
    expect(props.onOrderUpdated).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps confirmed Event fulfilment read-only on the synced queue", () => {
    renderQueue({
      filter: "event",
      eventCount: 1,
      orders: [
        {
          ...pendingOrder,
          status: "confirmed",
          source: "offline_event",
          offline_event_session_id: "71000000-0000-4000-8000-000000000001",
          offline_event_name: "Convention day",
          payment_method: "cash",
          payment_state: "cash_confirmed",
          fulfillment_status: "preparing",
        },
      ],
    });

    const card = within(getOrderCard());
    expect(card.getByText("preparing")).toBeInTheDocument();
    expect(
      card.queryByRole("button", { name: "Mark ready" }),
    ).not.toBeInTheDocument();
  });

  it("shows a today-specific empty state that can reset both filters", async () => {
    const props = renderQueue({
      orders: [],
      filter: "all",
      todayOnly: true,
      total: 0,
      counts: { pending: 0, confirmed: 0, cancelled: 0, expired: 0, all: 0 },
    });
    const user = userEvent.setup();

    expect(screen.getByText("No orders today")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^today$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: /view all orders/i }));

    expect(props.onFilterChange).toHaveBeenCalledWith("all");
    expect(props.onTodayOnlyChange).toHaveBeenCalledWith(false);
  });
});
