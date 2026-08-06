import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  retry: vi.fn(),
  reportError: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({
    error: mocks.toastError,
    info: mocks.toastInfo,
    success: mocks.toastSuccess,
  }),
}));
vi.mock("../../lib/api/orders", () => ({
  getOrderNotificationStatus: mocks.getStatus,
  retryOrderNotification: mocks.retry,
}));
vi.mock("../../lib/i18n/platformI18n", () => ({
  usePlatformI18n: () => ({ t: (value: string) => value }),
}));
vi.mock("../../lib/observability", () => ({ reportError: mocks.reportError }));

import { useAdminNotifications } from "./useAdminNotifications";

const status = {
  order_id: "order-1",
  state: "failed" as const,
  attempt_count: 1,
  next_retry_at: null,
  last_error: "network",
};

describe("useAdminNotifications", () => {
  beforeEach(() => {
    mocks.getStatus.mockResolvedValue([status]);
    mocks.retry.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads notification status and refreshes it after a successful retry", async () => {
    const { result } = renderHook(() =>
      useAdminNotifications({ enabled: true, shopId: "shop-1" }),
    );

    await waitFor(() => expect(result.current.statuses).toEqual([status]));
    await act(async () => {
      await result.current.retry("order-1");
    });

    expect(mocks.retry).toHaveBeenCalledWith(
      "shop-1",
      "order-1",
      "admin_attention_panel",
    );
    expect(mocks.getStatus).toHaveBeenCalledTimes(2);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Order alert queued for another delivery attempt.",
    );
  });

  it("reports background refresh failures without showing a toast", async () => {
    const error = new Error("status unavailable");
    mocks.getStatus.mockRejectedValue(error);
    renderHook(() =>
      useAdminNotifications({ enabled: true, shopId: "shop-1" }),
    );

    await waitFor(() =>
      expect(mocks.reportError).toHaveBeenCalledWith(error, {
        stage: "admin_notification_status",
        shopId: "shop-1",
      }),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
