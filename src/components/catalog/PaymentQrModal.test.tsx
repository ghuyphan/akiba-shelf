import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { CartItem, Order, PaymentSettings, Product } from "../../types/catalog";
import { defaultPromotion } from "../../lib/constants";
import { formatVnd } from "../../utils/format";

const apiMocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getCustomerOrder: vi.fn(),
  cancelCustomerOrder: vi.fn(),
}));
const checkoutStorage = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("../../lib/api", () => apiMocks);

vi.mock("../../lib/offline/checkoutSession", () => ({
  loadCheckoutSession: vi.fn(() => checkoutStorage.current),
  saveCheckoutSession: vi.fn((session: unknown) => {
    checkoutStorage.current = session;
  }),
  clearCheckoutSession: vi.fn(() => {
    checkoutStorage.current = null;
  }),
  createCheckoutSession: vi.fn((shopSlug: string, cart: CartItem[], customerName: string) => ({
    version: 2,
    shopSlug,
    clientRequestId: "11111111-1111-4111-8111-111111111111",
    recoveryToken: "0123456789abcdef0123456789abcdef",
    order: null,
    cart,
    customerName,
    state: "queued",
    createdAt: "2026-07-17T10:00:00.000Z",
    updatedAt: "2026-07-17T10:00:00.000Z",
  })),
}));

import { PaymentQrModal } from "./PaymentQrModal";

// Testing Library's default normalizer collapses the NBSP inside formatVnd
// output to a plain space; mirror that so exact text matchers line up.
const vnd = (value: number) => formatVnd(value).replace(/\s+/g, " ");

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-stand",
    name: "Acrylic Stand — Miku",
    collection: "Vocaloid",
    description: "",
    price_vnd: 150000,
    item_code: "STAND-MIKU",
    quantity_available: 12,
    category: "Stands",
    stock_status: "in_stock",
    stock_note: "",
    images: [],
    featured: false,
    sort_order: 0,
    active: true,
    ...overrides,
  };
}

const cart: CartItem[] = [
  { product: makeProduct(), quantity: 2 },
  {
    product: makeProduct({
      id: "prod-badge",
      name: "Holo Badge — Rin",
      price_vnd: 30000,
      item_code: "BADGE-RIN",
    }),
    quantity: 1,
  },
];

const payment: PaymentSettings = {
  momo_qr_url: "",
  bank_qr_url: "",
  momo_label: "",
  bank_label: "Booth Bank",
  bank_code: "MB",
  bank_acq_id: "970422",
  bank_account_no: "0123456789",
  bank_account_name: "AKIBA BOOTH",
  bank_add_info_template: "",
  payment_instructions: "",
};

function makeOrder(status: Order["status"]): Order {
  return {
    id: "order-1",
    order_code: "AKB-0042",
    customer_name: "Huy",
    total_amount: 330000,
    status,
    created_at: "2026-07-17T10:00:00.000Z",
    updated_at: "2026-07-17T10:00:00.000Z",
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    confirmed_at: null,
    cancelled_at: null,
    expired_at: null,
  };
}

function renderModal(
  overrides: Partial<ComponentProps<typeof PaymentQrModal>> = {},
) {
  const props: ComponentProps<typeof PaymentQrModal> = {
    shopSlug: "test-shop",
    isOpen: true,
    payment,
    cart,
    promotion: defaultPromotion,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    ...overrides,
  };
  render(<PaymentQrModal {...props} />);
  return props;
}

