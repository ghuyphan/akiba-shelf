import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CloudOff,
  Download,
  ExternalLink,
  LoaderCircle,
  PackageX,
  RefreshCw,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  activateOfflineEventSession,
  finalizeOfflineEventSession,
  getOfflineEventDraft,
  listOfflineEvents,
  recoverOfflineEventSession,
  saveOfflineEventDraft,
  syncOfflineEventOrders,
} from "../../lib/api";
import { getErrorMessage } from "../../lib/errors";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import { saveCatalogSnapshot } from "../../lib/offline/offline";
import {
  downloadGachaOfflinePacks,
  gachaCatalogOfflineUrls,
} from "../../lib/offline/offlinePack";
import { prepareStorefrontOffline } from "../../lib/offline/storefrontOffline";
import { refreshGachaLaunch } from "../../lib/gacha/gachaLaunch";
import {
  closeLocalOfflineEvent,
  assertOfflineEventStorageAvailable,
  freezeOfflineEventSession,
  getOfflineEventDeviceId,
  listOfflineEventOrders,
  loadOfflineEventSession,
  markOfflineEventOrdersSynced,
  mergeRecoveredOfflineEventSession,
  OFFLINE_EVENT_UPDATED,
  requestDurableOfflineStorage,
  saveOfflineEventSession,
  updateOfflineEventOrder,
  updateOfflineEventOrderFulfillment,
} from "../../lib/offline/offlineEvents";
import type {
  BoothSettings,
  OfflineEventOrder,
  OfflineEventSession,
  PaymentSettings,
  Product,
  PromotionSettings,
} from "../../types/catalog";
import { formatVnd } from "../../utils/format";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/ToastProvider";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { EmptyState } from "../ui/EmptyState";
import { StatusPill } from "../ui/StatusPill";

type OfflineEventManagerProps = {
  shopId: string;
  shopSlug: string;
  products: Product[];
  booth: BoothSettings;
  payment: PaymentSettings;
  promotion: PromotionSettings;
};

function toLocalDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function fromLocalDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function defaultEventEnd() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

type LoadState = "idle" | "loading" | "ready" | "error";

