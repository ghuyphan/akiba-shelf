import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CSSProperties } from "react";
import type { CheckoutSession, Order } from "../../../types/catalog";
import {
  FloatingCartBar,
  PendingOrderBar,
  RecoverCheckoutBar,
} from "./CatalogOverlays";

afterEach(cleanup);

describe("PendingOrderBar", () => {
  it("renders at the page layer instead of inside the storefront shell", () => {
    const onOpen = vi.fn();
    const host = document.createElement("div");
    host.className = "app-shell";
    document.body.append(host);

    render(
      <PendingOrderBar
        order={{ order_code: "AK-00000011", total_amount: 30_000 } as Order}
        onOpen={onOpen}
        style={{ "--coral": "#5f8d55" } as CSSProperties}
      />,
      { container: host },
    );

    const notice = screen.getByRole("status");
    expect(notice.parentElement).toBe(document.body);
    expect(notice).toHaveClass(
      "storefront-dock",
      "storefront-dock-order",
      "pending-order-bar",
    );
    expect(notice).toHaveStyle({ "--coral": "#5f8d55" });
    expect(notice.querySelector(".storefront-dock-copy")).not.toBeNull();
    expect(notice.querySelector(".storefront-dock-total")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View payment" }));
    expect(onOpen).toHaveBeenCalledOnce();
    host.remove();
  });
});

describe("FloatingCartBar", () => {
  it("uses the shared page-level dock structure and keeps its cart action", () => {
    const onOpen = vi.fn();
    const host = document.createElement("div");
    host.className = "catalog-screen";
    document.body.append(host);

    render(
      <FloatingCartBar itemCount={4} total={120_000} onOpen={onOpen} />,
      { container: host },
    );

    const notice = screen.getByRole("status");
    expect(notice.parentElement).toBe(document.body);
    expect(notice).toHaveClass(
      "storefront-dock",
      "storefront-dock-cart",
      "floating-cart-bar",
    );
    expect(notice.querySelector(".storefront-dock-badge")).toHaveTextContent(
      "4",
    );
    expect(notice.querySelector(".storefront-dock-copy")).not.toBeNull();
    expect(notice.querySelector(".storefront-dock-total")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View cart" }));
    expect(onOpen).toHaveBeenCalledOnce();
    host.remove();
  });
});

describe("RecoverCheckoutBar", () => {
  it("offers a single safe resume action for persisted checkout state", () => {
    const onOpen = vi.fn();
    render(
      <RecoverCheckoutBar
        session={{ state: "queued" } as CheckoutSession}
        total={85_000}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText("Checkout saved on this device")).toBeInTheDocument();
    expect(screen.getByText(/without creating a duplicate order/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
