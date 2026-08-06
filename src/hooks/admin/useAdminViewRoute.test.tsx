import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { useAdminViewRoute } from "./useAdminViewRoute";

function wrapper(initialEntry: string) {
  return function Router({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    );
  };
}

function useRouteState() {
  const route = useAdminViewRoute();
  return { ...route, search: useLocation().search };
}

describe("useAdminViewRoute", () => {
  it("normalizes an unknown tab while preserving unrelated query state", async () => {
    const { result } = renderHook(useRouteState, {
      wrapper: wrapper("/admin?view=unknown&source=alert"),
    });

    await waitFor(() => expect(result.current.search).toBe("?source=alert"));
    expect(result.current.viewTab).toBe("orders");
  });

  it("writes and removes the selected tab without dropping other parameters", () => {
    const { result } = renderHook(useRouteState, {
      wrapper: wrapper("/admin?source=header"),
    });

    act(() => result.current.setViewTab("products"));
    expect(result.current.search).toBe("?source=header&view=products");
    expect(result.current.viewTab).toBe("products");

    act(() => result.current.setViewTab("orders"));
    expect(result.current.search).toBe("?source=header");
    expect(result.current.viewTab).toBe("orders");
  });
});
