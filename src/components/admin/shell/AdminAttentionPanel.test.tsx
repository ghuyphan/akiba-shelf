import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultBooth, defaultPayment } from "../../../lib/constants";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import {
  AdminAttentionPanel,
  getNotificationAttention,
  getShopReadiness,
} from "./AdminAttentionPanel";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AdminAttentionPanel", () => {
  it("derives a production checklist from already-loaded shop data", () => {
    expect(getShopReadiness(defaultBooth, defaultPayment, [])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "catalog", complete: false }),
        expect.objectContaining({ key: "payment", complete: false }),
        expect.objectContaining({ key: "identity", complete: false }),
        expect.objectContaining({ key: "visit", complete: false }),
      ]),
    );
  });

  it("shows time-sensitive orders, low stock, and the next setup action", () => {
    render(
      <PlatformI18nProvider>
        <AdminAttentionPanel
          booth={defaultBooth}
          payment={defaultPayment}
          products={[]}
          expiringOrderCount={2}
          lowStockCount={3}
          notificationStatuses={[]}
          canManageCatalog
          canRetryNotifications={false}
          onOpenOrders={vi.fn()}
          onOpenProducts={vi.fn()}
          onOpenSettings={vi.fn()}
          onRetryNotification={vi.fn()}
        />
      </PlatformI18nProvider>,
    );

    expect(
      screen.getByText("2 visible reservations expire soon"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("3 products are low or sold out"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Production checklist · 0/4 ready"),
    ).toBeInTheDocument();
  });

  it("uses queue aggregates for notification attention without counting skipped deliveries", () => {
    const now = new Date("2026-07-23T10:00:00.000Z").getTime();
    expect(
      getNotificationAttention(
        [
          {
            order_id: "40000000-0000-4000-8000-000000000001",
            status: "skipped",
            attempt_count: 1,
            failed_endpoint_count: 0,
            next_attempt_at: null,
            delivered_at: null,
            skipped_at: "2026-07-23T09:55:00.000Z",
            dead_lettered_at: null,
            updated_at: "2026-07-23T09:55:00.000Z",
            last_error: null,
            due_count: 4,
            oldest_due_at: "2026-07-23T09:45:00.000Z",
            retryable_failed_count: 2,
            dead_letter_count: 1,
          },
        ],
        now,
      ),
    ).toEqual({
      retryingCount: 2,
      deadLetterCount: 1,
      overdueCount: 4,
      oldestDueAt: "2026-07-23T09:45:00.000Z",
    });
  });

  it("shows a concise manual-review alert and lets an admin retry it", async () => {
    const onRetryNotification = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    render(
      <PlatformI18nProvider>
        <AdminAttentionPanel
          booth={{
            ...defaultBooth,
            booth_name: "Matsuri",
            subtitle: "Artist goods",
            location: "Hall A",
            open_hours: "10:00-18:00",
          }}
          payment={{ ...defaultPayment, payment_instructions: "Pay at desk" }}
          products={[
            {
              id: "product-1",
              name: "Print",
              collection: "",
              description: "",
              price_vnd: 100,
              item_code: "PRINT-1",
              quantity_available: 10,
              category: "Prints",
              stock_status: "in_stock",
              stock_note: "",
              images: [],
              featured: false,
              sort_order: 0,
              active: true,
            },
          ]}
          expiringOrderCount={0}
          lowStockCount={0}
          notificationStatuses={[
            {
              order_id: "40000000-0000-4000-8000-000000000001",
              status: "dead_letter",
              attempt_count: 6,
              failed_endpoint_count: 2,
              next_attempt_at: "2026-07-23T09:45:00.000Z",
              delivered_at: null,
              skipped_at: null,
              dead_lettered_at: "2026-07-23T09:50:00.000Z",
              updated_at: "2026-07-23T09:50:00.000Z",
              last_error: "push_provider_rejected",
              due_count: 0,
              oldest_due_at: null,
              retryable_failed_count: 0,
              dead_letter_count: 1,
            },
          ]}
          canManageCatalog
          canRetryNotifications
          onOpenOrders={vi.fn()}
          onOpenProducts={vi.fn()}
          onOpenSettings={vi.fn()}
          onRetryNotification={onRetryNotification}
        />
      </PlatformI18nProvider>,
    );

    expect(
      screen.getByText("1 order alerts need manual review"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "1 stopped after all retries. Check staff notification devices.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry alert" }));
    expect(onRetryNotification).toHaveBeenCalledWith(
      "40000000-0000-4000-8000-000000000001",
    );
  });

  it("does not expose notification replay to staff", () => {
    render(
      <PlatformI18nProvider>
        <AdminAttentionPanel
          booth={defaultBooth}
          payment={defaultPayment}
          products={[]}
          expiringOrderCount={0}
          lowStockCount={0}
          notificationStatuses={[
            {
              order_id: "40000000-0000-4000-8000-000000000001",
              status: "skipped",
              attempt_count: 1,
              failed_endpoint_count: 0,
              next_attempt_at: null,
              delivered_at: null,
              skipped_at: "2026-07-23T09:50:00.000Z",
              dead_lettered_at: null,
              updated_at: "2026-07-23T09:50:00.000Z",
              last_error: "no_valid_subscriptions",
              due_count: 0,
              oldest_due_at: null,
              retryable_failed_count: 0,
              dead_letter_count: 0,
            },
          ]}
          canManageCatalog={false}
          canRetryNotifications={false}
          onOpenOrders={vi.fn()}
          onOpenProducts={vi.fn()}
          onOpenSettings={vi.fn()}
          onRetryNotification={vi.fn()}
        />
      </PlatformI18nProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Retry alert" }),
    ).not.toBeInTheDocument();
  });
});
