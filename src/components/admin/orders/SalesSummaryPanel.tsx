import type { SalesSummaryState } from "../../../lib/sales";
import { formatVnd } from "../../../utils/format";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";

type Props = {
  state?: SalesSummaryState;
};

export function SalesSummaryPanel({ state }: Props) {
  const { t } = usePlatformI18n();
  if (!state?.summary) return null;
  const { summary, status } = state;
  return (
    <section className="admin-sales-summary" aria-label={t("Sales summary")}>
      <div className="admin-sales-total">
        <span>{t("Confirmed revenue")}</span>
        <strong>{formatVnd(summary.revenue)}</strong>
        {status === "fallback" ? (
          <small>{t("Showing cached order totals; sync to refresh")}</small>
        ) : (
          status === "provisional" && (
            <small>{t("Includes unsynced Event sales")}</small>
          )
        )}
      </div>
      <div className="admin-sales-breakdown">
        <span>
          <strong>{summary.confirmed_order_count}</strong>
          {t("Confirmed orders")}
          <i aria-hidden="true">·</i>
          <strong>{summary.units_sold}</strong>
          {t("units")}
        </span>
        <span>
          {t("Online revenue")}
          <strong>{formatVnd(summary.online_revenue)}</strong>
        </span>
        <span>
          {t("Event revenue")}
          <strong>{formatVnd(summary.event_revenue)}</strong>
        </span>
      </div>
    </section>
  );
}
