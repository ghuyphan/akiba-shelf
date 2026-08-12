import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformI18nProvider } from "../../../lib/i18n/platformI18n";
import { ToastProvider } from "../../ui/ToastProvider";
import { ImageUpload } from "./ImageUpload";

const mocks = vi.hoisted(() => ({
  resolveUpload: undefined as
    | ((value: { thumbnail: string; detail: string; paths: string[] }) => void)
    | undefined,
}));

vi.mock("../../../utils/image", () => ({
  compressImage: vi.fn(),
  createProductImageVariants: vi.fn(async (file: File) => ({
    thumbnail: file,
    detail: file,
  })),
}));

vi.mock("../../../lib/api/storage", () => ({
  uploadImage: vi.fn(),
  uploadProductImages: vi.fn(
    () =>
      new Promise((resolve) => {
        mocks.resolveUpload = resolve;
      }),
  ),
}));

afterEach(() => {
  cleanup();
  mocks.resolveUpload = undefined;
});

describe("ImageUpload", () => {
  it("does not deliver a completed upload after the selected form unmounts", async () => {
    const onProductUploaded = vi.fn();
    const { unmount } = render(
      <PlatformI18nProvider>
        <ToastProvider>
          <ImageUpload
            shopId="shop-1"
            bucket="product-images"
            label="Upload product image"
            onUploaded={vi.fn()}
            onProductUploaded={onProductUploaded}
          />
        </ToastProvider>
      </PlatformI18nProvider>,
    );

    fireEvent.change(
      screen.getByLabelText("Upload product image"),
      { target: { files: [new File(["image"], "product.png")] } },
    );
    await waitFor(() => expect(mocks.resolveUpload).toBeTypeOf("function"));

    unmount();
    mocks.resolveUpload?.({
      thumbnail: "https://example.com/thumb.jpg",
      detail: "https://example.com/detail.jpg",
      paths: ["thumb", "detail"],
    });
    await Promise.resolve();

    expect(onProductUploaded).not.toHaveBeenCalled();
  });
});
