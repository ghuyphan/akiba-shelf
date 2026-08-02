import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCatalogFilters } from "./useCatalogFilters";

afterEach(() => vi.useRealTimers());

describe("useCatalogFilters", () => {
  it("debounces trimmed searches and resets the browsing scope", () => {
    vi.useFakeTimers();
    const { result } = renderHook(useCatalogFilters);

    act(() => {
      result.current.setActiveCategory("Prints");
      result.current.setSearchQuery("  moon  ");
      result.current.setSort("price-asc");
      result.current.setViewMode("list");
    });
    expect(result.current.query).toEqual({
      category: "Prints",
      search: "",
      sort: "price-asc",
    });

    act(() => vi.advanceTimersByTime(250));
    expect(result.current.query.search).toBe("moon");

    act(() => result.current.reset());
    expect(result.current.activeCategory).toBe("All");
    expect(result.current.searchQuery).toBe("");
    expect(result.current.viewMode).toBe("list");
  });
});
