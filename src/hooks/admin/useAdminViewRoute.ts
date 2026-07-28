import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";
import type { AdminViewTab } from "../../components/admin/shell/adminWorkspaceTypes";

const adminViewTabs = new Set<AdminViewTab>([
  "orders",
  "products",
  "gacha",
  "design",
  "settings",
  "team",
]);

function parseAdminViewTab(value: string | null): AdminViewTab {
  return value && adminViewTabs.has(value as AdminViewTab)
    ? (value as AdminViewTab)
    : "orders";
}

export function useAdminViewRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get("view");
  const viewTab = parseAdminViewTab(requestedView);
  const setViewTab = useCallback(
    (nextView: AdminViewTab, replace = false) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (nextView === "orders") next.delete("view");
          else next.set("view", nextView);
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (requestedView && !adminViewTabs.has(requestedView as AdminViewTab)) {
      setViewTab("orders", true);
    }
  }, [requestedView, setViewTab]);

  return { viewTab, setViewTab };
}
