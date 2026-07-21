import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultBooth } from "../../lib/constants";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import { SocialLinkFields } from "./SocialLinkFields";

describe("social link fields", () => {
  afterEach(cleanup);

  it("edits new channels and lets staff hide them independently", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PlatformI18nProvider>
        <SocialLinkFields settings={defaultBooth} onChange={onChange} />
      </PlatformI18nProvider>,
    );

    fireEvent.change(screen.getByLabelText("YouTube profile URL"), {
      target: { value: "https://youtube.com/@artist" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ youtube_url: "https://youtube.com/@artist" }),
    );

    const threadsCard = screen
      .getByLabelText("Threads profile URL")
      .closest("section")!;
    await user.click(threadsCard.querySelector("input[type='checkbox']")!);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ threads_visible: false }),
    );
  });
});
