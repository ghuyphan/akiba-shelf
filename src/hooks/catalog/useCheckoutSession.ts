import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelCustomerOrder,
  createOrder,
  getCustomerOrder,
  isCheckoutOutcomeUnknownError,
  isCheckoutSecurityError,
} from "../../lib/api/orders";
import { getErrorMessage, isTransportError } from "../../lib/errors";
import {
  clearCheckoutSession,
  createCheckoutSession,
  loadCheckoutSession,
  saveCheckoutSession,
} from "../../lib/offline/checkoutSession";
import {
  createOfflineEventOrder,
  isOfflineEventStorageUnavailableError,
  listOfflineEventOrders,
  loadOfflineEventSessionBySlug,
  offlineEventOrderAsOrder,
  updateOfflineEventOrder,
} from "../../lib/offline/offlineEvents";
import type { CartItem, CheckoutSession, Order } from "../../types/catalog";
import { trackClientEvent } from "../../lib/observability";

type CheckoutConnectionState =
  | "online"
  | "offline"
  | "reconnecting"
  | "error";

type CheckoutMode =
  | "checking"
  | "online"
  | "offline_event"
  | "event_storage_unavailable";

type UseCheckoutSessionOptions = {
  shopSlug: string;
  cart: CartItem[];
  onOrderChange?: (order: Order | null) => void;
  onSessionChange?: (session: CheckoutSession | null) => void;
  onConfirmed?: () => void;
};

function sessionWithOrder(
  session: CheckoutSession,
  order: Order,
): CheckoutSession {
  return {
    ...session,
    order,
    state: order.status === "pending" ? "reserved" : order.status,
    updatedAt: new Date().toISOString(),
    lastError: undefined,
  };
}

