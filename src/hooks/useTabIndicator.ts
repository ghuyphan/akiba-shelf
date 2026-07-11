import { useEffect, useRef } from "react";

export function useTabIndicator<TValue, TElement extends HTMLElement = HTMLElement>(
  activeValue: TValue,
  dependencies: any[] = []
) {
  const containerRef = useRef<TElement | null>(null);
  const itemRefs = useRef<Map<TValue, HTMLElement | null>>(new Map());

  const registerItem = (value: TValue) => (el: HTMLElement | null) => {
    if (el) {
      itemRefs.current.set(value, el);
    } else {
      itemRefs.current.delete(value);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    const activeElement = itemRefs.current.get(activeValue);
    if (!container || !activeElement) return;

    function updateIndicator() {
      const c = container;
      const a = activeElement;
      if (!c || !a) return;
      requestAnimationFrame(() => {
        const containerRect = c.getBoundingClientRect();
        const activeRect = a.getBoundingClientRect();
        if (containerRect.width === 0 || activeRect.width === 0) return;
        c.style.setProperty("--active-left", `${activeRect.left - containerRect.left + c.scrollLeft}px`);
        c.style.setProperty("--active-width", `${activeRect.width}px`);
      });
    }

    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(container);
    observer.observe(activeElement);
    window.addEventListener("resize", updateIndicator);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeValue, ...dependencies]);

  return { containerRef, registerItem };
}
