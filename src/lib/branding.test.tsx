import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { getAdminBranding, getPlatformBranding, getShopBranding, PLATFORM_BRAND, PLATFORM_FAVICON, resetDocumentBranding, safePublicUrl, useDocumentBranding } from "./branding";

afterEach(() => { cleanup(); resetDocumentBranding(); });

describe("branding", () => {
  it("returns Matsuri platform defaults", () => {
    expect(getPlatformBranding()).toEqual({ title: "Matsuri", faviconUrl: PLATFORM_FAVICON, themeColor: "#d95c64" });
  });

  it("accepts safe URLs and rejects unsafe values", () => {
    expect(safePublicUrl("https://images.example/shop.png")).toBe("https://images.example/shop.png");
    expect(safePublicUrl("/shop.png")).toBe(`${window.location.origin}/shop.png`);
    for (const value of ["javascript:alert(1)", "vbscript:msgbox(1)", "data:image/svg+xml,x", "//evil.example/x", "not a url"]) expect(safePublicUrl(value)).toBeUndefined();
  });

  it("builds shop and admin titles with safe fallbacks", () => {
    expect(getShopBranding("Record Shop", "Booth Name").title).toBe("Booth Name · Matsuri");
    expect(getAdminBranding("Record Shop").title).toBe("Record Shop Admin · Matsuri");
    expect(getShopBranding().title).toBe("Shop · Matsuri");
    expect(getShopBranding("Shop", "", "javascript:x").faviconUrl).toBe(PLATFORM_FAVICON);
  });

  it("resets favicon and never duplicates icon elements", () => {
    document.head.querySelectorAll('link[rel="icon"]').forEach((node) => node.remove());
    resetDocumentBranding(); resetDocumentBranding();
    expect(document.title).toBe(PLATFORM_BRAND.name);
    expect(document.head.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href).toBe(new URL(PLATFORM_FAVICON, window.location.origin).href);
  });

  it("cleans branding on unmount and identity changes", () => {
    function Subject({ name }: { name: string }) { useDocumentBranding(getShopBranding(name)); return null; }
    const view = render(<Subject name="A" />);
    expect(document.title).toBe("A · Matsuri");
    view.rerender(<Subject name="B" />);
    expect(document.title).toBe("B · Matsuri");
    view.unmount();
    expect(document.title).toBe("Matsuri");
  });
});
