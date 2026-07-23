export const APP_RELEASE =
  typeof __MATSURI_RELEASE__ === "string"
    ? __MATSURI_RELEASE__
    : "development";

export function getReleaseContext() {
  return { release: APP_RELEASE } as const;
}
