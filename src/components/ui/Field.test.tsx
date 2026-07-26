import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, TextArea, TextInput } from "./Field";

describe("Field", () => {
  it("associates hints and errors with its input", () => {
    const { rerender } = render(
      <Field label="Name" hint="Public label">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAccessibleDescription("Public label");

    rerender(
      <Field label="Name" error="Name is required">
        <TextInput />
      </Field>,
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Name is required");
  });

  it("preserves shared control classes when callers add a class", () => {
    render(
      <>
        <TextInput aria-label="Title" className="custom-input" />
        <TextArea aria-label="Description" className="custom-area" />
      </>,
    );

    expect(screen.getByLabelText("Title")).toHaveClass("input", "custom-input");
    expect(screen.getByLabelText("Description")).toHaveClass(
      "input",
      "textarea",
      "custom-area",
    );
  });
});
