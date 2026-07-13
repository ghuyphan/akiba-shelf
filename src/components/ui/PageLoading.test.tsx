import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PageLoading } from "./PageLoading";

describe("PageLoading", () => {
  afterEach(cleanup);

  it("keeps the shared Matsuri brand and progress treatment with contextual copy", () => {
    render(
      <PageLoading
        title="Opening the shop…"
        message="Getting the shelves ready for you."
      />,
    );

    const loading = screen.getByLabelText("Loading Matsuri");
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(loading.querySelector(".page-loading-brand img")).toHaveAttribute(
      "src",
      expect.stringContaining("brand/matsuri-mark.svg"),
    );
    expect(loading.querySelector(".page-loading-track i")).toBeInTheDocument();
    expect(screen.getByText("Opening the shop…")).toBeInTheDocument();
  });
});
