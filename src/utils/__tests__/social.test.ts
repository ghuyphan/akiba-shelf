import { describe, expect, it } from "vitest";
import { defaultBooth } from "../../lib/constants";
import { configuredSocialPlatforms } from "../social";

describe("storefront social channels", () => {
  it("returns only configured channels that staff chose to display", () => {
    const channels = configuredSocialPlatforms({
      ...defaultBooth,
      instagram_url: "https://instagram.com/artist",
      x_url: "https://x.com/artist",
      threads_url: "https://threads.net/@artist",
      threads_visible: false,
      youtube_url: "https://youtube.com/@artist",
    });

    expect(channels.map((channel) => channel.label)).toEqual([
      "Instagram",
      "X",
      "YouTube",
    ]);
  });
});
