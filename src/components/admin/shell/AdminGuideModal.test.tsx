import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AdminGuideModal } from "./AdminGuideModal";
import { defaultBooth, defaultPayment } from "../../../lib/constants";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import type { Product } from "../../../types/catalog";

const sampleProduct: Product = {
  id: "prod-1",
  name: "Acrylic Standee",
  collection: "Series 1",
  description: "Test standee",
  price_vnd: 120000,
  sale_price_vnd: null,
  promotion_eligible: false,
  item_code: "ST01",
  quantity_available: 10,
  category: "Acrylic",
  badge: "New",
  badge_color: "#5f8d55",
  stock_status: "in_stock",
  stock_note: "In stock",
  images: ["https://example.com/item.png"],
  featured: false,
  sort_order: 1,
  active: true,
};

function renderWithI18n(ui: React.ReactElement) {
  return render(<PlatformI18nProvider>{ui}</PlatformI18nProvider>);
}

describe("AdminGuideModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the launch checklist for owners by default with live status", () => {
    const onNavigateTab = vi.fn();
    const onClose = vi.fn();

    renderWithI18n(
      <AdminGuideModal
        isOpen
        onClose={onClose}
        booth={defaultBooth}
        payment={defaultPayment}
        products={[sampleProduct]}
        shopRole="owner"
        shopSlug="demo-shop"
        onNavigateTab={onNavigateTab}
      />,
    );

    expect(screen.getByText("Booth Guide & Playbook")).toBeInTheDocument();
    expect(screen.getByText("Launch Checklist")).toBeInTheDocument();
    expect(screen.getByText("1. VietQR Bank Payment")).toBeInTheDocument();
    expect(screen.getByText("2. Merch Catalog & Stock")).toBeInTheDocument();
    expect(screen.getByText("1 active items")).toBeInTheDocument();

    // Clicking Manage products jumps to products tab and closes
    fireEvent.click(screen.getByRole("button", { name: "Manage products" }));
    expect(onNavigateTab).toHaveBeenCalledWith("products");
    expect(onClose).toHaveBeenCalled();
  });

  it("hides the launch checklist for staff and defaults to convention cheat sheet", () => {
    const onNavigateTab = vi.fn();
    const onClose = vi.fn();

    renderWithI18n(
      <AdminGuideModal
        isOpen
        onClose={onClose}
        booth={defaultBooth}
        payment={defaultPayment}
        products={[]}
        shopRole="staff"
        shopSlug="demo-shop"
        onNavigateTab={onNavigateTab}
      />,
    );

    expect(screen.queryByText("Launch Checklist")).not.toBeInTheDocument();
    expect(screen.getByText("Convention Cheat Sheet")).toBeInTheDocument();
    expect(screen.getByText("15-Minute Order Reservation")).toBeInTheDocument();
    expect(screen.getByText("Confirming Bank Payments")).toBeInTheDocument();
    expect(screen.getByText("Spotty / Dead Convention Wi-Fi")).toBeInTheDocument();
  });

  it("switches to the Feature Playbook tab and navigates to gacha", () => {
    const onNavigateTab = vi.fn();
    const onClose = vi.fn();

    renderWithI18n(
      <AdminGuideModal
        isOpen
        onClose={onClose}
        booth={defaultBooth}
        payment={defaultPayment}
        products={[]}
        shopRole="admin"
        shopSlug="demo-shop"
        onNavigateTab={onNavigateTab}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Feature Playbook" }));
    expect(screen.getByText("Gacha Minigame & Pity System")).toBeInTheDocument();
    expect(screen.getByText("Staff Tablet & PIN Security")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Gacha Manager" }));
    expect(onNavigateTab).toHaveBeenCalledWith("gacha");
    expect(onClose).toHaveBeenCalled();
  });

  it("opens the customer storefront preview in a new window", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const onNavigateTab = vi.fn();
    const onClose = vi.fn();

    renderWithI18n(
      <AdminGuideModal
        isOpen
        onClose={onClose}
        booth={defaultBooth}
        payment={defaultPayment}
        products={[]}
        shopRole="owner"
        shopSlug="demo-shop"
        onNavigateTab={onNavigateTab}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open preview" }));
    expect(openSpy).toHaveBeenCalledWith(
      "/s/demo-shop",
      "_blank",
      "noopener,noreferrer",
    );
    expect(onClose).toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
