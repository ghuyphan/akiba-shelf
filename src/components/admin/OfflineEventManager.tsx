import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CloudOff,
  Download,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  finalizeOfflineEventSession,
  recoverOfflineEventSession,
  startOfflineEventSession,
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

type OfflineEventManagerProps = {
  shopId: string;
  shopSlug: string;
  products: Product[];
  booth: BoothSettings;
  payment: PaymentSettings;
  promotion: PromotionSettings;
};

export function OfflineEventManager({
  shopId,
  shopSlug,
  products,
  booth,
  payment,
  promotion,
}: OfflineEventManagerProps) {
  const { t } = usePlatformI18n();
  const toast = useToast();
  const [session, setSession] = useState<OfflineEventSession | null>(null);
  const [orders, setOrders] = useState<OfflineEventOrder[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"start" | "sync" | "close" | string>();
  const [online, setOnline] = useState(navigator.onLine);
  const [isOpen, setIsOpen] = useState(false);
  const [gachaPreparationProgress, setGachaPreparationProgress] = useState<
    number | null
  >(null);
  const [loadedShopId, setLoadedShopId] = useState("");
  const syncPromiseRef = useRef<Promise<boolean> | null>(null);

  const reloadLocal = useCallback(async () => {
    const stored = await loadOfflineEventSession(shopId);
    setSession(stored);
    setOrders(stored ? await listOfflineEventOrders(stored.id) : []);
  }, [shopId]);

  useEffect(() => {
    let active = true;
    setLoadedShopId("");
    void reloadLocal().finally(() => {
      if (active) setLoadedShopId(shopId);
    });
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ shopId?: string }>).detail;
      if (!detail?.shopId || detail.shopId === shopId) void reloadLocal();
    };
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleFocus = () => void reloadLocal();
    window.addEventListener(OFFLINE_EVENT_UPDATED, update);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_EVENT_UPDATED, update);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
    };
  }, [reloadLocal, shopId]);

  useEffect(() => {
    if (!online || loadedShopId !== shopId || session) return;
    const deviceId = getOfflineEventDeviceId();
    recoverOfflineEventSession(shopId, shopSlug, deviceId)
      .then(async (recovered) => {
        if (!recovered) return;
        await mergeRecoveredOfflineEventSession(recovered);
        await reloadLocal();
      })
      .catch(() => undefined);
  }, [loadedShopId, online, reloadLocal, session, shopId, shopSlug]);

  const availableProducts = useMemo(
    () =>
      products.filter(
        (product) => product.active && product.quantity_available > 0,
      ),
    [products],
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

  async function startEvent() {
    if (!online || !name.trim() || !availableProducts.length) return;
    setBusy("start");
    try {
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
      const created = await startOfflineEventSession({
        shopId,
        shopSlug,
        deviceId: getOfflineEventDeviceId(),
        name: name.trim(),
        products: availableProducts.map((product) => ({
          id: product.id,
          quantity: product.quantity_available,
        })),
        payment,
        promotion,
      });
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
  }, [online, session, t, toast]);

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

  const currentSession = session?.status === "closed" ? null : session;
  const eventActive = Boolean(currentSession);
  const sessionIsClosing = currentSession?.status === "closing";

  return (
    <>
      <button
        type="button"
        className={`admin-toolbar-control offline-event-launcher ${eventActive ? "is-active" : ""}`}
        aria-label={
          eventActive
            ? `${t("Event mode")}: ${currentSession?.name}`
            : `${t("Event mode")}: ${t("Set up")}`
        }
        onClick={() => setIsOpen(true)}
      >
        {eventActive ? <ShieldCheck size={15} /> : <CloudOff size={15} />}
        <span>{t("Event mode")}</span>
        {eventActive && <i aria-hidden="true" />}
      </button>

      <Modal
        title={t("Offline event mode")}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className={`offline-event-modal ${eventActive ? "is-active-session" : "is-setup"}`}
        closeLabel={t("Close modal")}
        mobileSheet
      >
        {!eventActive ? (
          <div className="offline-event-workspace offline-event-setup">
            <div className="offline-event-intro">
              <span className="offline-event-icon">
                <CloudOff size={24} />
              </span>
              <div>
                <h2>{t("Prepare this device for an offline event")}</h2>
                <p>
                  {t(
                    "Current active stock will be assigned to this device, removed from online availability, and safely returned when the event closes.",
                  )}
                </p>
              </div>
            </div>
            <Alert variant="info" className="offline-event-warning">
              {t(
                "Use one designated staff device while offline. The storefront and enabled gacha games are saved before stock is reserved.",
              )}
            </Alert>
            <div className="offline-event-setup-card">
              <Field label={t("Event name")} className="offline-event-name">
                <TextInput
                  value={name}
                  maxLength={80}
                  placeholder={t("Convention day or booth session")}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <div className="offline-event-stock-summary">
                <strong>{t("Stock to reserve")}</strong>
                <div className="offline-event-preview">
                  <span>
                    <b>{availableProducts.length}</b>
                    {t("products")}
                  </span>
                  <span>
                    <b>
                      {availableProducts.reduce(
                        (sum, product) => sum + product.quantity_available,
                        0,
                      )}
                    </b>
                    {t("items")}
                  </span>
                </div>
              </div>
            </div>
            <Button
              className="offline-event-primary-action"
              loading={busy === "start"}
              loadingText={
                gachaPreparationProgress === null
                  ? t("Preparing device…")
                  : t("Preparing games… {{progress}}%", {
                      progress: gachaPreparationProgress,
                    })
              }
              disabled={!online || !name.trim() || !availableProducts.length}
              icon={<ShieldCheck size={17} />}
              onClick={() => void startEvent()}
            >
              {online
                ? t("Reserve stock and prepare device")
                : t("Reconnect to prepare event mode")}
            </Button>
          </div>
        ) : (
          <div className="offline-event-workspace">
            <div className="offline-event-status-row">
              <div>
                <span
                  className={`status-pill ${online ? "status-confirmed" : "status-pending"}`}
                >
                  {online ? t("Online") : t("Offline ready")}
                </span>
                <h2>{currentSession?.name}</h2>
                <p>
                  {t(
                    "This device is the inventory authority for the allocated event stock.",
                  )}
                </p>
              </div>
              <div className="offline-event-header-actions">
                <Button
                  variant="secondary"
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
                <b>{allocationTotal - soldTotal}</b>
                {t("remaining")}
              </span>
              <span>
                <b>{soldTotal}</b>
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
                    <div>
                      <span>{order.orderCode}</span>
                      <strong>
                        {order.customerName || t("Walk-in customer")}
                      </strong>
                      <small>
                        {new Date(order.createdAt).toLocaleString()}
                      </small>
                    </div>
                    <div className="offline-event-order-total">
                      <strong>{formatVnd(order.totalAmount)}</strong>
                      <small>
                        {t(order.paymentMethod === "cash" ? "Cash" : "VietQR")}
                      </small>
                    </div>
                    <div className="offline-event-order-state">
                      {order.status === "confirmed" ? (
                        <span className="status-pill status-confirmed">
                          <CheckCircle2 size={13} /> {t("Confirmed")}
                        </span>
                      ) : order.status === "cancelled" ? (
                        <span className="status-pill status-cancelled">
                          <XCircle size={13} /> {t("Cancelled")}
                        </span>
                      ) : (
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
                            variant="secondary"
                            disabled={!sessionIsActive || Boolean(busy)}
                            onClick={() =>
                              void resolveOrder(order, "cancelled")
                            }
                          >
                            {t("Cancel")}
                          </Button>
                        </div>
                      )}
                      {order.status === "confirmed" && (
                        <div className="offline-event-fulfillment-actions">
                          <span>
                            {t(order.fulfillmentStatus ?? "preparing")}
                          </span>
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
              onClick={() => void closeEvent()}
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
    </>
  );
}
