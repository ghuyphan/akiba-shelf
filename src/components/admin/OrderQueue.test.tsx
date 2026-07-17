import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import type { Order } from "../../types/catalog";
import { formatVnd } from "../../lib/format";
import { PlatformI18nProvider } from "../../lib/platformI18n";
import { ToastProvider } from "../ui/ToastProvider";

const apiMocks = vi.hoisted(() => ({
  confirmOrderPayment: vi.fn(),
  cancelOrder: vi.fn(),
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
    orders: [pendingOrder],
    filter: "pending",
    counts: { pending: 1, confirmed: 0, cancelled: 0, expired: 0, all: 1 },
    page: 1,
    pageSize: 10,
    total: 1,
    loading: false,
    onFilterChange: vi.fn(),
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
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMocks.cancelOrder.mockResolvedValue({
      outcome: "cancelled",
      order: { ...pendingOrder, status: "cancelled" },
    });
    const props = renderQueue();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /cancel and release stock/i }),
    );

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() =>
      expect(apiMocks.cancelOrder).toHaveBeenCalledWith("order-1"),
    );
    await waitFor(() => expect(props.onOrderUpdated).toHaveBeenCalled());
    expect(
      await screen.findByText("Order cancelled and stock released."),
    ).toBeInTheDocument();
  });

  it("leaves the order alone when the cancel prompt is dismissed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const props = renderQueue();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /cancel and release stock/i }),
    );

    expect(apiMocks.cancelOrder).not.toHaveBeenCalled();
    expect(props.onOrderUpdated).not.toHaveBeenCalled();
  });
});
