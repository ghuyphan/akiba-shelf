import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminCard } from "./AdminCard";

describe("AdminCard", () => {
  it("uses the standard panel contract by default", () => {
    render(<AdminCard title="Catalog">Products</AdminCard>);

    const card = screen.getByRole("region", { name: "Catalog" });
    expect(card).toHaveClass(
      "admin-card",
      "admin-card-panel",
      "admin-card-default",
    );
  });

  it("exposes explicit surface and density variants", () => {
    render(
      <AdminCard title="Promotion" variant="inset" density="compact">
        Promotion fields
      </AdminCard>,
    );

    expect(screen.getByRole("region", { name: "Promotion" })).toHaveClass(
      "admin-card-inset",
      "admin-card-compact",
    );
  });
});
