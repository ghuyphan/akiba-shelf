import {
  BellRing,
  CircleAlert,
  Clock3,
  PackageSearch,
  RotateCcw,
  Settings2,
} from "lucide-react";
import type { ReactNode } from "react";
import { usePlatformI18n, type PlatformLocale } from "../../../lib/i18n/platformI18n";
import type {
  BoothSettings,
  PaymentSettings,
  Product,
  OrderNotificationStatus,
} from "../../../types/catalog";
import { hasUsablePayment } from "../../../utils/vietqr";
import { formatRelativeTime } from "../../../utils/format";
import { Button } from "../../ui/Button";
import { useAsyncAction } from "../../../hooks/shared/useAsyncAction";
import { AdminCard } from "./AdminCard";
import type { GuideSection } from "./AdminGuideModal";

type ReadinessItem = {
  key: string;
  complete: boolean;
  label: string;
};

export function getShopReadiness(
  booth: BoothSettings,
  payment: PaymentSettings,
  products: Product[],
): ReadinessItem[] {
  return [
    {
      key: "catalog",
      complete: products.some((product) => product.active),
      label: "Publish at least one active product",
    },
    {
      key: "payment",
      complete: hasUsablePayment(payment),
      label: "Add customer-ready payment details",
    },
    {
      key: "identity",
      complete: Boolean(booth.booth_name.trim() && booth.subtitle.trim()),
      label: "Complete the storefront name and description",
    },
    {
      key: "visit",
      complete: Boolean(booth.location.trim() && booth.open_hours.trim()),
      label: "Add booth location and opening hours",
    },
  ];
}

type AdminAttentionPanelProps = {
  booth: BoothSettings;
  payment: PaymentSettings;
  products: Product[];
  expiringOrderCount: number;
  lowStockCount: number;
  notificationStatuses: OrderNotificationStatus[];
  canManageCatalog: boolean;
  canRetryNotifications: boolean;
  onOpenOrders: () => void;
  onOpenProducts: () => void;
  onOpenSettings: () => void;
  onRetryNotification: (orderId: string) => Promise<boolean>;
  onOpenGuide?: (section?: GuideSection) => void;
};

type NotificationAttention = {
  retryingCount: number;
  deadLetterCount: number;
  overdueCount: number;
  oldestDueAt: string | null;
};

export function getNotificationAttention(
  statuses: OrderNotificationStatus[],
  now = Date.now(),
): NotificationAttention {
  const aggregate = statuses[0];
  const dueStatuses = statuses.filter(
    (status) =>
      ["pending", "queued", "sending", "retryable_failed"].includes(
        status.status,
      ) &&
      status.next_attempt_at !== null &&
      new Date(status.next_attempt_at).getTime() <= now,
  );
  const oldestDueAt =
    aggregate?.oldest_due_at ??
    dueStatuses
      .map((status) => status.next_attempt_at)
      .filter((value): value is string => value !== null)
      .sort()[0] ??
    null;

  return {
    retryingCount:
      aggregate?.retryable_failed_count ??
      statuses.filter((status) => status.status === "retryable_failed").length,
    deadLetterCount:
      aggregate?.dead_letter_count ??
      statuses.filter((status) => status.status === "dead_letter").length,
    overdueCount: aggregate?.due_count ?? dueStatuses.length,
    oldestDueAt,
  };
}

function getNotificationAttentionCopy(
  notifications: NotificationAttention,
  issueCount: number,
  locale: PlatformLocale,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (notifications.deadLetterCount > 0) {
    return {
      title:
        issueCount === 1
          ? t("1 order alert needs manual review")
          : t("{{count}} order alerts need manual review", { count: issueCount }),
      hint:
        notifications.deadLetterCount === 1
          ? t("1 alert stopped after all retries. Check staff notification devices.")
          : t("{{count}} stopped after all retries. Check staff notification devices.", {
              count: notifications.deadLetterCount,
            }),
    };
  }

  if (notifications.retryingCount > 0) {
    return {
      title:
        notifications.retryingCount === 1
          ? t("1 order alert is retrying")
          : t("{{count}} order alerts are retrying", { count: notifications.retryingCount }),
      hint: notifications.oldestDueAt
        ? t("The oldest alert became due {{time}}.", {
            time: formatRelativeTime(notifications.oldestDueAt, Date.now(), locale).toLocaleLowerCase(locale),
          })
        : t("Automatic retries are running; orders remain safe in the queue."),
    };
  }

  return {
    title:
      notifications.overdueCount === 1
        ? t("1 order alert is delayed")
        : t("{{count}} order alerts are delayed", { count: notifications.overdueCount }),
    hint: notifications.oldestDueAt
      ? t("The oldest alert became due {{time}}.", {
          time: formatRelativeTime(notifications.oldestDueAt, Date.now(), locale).toLocaleLowerCase(locale),
        })
      : t("Automatic retries are running; orders remain safe in the queue."),
  };
}

