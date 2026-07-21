import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CatalogLocaleProvider } from "../lib/i18n/catalogI18n";
import { ShopUnavailablePage } from "./ShopUnavailablePage";

describe("ShopUnavailablePage", () => {
  it("renders the unavailable experience in the storefront locale", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(
      <MemoryRouter>
        <CatalogLocaleProvider locale="vi">
          <ShopUnavailablePage
            hasLoadError
            showDemoLink
            onRetry={retry}
          />
        </CatalogLocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /Gian hàng này không có trên kệ/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Hiện chúng tôi chưa thể kết nối",
    );
    expect(
      screen.getByRole("link", { name: "Staff đăng nhập" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ghé gian hàng demo." }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
