import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicProductSort } from "../../lib/catalogQueries";

export function useCatalogFilters() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<PublicProductSort>("recommended");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const query = useMemo(
    () => ({ category: activeCategory, search: debouncedSearch, sort }),
    [activeCategory, debouncedSearch, sort],
  );
  const reset = useCallback(() => {
    setActiveCategory("All");
    setSearchQuery("");
  }, []);

  return {
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    viewMode,
    setViewMode,
    query,
    reset,
  };
}
