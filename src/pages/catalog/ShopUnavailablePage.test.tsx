import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { CatalogLocaleProvider } from "../../lib/i18n/catalogLocale";
import { ShopUnavailablePage } from "./ShopUnavailablePage";

describe("ShopUnavailablePage", () => {
  it("renders a localized retry state for load failures", async () => {
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
      screen.getByRole("heading", { name: "Không thể tải gian hàng" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Hiện chúng tôi chưa thể kết nối",
    );
    expect(
      screen.getByRole("link", { name: "Staff đăng nhập" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Về Matsuri" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/404/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("keeps true missing storefronts distinct from load failures", () => {
    render(
      <MemoryRouter>
        <CatalogLocaleProvider locale="en">
          <ShopUnavailablePage
            hasLoadError={false}
            showDemoLink
            onRetry={vi.fn()}
          />
        </CatalogLocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "This booth isn’t on the shelf.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Visit the demo booth." }),
    ).toHaveAttribute("href", "/s/demo-booth");
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
