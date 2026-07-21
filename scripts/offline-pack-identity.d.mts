export type OfflineAssetWithSource = {
  path: string;
  size: number;
  sourcePath: string;
};

export function createOfflinePack(
  assetsWithSources: OfflineAssetWithSource[],
): {
  id: string;
  assets: Array<{ path: string; size: number }>;
};
