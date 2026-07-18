import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import type { CartItem, Order, PaymentSettings, Product } from "../../types/catalog";
import { defaultPromotion } from "../../lib/constants";
import { formatVnd } from "../../lib/format";

const apiMocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getCustomerOrder: vi.fn(),
  cancelCustomerOrder: vi.fn(),
}));

vi.mock("../../lib/api", () => apiMocks);

// Keep localStorage order recovery out of the happy path: no stored recovery,
// deterministic identifiers for the recovery record created on submit.
vi.mock("../../lib/orderRecovery", () => ({
  loadOrderRecovery: vi.fn(() => null),
  saveOrderRecovery: vi.fn(),
  clearOrderRecovery: vi.fn(),
  createOrderRecovery: vi.fn((cart: CartItem[], customerName: string) => ({
    clientRequestId: "11111111-1111-4111-8111-111111111111",
    recoveryToken: "0123456789abcdef0123456789abcdef",
    order: null,
    cart,
    customerName,
    startedAt: "2026-07-17T10:00:00.000Z",
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
  afterEach(cleanup);
  beforeEach(() => {
    apiMocks.createOrder.mockReset();
    apiMocks.getCustomerOrder.mockReset();
    apiMocks.cancelCustomerOrder.mockReset();
  });

  it("reviews the cart with quantities, prices, and total before ordering", () => {
    renderModal();

    expect(
      screen.getByRole("dialog", { name: "Confirm your order" }),
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
    apiMocks.createOrder.mockResolvedValue(pending);
    apiMocks.getCustomerOrder.mockResolvedValue(pending);
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("e.g. Huy or Alice"), "Huy");
    await user.click(
      screen.getByRole("button", { name: "Create order & pay" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Scan to pay" }),
    ).toBeInTheDocument();
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
    expect(await screen.findByAltText("Payment QR code")).toBeInTheDocument();
  });

  it("shows the success state once the order is confirmed", async () => {
    const pending = makeOrder("pending");
    const confirmed = makeOrder("confirmed");
    apiMocks.createOrder.mockResolvedValue(pending);
    apiMocks.getCustomerOrder.mockResolvedValue(confirmed);
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderModal({ onSuccess });

    await user.type(screen.getByPlaceholderText("e.g. Huy or Alice"), "Huy");
    await user.click(
      screen.getByRole("button", { name: "Create order & pay" }),
    );

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
});
