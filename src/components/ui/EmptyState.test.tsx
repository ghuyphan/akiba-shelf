import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CircleCheck } from "lucide-react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  afterEach(cleanup);

  it("provides a consistent accessible spinner for loading states", () => {
    render(<EmptyState tone="loading" title="Loading" message="Please wait" />);

    const state = screen.getByRole("status");
    expect(state).toHaveAttribute("aria-busy", "true");
    expect(state.querySelector(".state-spinner")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("keeps caller-provided icons and does not add a second loading icon", () => {
    render(
      <EmptyState
        tone="loading"
        icon={<CircleCheck data-testid="custom-icon" />}
        title="Almost ready"
        message="Finishing up"
      />,
    );

    const state = screen.getByRole("status");
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    expect(state.querySelector(".state-spinner")).not.toBeInTheDocument();
  });
});
