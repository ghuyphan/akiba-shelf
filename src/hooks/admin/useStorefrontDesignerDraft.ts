import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoothSettings, PaymentSettings } from "../../types/catalog";

export type StorefrontDesignerSnapshot = {
  booth: BoothSettings;
  payment: PaymentSettings;
};

const sourceConflictMessage =
  "A newer storefront version is available. Your unpublished edits are preserved until you reset them.";

function equal(left: unknown, right: unknown) {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useStorefrontDesignerDraft({
  shopId,
  settings,
  payment,
  clearError,
}: {
  shopId: string;
  settings: BoothSettings;
  payment: PaymentSettings;
  clearError: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [paymentDraft, setPaymentDraft] = useState(payment);
  const draftRef = useRef(settings);
  const paymentDraftRef = useRef(payment);
  const [history, setHistory] = useState<StorefrontDesignerSnapshot[]>([]);
  const [future, setFuture] = useState<StorefrontDesignerSnapshot[]>([]);
  const [syncNotice, setSyncNotice] = useState("");
  const sourceSnapshotRef = useRef({ shopId, booth: settings, payment });

  const clearHistory = useCallback(() => {
    setHistory([]);
    setFuture([]);
  }, []);

  useEffect(() => {
    const previous = sourceSnapshotRef.current;
    const shopChanged = previous.shopId !== shopId;
    const boothChanged = !equal(previous.booth, settings);
    const paymentChanged = !equal(previous.payment, payment);
    const boothDirty = !equal(draftRef.current, previous.booth);
    const paymentDirty = !equal(paymentDraftRef.current, previous.payment);
    const boothConflict =
      boothChanged && boothDirty && !equal(draftRef.current, settings);
    const paymentConflict =
      paymentChanged &&
      paymentDirty &&
      !equal(paymentDraftRef.current, payment);

    sourceSnapshotRef.current = { shopId, booth: settings, payment };
    if (shopChanged) {
      draftRef.current = settings;
      paymentDraftRef.current = payment;
      setDraft(settings);
      setPaymentDraft(payment);
      clearHistory();
      setSyncNotice("");
      clearError();
      return;
    }

    if (boothChanged && !boothConflict) {
      draftRef.current = settings;
      setDraft(settings);
    }
    if (paymentChanged && !paymentConflict) {
      paymentDraftRef.current = payment;
      setPaymentDraft(payment);
    }
    if (
      (boothChanged && !boothConflict) ||
      (paymentChanged && !paymentConflict)
    ) {
      clearHistory();
      clearError();
    }
    setSyncNotice(
      boothConflict || paymentConflict ? sourceConflictMessage : "",
    );
  }, [clearError, clearHistory, payment, settings, shopId]);

  const commitSnapshot = useCallback((next: StorefrontDesignerSnapshot) => {
    const current = {
      booth: draftRef.current,
      payment: paymentDraftRef.current,
    };
    if (equal(next, current)) return;
    setHistory((items) => [...items.slice(-49), current]);
    setFuture([]);
    draftRef.current = next.booth;
    paymentDraftRef.current = next.payment;
    setDraft(next.booth);
    setPaymentDraft(next.payment);
  }, []);

  const undo = useCallback(() => {
    setHistory((items) => {
      const previous = items[items.length - 1];
      if (!previous) return items;
      setFuture((futureItems) =>
        [
          { booth: draftRef.current, payment: paymentDraftRef.current },
          ...futureItems,
        ].slice(0, 50),
      );
      draftRef.current = previous.booth;
      paymentDraftRef.current = previous.payment;
      setDraft(previous.booth);
      setPaymentDraft(previous.payment);
      return items.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((items) => {
      const next = items[0];
      if (!next) return items;
      setHistory((historyItems) => [
        ...historyItems.slice(-49),
        { booth: draftRef.current, payment: paymentDraftRef.current },
      ]);
      draftRef.current = next.booth;
      paymentDraftRef.current = next.payment;
      setDraft(next.booth);
      setPaymentDraft(next.payment);
      return items.slice(1);
    });
  }, []);

  const discardChanges = useCallback(() => {
    draftRef.current = settings;
    paymentDraftRef.current = payment;
    setDraft(settings);
    setPaymentDraft(payment);
    clearHistory();
    setSyncNotice("");
    clearError();
  }, [clearError, clearHistory, payment, settings]);

  const hasChanges = useMemo(
    () => !equal(draft, settings) || !equal(paymentDraft, payment),
    [draft, payment, paymentDraft, settings],
  );

  return {
    draft,
    paymentDraft,
    draftRef,
    paymentDraftRef,
    history,
    future,
    syncNotice,
    setSyncNotice,
    hasChanges,
    commitSnapshot,
    undo,
    redo,
    discardChanges,
    clearHistory,
  };
}
