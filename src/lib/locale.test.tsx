import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "./i18n";
import { PLATFORM_LOCALE_KEY, resolvePlatformLocale } from "./locale";

describe("platform locale", () => {
  it.each([["en", "vi-VN", "en"], ["vi", "en-US", "vi"]] as const)("uses a valid stored %s locale", (saved, language, expected) => {
    expect(resolvePlatformLocale({ getItem: () => saved }, language)).toBe(expected);
  });
  it.each([[null, "vi-VN", "vi"], [null, "fr-FR", "en"], ["broken", "en-US", "en"]] as const)("resolves safe browser fallbacks", (saved, language, expected) => {
    expect(resolvePlatformLocale({ getItem: () => saved }, language)).toBe(expected);
  });
  it("updates copy, document language and persistence without navigation", () => {
    function Probe() { const { locale, setLocale, copy } = useI18n(); return <button onClick={() => setLocale(locale === "en" ? "vi" : "en")}>{copy.common.signIn}</button>; }
    render(<MemoryRouter initialEntries={["/dashboard"]}><I18nProvider initialLocale="en"><Probe /></I18nProvider></MemoryRouter>);
    expect(screen.getByRole("button")).toHaveTextContent("Sign in");
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button")).toHaveTextContent("Đăng nhập");
    expect(localStorage.getItem(PLATFORM_LOCALE_KEY)).toBe("vi");
    expect(document.documentElement.lang).toBe("vi");
  });
});

