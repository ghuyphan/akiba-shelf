import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelCustomerOrder,
  createOrder,
  getCustomerOrder,
  isCheckoutOutcomeUnknownError,
} from "../lib/api";
import { getErrorMessage, isTransportError } from "../lib/errors";
import {
  clearCheckoutSession,
  createCheckoutSession,
  loadCheckoutSession,
  saveCheckoutSession,
} from "../lib/offline/checkoutSession";
import type { CartItem, CheckoutSession, Order } from "../types/catalog";

type CheckoutConnectionState =
  | "online"
  | "offline"
  | "reconnecting"
  | "error";

type UseCheckoutSessionOptions = {
  shopSlug: string;
  cart: CartItem[];
  onOrderChange?: (order: Order | null) => void;
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
  onConfirmed,
}: UseCheckoutSessionOptions) {
  const [session, setSession] = useState<CheckoutSession | null>(() =>
    loadCheckoutSession(shopSlug),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
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
  const onConfirmedRef = useRef(onConfirmed);

  sessionRef.current = session;
  onOrderChangeRef.current = onOrderChange;
  onConfirmedRef.current = onConfirmed;

  const persist = useCallback((next: CheckoutSession | null) => {
    sessionRef.current = next;
    setSession(next);
    if (next) saveCheckoutSession(next);
    else clearCheckoutSession(shopSlug);
  }, [shopSlug]);

  const reserve = useCallback(
    (target: CheckoutSession) => {
      if (target.order) return Promise.resolve(target.order);
      if (submissionRef.current) return submissionRef.current;

      const attempting: CheckoutSession = {
        ...target,
        state: "queued",
        updatedAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
        lastError: undefined,
      };
      persist(attempting);
      setIsSubmitting(true);

      const request = createOrder(
        shopSlug,
        attempting.customerName,
        attempting.cart,
        attempting.clientRequestId,
        attempting.recoveryToken,
      )
        .then((order) => {
          const reserved = sessionWithOrder(attempting, order);
          persist(reserved);
          setConnectionState("online");
          onOrderChangeRef.current?.(order);
          if (order.status === "confirmed" && !confirmedHandledRef.current) {
            confirmedHandledRef.current = true;
            onConfirmedRef.current?.();
          }
          return order;
        })
        .catch((error: unknown) => {
          const queued =
            isTransportError(error) || isCheckoutOutcomeUnknownError(error);
          persist({
            ...attempting,
            state: queued ? "queued" : "needs_review",
            updatedAt: new Date().toISOString(),
            lastError: queued
              ? "Reconnect to verify stock and reserve these items."
              : getErrorMessage(
                  error,
                  "Stock or pricing changed. Review your cart and try again.",
                ),
          });
          if (queued) {
            setConnectionState(navigator.onLine ? "reconnecting" : "offline");
          } else {
            setConnectionState("online");
          }
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
    async (customerName: string) => {
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
            }
          : createCheckoutSession(shopSlug, cart, customerName);
      persist(next);
      return reserve(next);
    },
    [cart, persist, reserve, shopSlug],
  );

  const retry = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.order) return Promise.resolve(null);
    return reserve(current);
  }, [reserve]);

  const refreshOrder = useCallback(() => {
    const current = sessionRef.current;
    if (!current?.order || current.order.status !== "pending")
      return Promise.resolve();
    if (!navigator.onLine) {
      setConnectionState("offline");
      return Promise.resolve();
    }
    if (refreshRef.current) return refreshRef.current;

    const request = getCustomerOrder(
      current.order.id,
      current.recoveryToken,
    )
      .then((order) => {
        if (!order) throw new Error("Order recovery details are no longer valid.");
        const next = sessionWithOrder(current, order);
        persist(next);
        setConnectionState("online");
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
      })
      .finally(() => {
        refreshRef.current = null;
      });
    refreshRef.current = request;
    return request;
  }, [persist]);

  const cancel = useCallback(async () => {
    const current = sessionRef.current;
    if (!current?.order || !navigator.onLine) return null;
    setIsCancelling(true);
    try {
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
  }, [persist]);

  const clear = useCallback(() => {
    persist(null);
    onOrderChangeRef.current?.(null);
  }, [persist]);

  useEffect(() => {
    const next = loadCheckoutSession(shopSlug);
    persist(next);
    confirmedHandledRef.current = next?.state === "confirmed";
    onOrderChangeRef.current?.(next?.order ?? null);
    if (
      resumedShopRef.current !== shopSlug &&
      next?.state === "queued" &&
      navigator.onLine
    ) {
      resumedShopRef.current = shopSlug;
      void reserve(next);
    }
  }, [persist, reserve, shopSlug]);

  useEffect(() => {
    const resume = () => {
      const current = sessionRef.current;
      if (current?.order) void refreshOrder();
      else if (current?.state === "queued") void reserve(current);
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
  }, [refreshOrder, reserve]);

  useEffect(() => {
    const order = session?.order;
    if (!order || order.status !== "pending") return;
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
    start,
    retry,
    refreshOrder,
    cancel,
    clear,
  };
}