function AttentionItem({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon}
      <span>
        <strong>{title}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div>{content}</div>
  );
}

export function AdminAttentionPanel({
  booth,
  payment,
  products,
  expiringOrderCount,
  lowStockCount,
  notificationStatuses,
  canManageCatalog,
  canRetryNotifications,
  onOpenOrders,
  onOpenProducts,
  onOpenSettings,
  onRetryNotification,
  onOpenGuide,
}: AdminAttentionPanelProps) {
  const { locale, t } = usePlatformI18n();
  const { busy: retryBusy, run: runRetry } = useAsyncAction();
  const readiness = canManageCatalog
    ? getShopReadiness(booth, payment, products)
    : [];
  const incomplete = readiness.filter((item) => !item.complete);
  const notifications = getNotificationAttention(notificationStatuses);
  const notificationIssueCount =
    notifications.retryingCount + notifications.deadLetterCount;
  const notificationCopy = getNotificationAttentionCopy(
    notifications,
    notificationIssueCount,
    locale,
    t,
  );
  const retryCandidate = canRetryNotifications
    ? notificationStatuses.find(
        (status) =>
          status.status === "dead_letter" ||
          (status.status === "skipped" &&
            status.last_error === "no_valid_subscriptions"),
      )
    : undefined;

  if (
    expiringOrderCount === 0 &&
    lowStockCount === 0 &&
    notificationIssueCount === 0 &&
    notifications.overdueCount === 0 &&
    !retryCandidate &&
    incomplete.length === 0
  )
    return null;

  return (
    <AdminCard
      title={t("Attention needed")}
      description={t(
        "Resolve the time-sensitive items first, then finish shop setup.",
      )}
      icon={<CircleAlert size={18} />}
      className="admin-attention-panel"
      density="compact"
    >
      <div className="admin-attention-grid">
        {expiringOrderCount > 0 && (
          <AttentionItem
            icon={<Clock3 size={18} />}
            title={
              expiringOrderCount === 1
                ? t("1 visible reservation expires soon")
                : t("{{count}} visible reservations expire soon", {
                    count: expiringOrderCount,
                  })
            }
            hint={t("Confirm payment before stock is released.")}
            onClick={onOpenOrders}
          />
        )}
        {lowStockCount > 0 && (
          <AttentionItem
            icon={<PackageSearch size={18} />}
            title={
              lowStockCount === 1
                ? t("1 product is low or sold out")
                : t("{{count}} products are low or sold out", {
                    count: lowStockCount,
                  })
            }
            hint={t("Review stock before the next rush.")}
            onClick={canManageCatalog ? onOpenProducts : undefined}
          />
        )}
        {(notificationIssueCount > 0 || notifications.overdueCount > 0) && (
          <AttentionItem
            icon={<BellRing size={18} />}
            title={notificationCopy.title}
            hint={notificationCopy.hint}
            onClick={onOpenOrders}
          />
        )}
        {incomplete.length > 0 && (
          <AttentionItem
            icon={<Settings2 size={18} />}
            title={t("Shop setup · {{done}}/{{total}} ready", {
              done: readiness.length - incomplete.length,
              total: readiness.length,
            })}
            hint={t(incomplete[0].label)}
            onClick={
              onOpenGuide
                ? () => onOpenGuide("checklist")
                : incomplete[0].key === "catalog"
                  ? onOpenProducts
                  : onOpenSettings
            }
          />
        )}
      </div>

      {retryCandidate && (
        <div className="admin-notification-retry">
          <span>
            <strong>{t("Retry notification delivery")}</strong>
            <small>{t("Check staff alerts, then retry delivery.")}</small>
          </span>
          <Button
            type="button"
            variant="secondary"
            icon={<RotateCcw size={15} />}
            loading={retryBusy}
            loadingText={t("Queuing retry…")}
            onClick={() => {
              void runRetry(() =>
                onRetryNotification(retryCandidate.order_id),
              ).catch(() => undefined);
            }}
          >
            {t("Retry alert")}
          </Button>
        </div>
      )}
    </AdminCard>
  );
}