export function useCheckoutSession({
  shopSlug,
  cart,
  onOrderChange,
  onSessionChange,
  onConfirmed,
}: UseCheckoutSessionOptions) {
  const [session, setSession] = useState<CheckoutSession | null>(() =>
    loadCheckoutSession(shopSlug),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [checkoutMode, setCheckoutMode] =
    useState<CheckoutMode>("online");
  const [connectionState, setConnectionState] =
    useState<CheckoutConnectionState>(
      navigator.onLine ? "online" : "offline",
    );
  const sessionRef = useRef(session);
  const submissionRef = useRef<Promise<Order | null> | null>(null);
  const refreshRef = useRef<Promise<void> | null>(null);
  const confirmedHandledRef = useRef(false);
  const resumedShopRef = useRef("");
  const onOrderChangeRef = useRef(onOrderChange);
  const onSessionChangeRef = useRef(onSessionChange);
  const onConfirmedRef = useRef(onConfirmed);

  sessionRef.current = session;
  onOrderChangeRef.current = onOrderChange;
  onSessionChangeRef.current = onSessionChange;
  onConfirmedRef.current = onConfirmed;

  const persist = useCallback((next: CheckoutSession | null) => {
    sessionRef.current = next;
    setSession(next);
    if (next) saveCheckoutSession(next);
    else clearCheckoutSession(shopSlug);
    onSessionChangeRef.current?.(next);
  }, [shopSlug]);

  const reserve = useCallback(
    (target: CheckoutSession, turnstileToken: string | null) => {
      if (target.order) return Promise.resolve(target.order);
      if (submissionRef.current) return submissionRef.current;

      const attempting: CheckoutSession = {
        ...target,
        state: "queued",
        updatedAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
        lastError: undefined,
        lastErrorCode: undefined,
      };
      persist(attempting);
      setIsSubmitting(true);

      const request = loadOfflineEventSessionBySlug(shopSlug)
        .then((eventSession) => {
          if (eventSession?.status === "active") {
            return createOfflineEventOrder(
              eventSession,
              attempting.cart,
              attempting.customerName,
            ).then(offlineEventOrderAsOrder);
          }
          if (!navigator.onLine) {
            throw new TypeError("Failed to fetch");
          }
          if (!turnstileToken) {
            throw new Error(
              "Complete the security check before continuing.",
            );
          }
          return createOrder(
            shopSlug,
            attempting.customerName,
            attempting.cart,
            attempting.clientRequestId,
            attempting.recoveryToken,
            turnstileToken,
          );
        })
        .then((order) => {
          const reserved = sessionWithOrder(attempting, order);
          persist(reserved);
          setConnectionState(
            order.source === "offline_event" && !navigator.onLine
              ? "offline"
              : "online",
          );
          onOrderChangeRef.current?.(order);
          if (order.status === "confirmed" && !confirmedHandledRef.current) {
            confirmedHandledRef.current = true;
            onConfirmedRef.current?.();
          }
          return order;
        })
        .catch((error: unknown) => {
          const eventStorageUnavailable =
            isOfflineEventStorageUnavailableError(error);
          const securityVerificationFailed = isCheckoutSecurityError(error);
          const queued =
            !eventStorageUnavailable &&
            (isTransportError(error) || isCheckoutOutcomeUnknownError(error));
          persist({
            ...attempting,
            state:
              queued || eventStorageUnavailable ? "queued" : "needs_review",
            updatedAt: new Date().toISOString(),
            lastError: eventStorageUnavailable
              ? undefined
              : queued
                ? "Reconnect to verify stock and reserve these items."
                : getErrorMessage(
                    error,
                    "Stock or pricing changed. Review your cart and try again.",
                  ),
            lastErrorCode: eventStorageUnavailable
              ? "offline_event_storage_unavailable"
              : securityVerificationFailed
                ? "security_verification_failed"
              : undefined,
          });
          if (queued || eventStorageUnavailable) {
            setConnectionState(navigator.onLine ? "reconnecting" : "offline");
          } else {
            setConnectionState("online");
          }
          trackClientEvent(
            "checkout_failure",
            {
              stage: "reservation",
              shop: shopSlug,
              retryable: queued,
              offlineEventStorage: eventStorageUnavailable,
            },
            queued ? "warning" : "error",
          );
          return null;
        })
        .finally(() => {
          submissionRef.current = null;
          setIsSubmitting(false);
        });
      submissionRef.current = request;
      return request;
    },
    [persist, shopSlug],
  );

  const start = useCallback(
    async (customerName: string, turnstileToken: string | null) => {
      const existing = sessionRef.current;
      const next =
        existing && !existing.order
          ? {
              ...existing,
              customerName,
              cart,
              state: "queued" as const,
              updatedAt: new Date().toISOString(),
              lastError: undefined,
              lastErrorCode: undefined,
            }
          : createCheckoutSession(shopSlug, cart, customerName);
      persist(next);
      return reserve(next, turnstileToken);
    },
    [cart, persist, reserve, shopSlug],
  );

  const retry = useCallback((turnstileToken: string | null) => {
    const current = sessionRef.current;
    if (!current || current.order) return Promise.resolve(null);
    return reserve(current, turnstileToken);
  }, [reserve]);

  const refreshOrder = useCallback(() => {
    const current = sessionRef.current;
    if (!current?.order || current.order.status !== "pending")
      return Promise.resolve();
    if (!navigator.onLine && current.order.source !== "offline_event") {
      setConnectionState("offline");
      return Promise.resolve();
    }
    if (refreshRef.current) return refreshRef.current;

    const request = (
      current.order.source === "offline_event"
        ? loadOfflineEventSessionBySlug(shopSlug).then(async (eventSession) => {
            if (!eventSession) return null;
            const orders = await listOfflineEventOrders(eventSession.id);
            const localOrder = orders.find(
              (order) => order.id === current.order?.id,
            );
            return localOrder ? offlineEventOrderAsOrder(localOrder) : null;
          })
        : getCustomerOrder(current.order.id, current.recoveryToken)
    )
      .then((order) => {
        if (!order) throw new Error("Order recovery details are no longer valid.");
        const next = sessionWithOrder(current, order);
        persist(next);
        setConnectionState(
          order.source === "offline_event" && !navigator.onLine
            ? "offline"
            : "online",
        );
        onOrderChangeRef.current?.(order);
        if (order.status === "confirmed" && !confirmedHandledRef.current) {
          confirmedHandledRef.current = true;
          onConfirmedRef.current?.();
        }
      })
      .catch((error: unknown) => {
        setConnectionState(
          isTransportError(error)
            ? navigator.onLine
              ? "reconnecting"
              : "offline"
            : "error",
        );
        trackClientEvent(
          "checkout_failure",
          {
            stage: "recovery",
            shop: shopSlug,
            transport: isTransportError(error),
          },
          "warning",
        );
      })
      .finally(() => {
        refreshRef.current = null;
      });
    refreshRef.current = request;
    return request;
  }, [persist, shopSlug]);

  const cancel = useCallback(async () => {
    const current = sessionRef.current;
    if (!current?.order) return null;
    if (current.order.source !== "offline_event" && !navigator.onLine)
      return null;
    setIsCancelling(true);
    try {
      if (current.order.source === "offline_event") {
        const eventSession = await loadOfflineEventSessionBySlug(shopSlug);
        if (!eventSession) return null;
        const result = await updateOfflineEventOrder(
          eventSession,
          current.order.id,
          { status: "cancelled", paymentState: "awaiting_payment" },
        );
        const order = offlineEventOrderAsOrder(result.order);
        const next = sessionWithOrder(current, order);
        persist(next);
        onOrderChangeRef.current?.(order);
        return order;
      }
      const result = await cancelCustomerOrder(
        current.order.id,
        current.recoveryToken,
      );
      if (!result.order) return null;
      const next = sessionWithOrder(current, result.order);
      persist(next);
      onOrderChangeRef.current?.(result.order);
      return result.order;
    } finally {
      setIsCancelling(false);
    }
  }, [persist, shopSlug]);

  const clear = useCallback(() => {
    persist(null);
    onOrderChangeRef.current?.(null);
  }, [persist]);

  useEffect(() => {
    let cancelled = false;
    void loadOfflineEventSessionBySlug(shopSlug)
      .then((eventSession) => {
        if (cancelled) return;
        setCheckoutMode(
          eventSession?.status === "active" ? "offline_event" : "online",
        );
      })
      .catch(() => {
        if (!cancelled) setCheckoutMode("event_storage_unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [shopSlug]);

  useEffect(() => {
    const next = loadCheckoutSession(shopSlug);
    persist(next);
    confirmedHandledRef.current = next?.state === "confirmed";
    onOrderChangeRef.current?.(next?.order ?? null);
    if (resumedShopRef.current !== shopSlug && next?.state === "queued") {
      resumedShopRef.current = shopSlug;
      setConnectionState(navigator.onLine ? "online" : "offline");
    }
  }, [persist, shopSlug]);

  useEffect(() => {
    const resume = () => {
      const current = sessionRef.current;
      if (current?.order) void refreshOrder();
      else if (current?.state === "queued") {
        setConnectionState(navigator.onLine ? "online" : "offline");
      }
    };
    const handleOnline = () => resume();
    const handleOffline = () => setConnectionState("offline");
    const handleFocus = () => resume();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") resume();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshOrder]);

  useEffect(() => {
    const order = session?.order;
    if (!order || order.status !== "pending") return;
    if (connectionState === "offline" && order.source !== "offline_event")
      return;
    void refreshOrder();
    const poll = window.setInterval(
      () => void refreshOrder(),
      connectionState === "online" ? 5000 : 15000,
    );
    return () => {
      window.clearInterval(poll);
    };
  }, [connectionState, refreshOrder, session?.order]);

  return {
    session,
    order: session?.order ?? null,
    isSubmitting,
    isCancelling,
    connectionState,
    checkoutMode,
    start,
    retry,
    refreshOrder,
    cancel,
    clear,
  };
}