export function OfflineEventManager({
  shopId,
  shopSlug,
  products,
  booth,
  payment,
  promotion,
}: OfflineEventManagerProps) {
  const { locale, t } = usePlatformI18n();
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US";
  const toast = useToast();
  const [session, setSession] = useState<OfflineEventSession | null>(null);
  const [orders, setOrders] = useState<OfflineEventOrder[]>([]);
  const [name, setName] = useState("");
  const [draftId, setDraftId] = useState<string>();
  const [scheduledStart, setScheduledStart] = useState(() =>
    toLocalDateTime(new Date()),
  );
  const [scheduledEnd, setScheduledEnd] = useState(() =>
    toLocalDateTime(defaultEventEnd()),
  );
  const [allocationQuantities, setAllocationQuantities] = useState<
    Record<string, number>
  >({});
  const [busy, setBusy] = useState<"start" | "sync" | "close" | string>();
  const [online, setOnline] = useState(navigator.onLine);
  const [isOpen, setIsOpen] = useState(false);
  const [gachaPreparationProgress, setGachaPreparationProgress] = useState<
    number | null
  >(null);
  const [loadedShopId, setLoadedShopId] = useState("");
  const [localLoadState, setLocalLoadState] = useState<LoadState>("loading");
  const [localLoadError, setLocalLoadError] = useState("");
  const [recoveryState, setRecoveryState] = useState<LoadState>("idle");
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [draftLoadState, setDraftLoadState] = useState<LoadState>("idle");
  const [draftLoadError, setDraftLoadError] = useState("");
  const [orderToCancel, setOrderToCancel] = useState<OfflineEventOrder | null>(
    null,
  );
  const [confirmClose, setConfirmClose] = useState(false);
  const syncPromiseRef = useRef<Promise<boolean> | null>(null);
  const localRequestRef = useRef(0);
  const draftRequestRef = useRef(0);
  const formRevisionRef = useRef(0);

  const resetDraftForm = useCallback(() => {
    setDraftId(undefined);
    setName("");
    setScheduledStart(toLocalDateTime(new Date()));
    setScheduledEnd(toLocalDateTime(defaultEventEnd()));
    setAllocationQuantities({});
  }, []);

  const markFormEdited = useCallback(() => {
    formRevisionRef.current += 1;
    draftRequestRef.current += 1;
    setDraftLoadState("ready");
    setDraftLoadError("");
  }, []);

  const loadLatestDraft = useCallback(async () => {
    const requestId = ++draftRequestRef.current;
    const startingRevision = formRevisionRef.current;
    setDraftLoadError("");
    if (!online) {
      setDraftLoadState("ready");
      return;
    }
    setDraftLoadState("loading");
    try {
      const event = (await listOfflineEvents(shopId)).find(
        (candidate) => candidate.status === "draft",
      );
      if (
        requestId !== draftRequestRef.current ||
        startingRevision !== formRevisionRef.current
      )
        return;
      if (!event) {
        resetDraftForm();
        setDraftLoadState("ready");
        return;
      }
      const draft = await getOfflineEventDraft(shopId, shopSlug, event.id);
      if (
        requestId !== draftRequestRef.current ||
        startingRevision !== formRevisionRef.current
      )
        return;
      setDraftId(draft.id);
      setName(draft.name);
      setScheduledStart(toLocalDateTime(draft.scheduledStartAt));
      setScheduledEnd(toLocalDateTime(draft.scheduledEndAt));
      setAllocationQuantities(
        Object.fromEntries(
          draft.allocations.map((allocation) => [
            allocation.product.id,
            allocation.quantityAllocated,
          ]),
        ),
      );
      setDraftLoadState("ready");
    } catch (error) {
      if (requestId !== draftRequestRef.current) return;
      setDraftLoadError(
        t(getErrorMessage(error, "Could not load the event draft.")),
      );
      setDraftLoadState("error");
    }
  }, [online, resetDraftForm, shopId, shopSlug, t]);

  const reloadLocal = useCallback(
    async (showLoading = false) => {
      const requestId = ++localRequestRef.current;
      if (showLoading) setLocalLoadState("loading");
      setLocalLoadError("");
      try {
        const stored = await loadOfflineEventSession(shopId);
        const storedOrders = stored
          ? await listOfflineEventOrders(stored.id)
          : [];
        if (requestId !== localRequestRef.current) return null;
        setSession(stored);
        setOrders(storedOrders);
        setLocalLoadState("ready");
        return stored;
      } catch (error) {
        if (requestId !== localRequestRef.current) return null;
        setLocalLoadError(
          getErrorMessage(error, "Could not load this device's event data."),
        );
        setLocalLoadState("error");
        return null;
      }
    },
    [shopId],
  );

  useEffect(() => {
    let active = true;
    localRequestRef.current += 1;
    draftRequestRef.current += 1;
    formRevisionRef.current = 0;
    setLoadedShopId("");
    setSession(null);
    setOrders([]);
    setRecoveryState("idle");
    setDraftLoadState("idle");
    setDraftLoadError("");
    setOrderToCancel(null);
    setConfirmClose(false);
    resetDraftForm();
    void reloadLocal(true).finally(() => {
      if (active) setLoadedShopId(shopId);
    });
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ shopId?: string }>).detail;
      if (!detail?.shopId || detail.shopId === shopId) void reloadLocal();
    };
    const handleOnline = () => {
      setOnline(true);
      setRecoveryAttempt((current) => current + 1);
    };
    const handleOffline = () => {
      setOnline(false);
      setRecoveryState("ready");
    };
    const handleFocus = () => void reloadLocal();
    window.addEventListener(OFFLINE_EVENT_UPDATED, update);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    return () => {
      active = false;
      localRequestRef.current += 1;
      draftRequestRef.current += 1;
      window.removeEventListener(OFFLINE_EVENT_UPDATED, update);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
    };
  }, [reloadLocal, resetDraftForm, shopId]);

  useEffect(() => {
    if (
      session ||
      !isOpen ||
      localLoadState !== "ready" ||
      recoveryState !== "ready" ||
      draftLoadState !== "idle"
    )
      return;
    void loadLatestDraft();
  }, [
    draftLoadState,
    isOpen,
    loadLatestDraft,
    localLoadState,
    recoveryState,
    session,
  ]);

  useEffect(() => {
    if (loadedShopId !== shopId || localLoadState !== "ready" || session)
      return;
    if (!online) {
      setRecoveryState("ready");
      return;
    }
    let active = true;
    setRecoveryState("loading");
    const deviceId = getOfflineEventDeviceId();
    recoverOfflineEventSession(shopId, shopSlug, deviceId)
      .then(async (recovered) => {
        if (!active) return;
        if (!recovered) return;
        await mergeRecoveredOfflineEventSession(recovered);
        if (active) await reloadLocal();
      })
      .then(() => {
        if (active) setRecoveryState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setLocalLoadError(
          t(
            getErrorMessage(
              error,
              "Could not check for an active event session.",
            ),
          ),
        );
        setRecoveryState("error");
      });
    return () => {
      active = false;
    };
  }, [
    loadedShopId,
    localLoadState,
    online,
    recoveryAttempt,
    reloadLocal,
    session,
    shopId,
    shopSlug,
    t,
  ]);

  const availableProducts = useMemo(
    () =>
      products.filter(
        (product) => product.active && product.quantity_available > 0,
      ),
    [products],
  );
  const plannedProducts = useMemo(
    () =>
      availableProducts.flatMap((product) => {
        const quantity = Math.min(
          product.quantity_available,
          Math.max(0, Math.floor(allocationQuantities[product.id] ?? 0)),
        );
        return quantity > 0 ? [{ id: product.id, quantity }] : [];
      }),
    [allocationQuantities, availableProducts],
  );
  const plannedQuantity = plannedProducts.reduce(
    (total, product) => total + product.quantity,
    0,
  );
  const scheduledStartIso = fromLocalDateTime(scheduledStart);
  const scheduledEndIso = fromLocalDateTime(scheduledEnd);
  const scheduleIsValid = Boolean(
    scheduledStartIso &&
      scheduledEndIso &&
      Date.parse(scheduledEndIso) > Date.parse(scheduledStartIso),
  );
  const allocationTotal =
    session?.allocations.reduce(
      (total, allocation) => total + allocation.quantityAllocated,
      0,
    ) ?? 0;
  const soldTotal =
    session?.allocations.reduce(
      (total, allocation) => total + allocation.quantitySold,
      0,
    ) ?? 0;
  const sessionIsActive = session?.status === "active";
  const unsyncedCount = orders.filter((order) => !order.syncedAt).length;
  const pendingCount = orders.filter(
    (order) => order.status === "pending",
  ).length;

  async function persistDraft(showToast = true) {
    if (
      !online ||
      !name.trim() ||
      !scheduleIsValid ||
      !scheduledStartIso ||
      !scheduledEndIso ||
      !plannedProducts.length
    )
      return null;
    const saved = await saveOfflineEventDraft({
      shopId,
      shopSlug,
      draftId,
      name: name.trim(),
      scheduledStartAt: scheduledStartIso,
      scheduledEndAt: scheduledEndIso,
      products: plannedProducts,
    });
    setDraftId(saved.id);
    setDraftLoadState("ready");
    window.dispatchEvent(
      new CustomEvent(OFFLINE_EVENT_UPDATED, { detail: { shopId } }),
    );
    if (showToast) toast.success(t("Event draft saved."));
    return saved;
  }

  async function saveDraft() {
    setBusy("save");
    try {
      await persistDraft();
    } catch (error) {
      toast.error(t(getErrorMessage(error, "Could not save event draft.")));
    } finally {
      setBusy(undefined);
    }
  }

  async function startEvent() {
    if (!online || !name.trim() || !plannedProducts.length || !scheduleIsValid)
      return;
    setBusy("start");
    try {
      const draft = await persistDraft(false);
      if (!draft) return;
      await assertOfflineEventStorageAvailable();
      await prepareStorefrontOffline({
        id: shopId,
        name: booth.booth_name || shopSlug,
        slug: shopSlug,
        active: true,
        accepting_orders: true,
      });
      const gachaLaunch = await refreshGachaLaunch(shopSlug, { booth });
      const enabledGames = (["genshin", "hsr"] as const).filter(
        (gameType) => gachaLaunch.catalogs[gameType]?.settings?.enabled,
      );
      if (enabledGames.length) {
        setGachaPreparationProgress(0);
        await downloadGachaOfflinePacks(
          enabledGames,
          Object.fromEntries(
            enabledGames.map((gameType) => [
              gameType,
              gachaCatalogOfflineUrls(gachaLaunch.catalogs[gameType]),
            ]),
          ),
          ({ percent }) => setGachaPreparationProgress(percent),
        );
      }
      const created = await activateOfflineEventSession(
        draft.id,
        getOfflineEventDeviceId(),
        shopSlug,
      );
      await saveOfflineEventSession(created);
      await requestDurableOfflineStorage();
      saveCatalogSnapshot(
        {
          products: created.allocations.map((allocation) => ({
            ...allocation.product,
            quantity_available:
              allocation.quantityAllocated - allocation.quantitySold,
          })),
          booth,
          payment,
          promotion,
        },
        shopId,
        { replaceProducts: true, complete: true },
      );
      setSession(created);
      setOrders([]);
      toast.success(t("This device is ready for offline sales."));
    } catch (error) {
      toast.error(
        t(getErrorMessage(error, "Could not start offline event mode.")),
        t("Event mode unavailable"),
      );
    } finally {
      setGachaPreparationProgress(null);
      setBusy(undefined);
    }
  }

  const syncOrders = useCallback(async () => {
    if (!session || session.status !== "active" || !online) return false;
    if (syncPromiseRef.current) return syncPromiseRef.current;
    const request = (async () => {
      setBusy("sync");
      try {
        const latestOrders = await listOfflineEventOrders(session.id);
        const pendingSync = latestOrders.filter((order) => !order.syncedAt);
        if (!pendingSync.length) return true;
        const acknowledgements = await syncOfflineEventOrders(
          session,
          pendingSync,
        );
        await markOfflineEventOrdersSynced(session, acknowledgements);
        await reloadLocal();
        toast.success(t("Offline orders synchronized."));
        return true;
      } catch (error) {
        toast.error(
          t(getErrorMessage(error, "Could not synchronize offline orders.")),
          t("Sync failed"),
        );
        return false;
      } finally {
        syncPromiseRef.current = null;
        setBusy(undefined);
      }
    })();
    syncPromiseRef.current = request;
    return request;
  }, [online, reloadLocal, session, t, toast]);

  useEffect(() => {
    if (
      !online ||
      busy ||
      !session ||
      session.status !== "active" ||
      !unsyncedCount
    )
      return;
    void syncOrders();
  }, [busy, online, session, syncOrders, unsyncedCount]);

  async function resolveOrder(
    order: OfflineEventOrder,
    status: "confirmed" | "cancelled",
  ) {
    if (!session) return;
    setBusy(order.id);
    try {
      const result = await updateOfflineEventOrder(session, order.id, {
        status,
        paymentState:
          status === "cancelled"
            ? "awaiting_payment"
            : order.paymentMethod === "cash"
              ? "cash_confirmed"
              : "bank_confirmed",
      });
      setSession(result.session);
      await reloadLocal();
      if (status === "cancelled") setOrderToCancel(null);
    } catch (error) {
      toast.error(t(getErrorMessage(error, "Could not update offline order.")));
    } finally {
      setBusy(undefined);
    }
  }

  async function resolveFulfillment(
    order: OfflineEventOrder,
    status: "ready" | "picked_up",
  ) {
    if (!session) return;
    setBusy(order.id);
    try {
      await updateOfflineEventOrderFulfillment(session, order.id, status);
      await reloadLocal();
      toast.success(
        t(
          status === "ready"
            ? "Order marked ready."
            : "Order marked picked up.",
        ),
      );
    } catch (error) {
      toast.error(t(getErrorMessage(error, "Could not update fulfilment.")));
    } finally {
      setBusy(undefined);
    }
  }

  async function closeEvent() {
    if (!session || !online || pendingCount > 0) return;
    setBusy("close");
    let frozen: OfflineEventSession | null =
      session.status === "closing" ? session : null;
    try {
      if (syncPromiseRef.current) await syncPromiseRef.current;
      setBusy("close");
      frozen ??= await freezeOfflineEventSession(session);
      setSession(frozen);
      const latestOrders = await listOfflineEventOrders(frozen.id);
      if (latestOrders.some((order) => order.status === "pending"))
        throw new Error(
          "Resolve pending offline payments before closing the event.",
        );
      const finalized = await finalizeOfflineEventSession(frozen, latestOrders);
      await markOfflineEventOrdersSynced(frozen, finalized.acknowledgements);
      await closeLocalOfflineEvent(frozen);
      await reloadLocal();
      setIsOpen(false);
      setConfirmClose(false);
      toast.success(t("Offline event closed and unused stock returned."));
    } catch (error) {
      if (frozen) setSession(frozen);
      toast.error(
        t(getErrorMessage(error, "Could not close the offline event.")),
        t("Close failed"),
      );
    } finally {
      setBusy(undefined);
    }
  }

  function exportBackup() {
    if (!session) return;
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 1, exportedAt: new Date().toISOString(), session, orders },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `matsuri-${session.shopSlug}-${session.id}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function openStorefront() {
    const url = new URL(
      `${import.meta.env.BASE_URL}s/${encodeURIComponent(shopSlug)}`,
      location.origin,
    );
    window.open(url.href, "_blank", "noopener,noreferrer");
  }

  const currentSession = session?.status === "closed" ? null : session;
  const eventActive = Boolean(currentSession);
  const sessionIsClosing = currentSession?.status === "closing";
  const operationLocked = busy === "start" || busy === "close";
  const eventDataLoading =
    localLoadState === "loading" ||
    (!currentSession &&
      (recoveryState === "idle" || recoveryState === "loading"));
  const eventDataError =
    localLoadState === "error" ||
    (!currentSession && recoveryState === "error");
  const productById = new Map(
    [
      ...products,
      ...(currentSession?.allocations.map((allocation) => allocation.product) ??
        []),
    ].map((product) => [product.id, product]),
  );
  const formatCount = (value: number) => value.toLocaleString(dateLocale);

  function retryEventDataLoad() {
    if (localLoadState === "error") {
      void reloadLocal(true);
      return;
    }
    setLocalLoadError("");
    setRecoveryState("idle");
    setRecoveryAttempt((current) => current + 1);
  }

  return (
    <>
      <button
        type="button"
        className={`admin-toolbar-control offline-event-launcher ${eventActive ? "is-active" : ""}`}
        aria-label={
          eventDataLoading
            ? `${t("Event mode")}: ${t("Loading")}`
            : eventDataError
              ? `${t("Event mode")}: ${t("Unavailable")}`
              : eventActive
                ? `${t("Event mode")}: ${currentSession?.name}`
                : `${t("Event mode")}: ${t("Set up")}`
        }
        aria-busy={eventDataLoading}
        onClick={() => setIsOpen(true)}
      >
        {eventDataLoading ? (
          <LoaderCircle className="state-spinner" size={15} />
        ) : eventActive ? (
          <ShieldCheck size={15} />
        ) : (
          <CloudOff size={15} />
        )}
        <span>{t("Event mode")}</span>
        {eventActive && <i aria-hidden="true" />}
      </button>

      <Modal
        title={t("Offline event mode")}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="offline-event-modal"
        closeLabel={t("Close modal")}
        appearance="admin"
        dismissible={!operationLocked}
        wide={eventActive}
        mobileSheet
      >
        {eventDataLoading ? (
          <EmptyState
            tone="loading"
            icon={<LoaderCircle className="state-spinner" size={28} />}
            title={t("Loading event mode…")}
            message={t("Checking this device and the latest saved event.")}
            meta={[]}
          />
        ) : eventDataError ? (
          <div className="offline-event-load-error">
            <Alert variant="error" title={t("Could not load event mode")}>
              {t(localLoadError || "Event data could not be loaded safely.")}
            </Alert>
            <Button
              variant="secondary"
              icon={<RefreshCw size={16} />}
              onClick={retryEventDataLoad}
            >
              {t("Try again")}
            </Button>
          </div>
        ) : !eventActive ? (
          <div className="offline-event-workspace offline-event-setup">
            <p className="offline-event-lead">
              {t(
                "Choose the stock for this event. It is removed from online availability only when this device starts the event.",
              )}
            </p>
            <Alert variant="info" className="offline-event-warning">
              {t(
                "Draft details are saved online. The storefront and enabled gacha games are downloaded before the selected stock is reserved.",
              )}
            </Alert>
            {draftLoadState === "idle" || draftLoadState === "loading" ? (
              <EmptyState
                tone="loading"
                icon={<LoaderCircle className="state-spinner" size={26} />}
                title={t("Loading saved event…")}
                message={t(
                  "Keep this window open while the draft is restored.",
                )}
                meta={[]}
              />
            ) : draftLoadState === "error" ? (
              <div className="offline-event-load-error">
                <Alert variant="error" title={t("Could not load event draft")}>
                  {draftLoadError}
                </Alert>
                <Button
                  variant="secondary"
                  icon={<RefreshCw size={16} />}
                  onClick={() => void loadLatestDraft()}
                >
                  {t("Try again")}
                </Button>
              </div>
            ) : (
              <div className="offline-event-setup-fields">
                <Field label={t("Event name")} className="offline-event-name">
                  <TextInput
                    value={name}
                    disabled={Boolean(busy)}
                    maxLength={80}
                    placeholder={t("Convention day or booth session")}
                    onChange={(event) => {
                      markFormEdited();
                      setName(event.target.value);
                    }}
                  />
                </Field>
                <div className="offline-event-schedule">
                  <Field label={t("Event starts")}>
                    <TextInput
                      type="datetime-local"
                      value={scheduledStart}
                      disabled={Boolean(busy)}
                      onChange={(event) => {
                        markFormEdited();
                        setScheduledStart(event.target.value);
                      }}
                    />
                  </Field>
                  <Field
                    label={t("Event ends")}
                    error={
                      scheduledStart && scheduledEnd && !scheduleIsValid
                        ? t("End time must be after start time.")
                        : undefined
                    }
                  >
                    <TextInput
                      type="datetime-local"
                      min={scheduledStart}
                      value={scheduledEnd}
                      disabled={Boolean(busy)}
                      onChange={(event) => {
                        markFormEdited();
                        setScheduledEnd(event.target.value);
                      }}
                    />
                  </Field>
                </div>
                <small className="offline-event-timezone-note">
                  <CalendarDays size={14} />{" "}
                  {t("Times use your current device timezone.")}
                </small>
                <div className="offline-event-stock-summary">
                  <strong>{t("Planned stock allocation")}</strong>
                  {!availableProducts.length ? (
                    <EmptyState
                      icon={<PackageX size={26} />}
                      title={t("No stock available for an event")}
                      message={t(
                        "Add stock to an active product before preparing Event Mode.",
                      )}
                      meta={[]}
                    />
                  ) : (
                    <div className="offline-event-allocation-list">
                      {availableProducts.map((product) => {
                        const quantity = allocationQuantities[product.id] ?? 0;
                        const selected = quantity > 0;
                        return (
                          <div
                            className={`offline-event-allocation-row ${selected ? "is-selected" : ""}`}
                            key={product.id}
                          >
                            <label className="offline-event-allocation-toggle">
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={Boolean(busy)}
                                aria-label={t("Allocate {{product}}", {
                                  product: product.name,
                                })}
                                onChange={(event) => {
                                  markFormEdited();
                                  setAllocationQuantities((current) => ({
                                    ...current,
                                    [product.id]: event.target.checked ? 1 : 0,
                                  }));
                                }}
                              />
                            </label>
                            <div className="offline-event-allocation-copy">
                              <strong>{product.name}</strong>
                              <small>
                                {t("{{count}} available", {
                                  count: product.quantity_available,
                                })}
                              </small>
                            </div>
                            <TextInput
                              type="number"
                              min={1}
                              max={product.quantity_available}
                              disabled={!selected || Boolean(busy)}
                              value={selected ? quantity : ""}
                              aria-label={t("{{product}} quantity", {
                                product: product.name,
                              })}
                              onChange={(event) => {
                                markFormEdited();
                                setAllocationQuantities((current) => ({
                                  ...current,
                                  [product.id]: Math.min(
                                    product.quantity_available,
                                    Math.max(
                                      0,
                                      Number(event.target.value) || 0,
                                    ),
                                  ),
                                }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="offline-event-preview">
                    <span>
                      <b>{plannedProducts.length}</b>
                      {t("products")}
                    </span>
                    <span>
                      <b>{plannedQuantity}</b>
                      {t("items")}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div className="offline-event-setup-actions">
              <Button
                variant="secondary"
                loading={busy === "save"}
                disabled={
                  !online ||
                  !name.trim() ||
                  !plannedProducts.length ||
                  !scheduleIsValid ||
                  Boolean(busy) ||
                  draftLoadState !== "ready"
                }
                icon={<Save size={17} />}
                onClick={() => void saveDraft()}
              >
                {draftId ? t("Update draft") : t("Save draft")}
              </Button>
              <Button
                loading={busy === "start"}
                loadingText={
                  gachaPreparationProgress === null
                    ? t("Preparing device…")
                    : t("Preparing games… {{progress}}%", {
                        progress: gachaPreparationProgress,
                      })
                }
                disabled={
                  !online ||
                  !name.trim() ||
                  !plannedProducts.length ||
                  !scheduleIsValid ||
                  Boolean(busy) ||
                  draftLoadState !== "ready"
                }
                icon={<ShieldCheck size={17} />}
                onClick={() => void startEvent()}
              >
                {online
                  ? t("Prepare device and reserve stock")
                  : t("Reconnect to prepare event mode")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="offline-event-workspace">
            <div className="offline-event-status-row">
              <div>
                <StatusPill
                  tone="success"
                  icon={
                    online ? <CheckCircle2 size={13} /> : <CloudOff size={13} />
                  }
                >
                  {online ? t("Online") : t("Offline ready")}
                </StatusPill>
                <h2>{currentSession?.name}</h2>
                <p>
                  {t(
                    "This device is the inventory authority for the allocated event stock.",
                  )}
                </p>
                {currentSession?.scheduledStartAt &&
                  currentSession.scheduledEndAt && (
                    <small className="offline-event-date-range">
                      <CalendarDays size={14} />
                      <span>
                        {new Date(
                          currentSession.scheduledStartAt,
                        ).toLocaleString(dateLocale)}
                        {" – "}
                        {new Date(currentSession.scheduledEndAt).toLocaleString(
                          dateLocale,
                        )}
                      </span>
                    </small>
                  )}
              </div>
              <div className="offline-event-header-actions">
                <Button
                  icon={<ExternalLink size={16} />}
                  onClick={openStorefront}
                >
                  {t("Open storefront")}
                </Button>
                <Button
                  variant="ghost"
                  icon={<Download size={16} />}
                  onClick={exportBackup}
                >
                  {t("Export backup")}
                </Button>
                <Button
                  variant="secondary"
                  loading={busy === "sync"}
                  disabled={!online || !sessionIsActive || Boolean(busy)}
                  icon={<RefreshCw size={16} />}
                  onClick={() => void syncOrders()}
                >
                  {t("Sync now")}
                  {unsyncedCount ? ` (${unsyncedCount})` : ""}
                </Button>
              </div>
            </div>
            <div className="offline-event-metrics">
              <span>
                <b>{formatCount(allocationTotal - soldTotal)}</b>
                {t("remaining")}
              </span>
              <span>
                <b>{formatCount(soldTotal)}</b>
                {t("sold locally")}
              </span>
              <span>
                <b>{orders.length}</b>
                {t("local orders")}
              </span>
              <span>
                <b>{pendingCount}</b>
                {t("awaiting verification")}
              </span>
            </div>
            <div className="offline-event-orders">
              <div className="offline-event-section-heading">
                <div>
                  <h3>{t("Local order ledger")}</h3>
                  <p>
                    {t("Orders remain on this device until they synchronize.")}
                  </p>
                </div>
              </div>
              {!orders.length ? (
                <div className="offline-event-empty">
                  {t(
                    "Open the storefront on this device to create the first offline order.",
                  )}
                </div>
              ) : (
                orders.map((order) => (
                  <article className="offline-event-order" key={order.id}>
                    <div className="offline-event-order-identity">
                      <span>{order.orderCode}</span>
                      <strong>
                        {order.customerName || t("Walk-in customer")}
                      </strong>
                      <small>
                        {new Date(order.createdAt).toLocaleString(dateLocale)}
                      </small>
                    </div>
                    <div className="offline-event-order-total">
                      <strong>{formatVnd(order.totalAmount)}</strong>
                      <small>
                        {t(order.paymentMethod === "cash" ? "Cash" : "VietQR")}
                      </small>
                    </div>
                    <ul
                      className="offline-event-order-items"
                      aria-label={t("Order items")}
                    >
                      {order.items.map((item) => (
                        <li key={item.product_id}>
                          <span>
                            {productById.get(item.product_id)?.name ||
                              t("Unknown product")}
                          </span>
                          <b>{item.quantity}×</b>
                        </li>
                      ))}
                    </ul>
                    <div className="offline-event-order-state">
                      {order.status === "confirmed" ? (
                        <StatusPill
                          tone="success"
                          icon={<CheckCircle2 size={13} />}
                        >
                          {t("Confirmed")}
                        </StatusPill>
                      ) : order.status === "cancelled" ? (
                        <StatusPill tone="danger" icon={<XCircle size={13} />}>
                          {t("Cancelled")}
                        </StatusPill>
                      ) : (
                        <div className="offline-event-order-pending">
                          <StatusPill tone="pending">
                            {t("Pending payment")}
                          </StatusPill>
                          <div className="offline-event-order-actions">
                            <Button
                              loading={busy === order.id}
                              disabled={!sessionIsActive || Boolean(busy)}
                              onClick={() =>
                                void resolveOrder(order, "confirmed")
                              }
                            >
                              {t(
                                order.paymentMethod === "cash"
                                  ? "Confirm cash"
                                  : "Verify payment",
                              )}
                            </Button>
                            <Button
                              variant="danger"
                              disabled={!sessionIsActive || Boolean(busy)}
                              onClick={() => setOrderToCancel(order)}
                            >
                              {t("Cancel")}
                            </Button>
                          </div>
                        </div>
                      )}
                      <StatusPill
                        tone={order.syncedAt ? "info" : "warning"}
                        icon={
                          order.syncedAt ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <CloudOff size={13} />
                          )
                        }
                      >
                        {order.syncedAt ? t("Synchronized") : t("Device only")}
                      </StatusPill>
                      {order.status === "confirmed" && (
                        <div className="offline-event-fulfillment-actions">
                          <StatusPill tone="neutral">
                            {t(order.fulfillmentStatus ?? "preparing")}
                          </StatusPill>
                          {(order.fulfillmentStatus ?? "preparing") ===
                            "preparing" && (
                            <Button
                              loading={busy === order.id}
                              disabled={!sessionIsActive || Boolean(busy)}
                              onClick={() =>
                                void resolveFulfillment(order, "ready")
                              }
                            >
                              {t("Mark ready")}
                            </Button>
                          )}
                          {(order.fulfillmentStatus ?? "preparing") ===
                            "ready" && (
                            <Button
                              loading={busy === order.id}
                              disabled={!sessionIsActive || Boolean(busy)}
                              onClick={() =>
                                void resolveFulfillment(order, "picked_up")
                              }
                            >
                              {t("Mark picked up")}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
            <Alert
              variant="info"
              className={online ? "" : "offline-event-warning"}
            >
              {sessionIsClosing
                ? t(
                    "This event is frozen. Retry closing to finish synchronization and return unused stock.",
                  )
                : online
                  ? t(
                      "Synchronization is idempotent; retrying cannot duplicate an offline order.",
                    )
                  : t(
                      "Sales are safe on this device. Reconnect before closing the event or switching devices.",
                    )}
            </Alert>
            <Button
              variant="danger"
              className="offline-event-primary-action"
              loading={busy === "close"}
              disabled={!online || pendingCount > 0 || Boolean(busy)}
              onClick={() => setConfirmClose(true)}
            >
              {pendingCount > 0
                ? t("Resolve pending payments first")
                : sessionIsClosing
                  ? t("Retry sync and close event")
                  : t("Sync and close event")}
            </Button>
          </div>
        )}
      </Modal>
      <ConfirmationDialog
        isOpen={Boolean(orderToCancel)}
        title={t("Cancel local order")}
        message={t(
          "Cancel {{code}}? Its reserved event stock will be returned on this device.",
          { code: orderToCancel?.orderCode ?? "" },
        )}
        cancelLabel={t("Keep order")}
        confirmLabel={t("Cancel order")}
        loadingLabel={t("Cancelling…")}
        busy={Boolean(orderToCancel && busy === orderToCancel.id)}
        onClose={() => setOrderToCancel(null)}
        onConfirm={() => {
          if (orderToCancel) void resolveOrder(orderToCancel, "cancelled");
        }}
      />
      <ConfirmationDialog
        isOpen={confirmClose}
        title={t("Close offline event?")}
        message={t(
          "All local orders will be synchronized and only unsold allocation will return to online stock. This cannot be undone.",
        )}
        cancelLabel={t("Keep event open")}
        confirmLabel={
          sessionIsClosing
            ? t("Retry sync and close event")
            : t("Sync and close event")
        }
        loadingLabel={t("Closing event…")}
        busy={busy === "close"}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => void closeEvent()}
      />
    </>
  );
}