describe("PaymentQrModal", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    checkoutStorage.current = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      onLine: true,
    });
    apiMocks.createOrder.mockReset();
    apiMocks.getCustomerOrder.mockReset();
    apiMocks.cancelCustomerOrder.mockReset();
  });

  it("reviews the cart with quantities, prices, and total before ordering", () => {
    renderModal();

    expect(
      screen.getByRole("dialog", { name: "Scan to pay" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Acrylic Stand — Miku")).toBeInTheDocument();
    expect(screen.getByText("Holo Badge — Rin")).toBeInTheDocument();
    expect(
      screen.getByText(`2 × ${vnd(150000)}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`1 × ${vnd(30000)}`),
    ).toBeInTheDocument();
    // Line total for the stand and the grand total of the cart.
    expect(screen.getByText(vnd(300000))).toBeInTheDocument();
    expect(screen.getByText(vnd(330000))).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("e.g. Huy or Alice"),
    ).toBeInTheDocument();
  });

  it("creates the order on submit and waits for staff confirmation", async () => {
    const pending = makeOrder("pending");
    let resolveOrder!: (order: Order) => void;
    apiMocks.createOrder.mockReturnValue(
      new Promise<Order>((resolve) => {
        resolveOrder = resolve;
      }),
    );
    apiMocks.getCustomerOrder.mockResolvedValue(pending);
    renderModal();
    const paymentDialog = screen.getByRole("dialog", { name: "Scan to pay" });

    fireEvent.change(screen.getByPlaceholderText("e.g. Huy or Alice"), {
      target: { value: "Huy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create order & pay" }));

    expect(await screen.findByText("Checking…")).toBeInTheDocument();
    expect(document.querySelector(".payment-qr-loading .spin-icon")).toBeInTheDocument();
    expect(screen.queryByText("Couldn’t reach checkout")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Scan to pay" })).toBe(
      paymentDialog,
    );
    resolveOrder(pending);

    expect(
      await screen.findByRole("dialog", { name: "Scan to pay" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Scan to pay" })).toBe(
      paymentDialog,
    );
    expect(apiMocks.createOrder).toHaveBeenCalledWith(
      "test-shop",
      "Huy",
      cart,
      "11111111-1111-4111-8111-111111111111",
      "0123456789abcdef0123456789abcdef",
    );
    expect(screen.getAllByText("AKB-0042").length).toBeGreaterThan(0);
    expect(screen.getByText("Huy")).toBeInTheDocument();
    expect(screen.getByText("Waiting for staff confirmation")).toBeInTheDocument();
    const paymentQr = await screen.findByAltText("Payment QR code");
    expect(paymentQr).toHaveAttribute(
      "src",
      expect.stringMatching(/^data:image\/svg\+xml;charset=utf-8,/),
    );
    const brandHeader = screen.getByAltText("VietQR").parentElement;
    expect(brandHeader).toHaveClass("vietqr-card-header");
    const vietQrCard = brandHeader?.parentElement;
    const cardSections = Array.from(vietQrCard?.children ?? []);
    expect(cardSections.map((section) => section.className)).toEqual([
      "vietqr-card-header",
      "vietqr-card-qr",
      "vietqr-card-brands",
      "vietqr-card-details",
    ]);
    const napasLogo = screen.getByAltText("Napas 247");
    const bankLogo = vietQrCard?.querySelector<HTMLImageElement>(
      ".vietqr-bank-icon img",
    );
    expect(napasLogo).toBeInTheDocument();
    expect(bankLogo?.src).toMatch(/\/bank-logos\/MB\.png$/);

    fireEvent.error(napasLogo);
    if (bankLogo) fireEvent.error(bankLogo);
    expect(screen.getByText("NAPAS 247")).not.toHaveAttribute("hidden");
    expect(
      vietQrCard?.querySelector(".vietqr-bank-name"),
    ).toHaveTextContent("MB Bank");

    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    const cancelDialog = screen.getByRole("dialog", {
      name: "Cancel this reservation?",
    });
    expect(cancelDialog).toHaveClass("cancel-order-modal");
    expect(cancelDialog.querySelector(".payment-success-eyebrow")).toHaveTextContent("AKB-0042");
    expect(cancelDialog.querySelector(".button-danger")).toHaveTextContent(
      "Cancel order",
    );
  });

  it("shows the success state once the order is confirmed", async () => {
    const pending = makeOrder("pending");
    const confirmed = makeOrder("confirmed");
    apiMocks.createOrder.mockResolvedValue(pending);
    apiMocks.getCustomerOrder.mockResolvedValue(confirmed);
    const onSuccess = vi.fn();
    renderModal({ onSuccess });

    fireEvent.change(screen.getByPlaceholderText("e.g. Huy or Alice"), {
      target: { value: "Huy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create order & pay" }));

    await waitFor(
      () =>
        expect(apiMocks.getCustomerOrder).toHaveBeenCalledWith(
          pending.id,
          "0123456789abcdef0123456789abcdef",
        ),
      { timeout: 10000 },
    );
    expect(
      await screen.findByRole(
        "dialog",
        { name: "Payment complete" },
        { timeout: 10000 },
      ),
    ).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalled();
    expect(screen.getByText(/AKB-0042/)).toBeInTheDocument();
    expect(screen.getByText("Total paid")).toBeInTheDocument();
    expect(screen.getByText(vnd(330000))).toBeInTheDocument();
  }, 15000);

  it("shows an order service error without claiming the customer is offline", async () => {
    const pending = makeOrder("pending");
    checkoutStorage.current = {
      version: 2,
      shopSlug: "test-shop",
      clientRequestId: "11111111-1111-4111-8111-111111111111",
      recoveryToken: "0123456789abcdef0123456789abcdef",
      order: pending,
      cart,
      customerName: "Huy",
      state: "reserved",
      createdAt: "2026-07-17T10:00:00.000Z",
      updatedAt: "2026-07-17T10:00:00.000Z",
    };
    apiMocks.getCustomerOrder.mockRejectedValue(new Error("Permission denied"));

    renderModal();

    expect(
      await screen.findByText("Couldn’t refresh order status"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Retry status check" }),
    ).toBeEnabled();
  });

  it("does not queue a programming TypeError as an offline checkout", async () => {
    apiMocks.createOrder.mockRejectedValue(
      new TypeError("Cannot read properties of undefined"),
    );
    renderModal();

    fireEvent.change(screen.getByPlaceholderText("e.g. Huy or Alice"), {
      target: { value: "Huy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create order & pay" }));

    expect(
      await screen.findByRole("dialog", { name: "Checkout unavailable" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Reconnect to checkout" }),
    ).not.toBeInTheDocument();
  });

  it("queues checkout without creating a local order when offline", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    apiMocks.createOrder.mockRejectedValue(new TypeError("Failed to fetch"));
    const onOrderChange = vi.fn();
    renderModal({ onOrderChange });

    fireEvent.change(screen.getByPlaceholderText("e.g. Huy or Alice"), {
      target: { value: "Huy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create order & pay" }));

    expect(
      await screen.findByRole("dialog", { name: "Reconnect to checkout" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/stock must be verified online/i)).toBeInTheDocument();
    expect(screen.queryByAltText("Payment QR code")).not.toBeInTheDocument();
    expect(onOrderChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
  });
});
