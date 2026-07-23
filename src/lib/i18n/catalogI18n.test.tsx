import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogLocaleProvider } from "./catalogI18n";

describe("CatalogLocaleProvider", () => {
  it("owns the language of its target document without changing the parent", () => {
    const targetDocument = document.implementation.createHTMLDocument();
    targetDocument.documentElement.lang = "fr";
    const parentLanguage = document.documentElement.lang;

    const { rerender, unmount } = render(
      <CatalogLocaleProvider locale="vi" targetDocument={targetDocument}>
        Preview
      </CatalogLocaleProvider>,
    );

    expect(targetDocument.documentElement.lang).toBe("vi");
    expect(document.documentElement.lang).toBe(parentLanguage);

    rerender(
      <CatalogLocaleProvider locale="en" targetDocument={targetDocument}>
        Preview
      </CatalogLocaleProvider>,
    );
    expect(targetDocument.documentElement.lang).toBe("en");
    expect(document.documentElement.lang).toBe(parentLanguage);

    unmount();
    expect(targetDocument.documentElement.lang).toBe("fr");
  });
});
