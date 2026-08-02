import { useCallback, useEffect, useRef, useState } from "react";
import type { GachaPackDownloadState } from "../../components/gacha/host/GachaGameSelector";
import { getUserFacingErrorMessage } from "../../lib/errors";
import {
  GACHA_OFFLINE_PROGRESS_MESSAGE_TYPE,
  GACHA_OFFLINE_REQUEST_MESSAGE_TYPE,
  GACHA_OFFLINE_STATUS_MESSAGE_TYPE,
  type GachaLaunchData,
} from "../../lib/gacha/gachaLaunch";
import {
  downloadGachaOfflinePack,
  downloadGachaOfflinePacks,
  gachaCatalogOfflineUrls,
  hasGachaOfflinePack,
  offlinePackPercent,
} from "../../lib/offline/offlinePack";
import type { GachaCatalog, GachaGameType } from "../../types/gacha";

type OfflineStatus = "idle" | "downloading" | "ready" | "error";

export function useGachaOfflineBridge({
  launch,
  activeGame,
  activeCatalog,
  availableGames,
  loadErrorMessage,
}: {
  launch: GachaLaunchData | null;
  activeGame: GachaGameType | null;
  activeCatalog: GachaCatalog | null;
  availableGames: GachaGameType[];
  loadErrorMessage: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const downloadRef = useRef<Promise<void> | null>(null);
  const progressRef = useRef<{ status: OfflineStatus; progress: number }>({
    status: "idle",
    progress: 0,
  });
  const [packDownload, setPackDownload] = useState<GachaPackDownloadState>({
    status: "idle",
    progress: 0,
  });
  const availableGameKey = availableGames.join(",");

  useEffect(() => {
    if (!launch || !availableGameKey) return;
    const games = availableGameKey.split(",") as GachaGameType[];
    let active = true;
    void Promise.all(games.map((game) => hasGachaOfflinePack(game)))
      .then((checks) => {
        if (active && checks.every(Boolean))
          setPackDownload({ status: "ready", progress: 100 });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [availableGameKey, launch]);

  const sendProgress = useCallback(
    (status: OfflineStatus, progress = 0, message?: string) => {
      progressRef.current = { status, progress };
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: GACHA_OFFLINE_PROGRESS_MESSAGE_TYPE,
          status,
          progress,
          message,
        },
        window.location.origin,
      );
    },
    [],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow ||
        !activeGame ||
        !activeCatalog
      )
        return;

      if (event.data?.type === GACHA_OFFLINE_STATUS_MESSAGE_TYPE) {
        void hasGachaOfflinePack(activeGame)
          .then((ready) => {
            sendProgress(
              ready ? "ready" : progressRef.current.status,
              ready ? 100 : progressRef.current.progress,
            );
          })
          .catch((cause) =>
            sendProgress(
              "error",
              0,
              getUserFacingErrorMessage(cause, loadErrorMessage),
            ),
          );
        return;
      }
      if (
        event.data?.type !== GACHA_OFFLINE_REQUEST_MESSAGE_TYPE ||
        !launch ||
        downloadRef.current
      )
        return;

      downloadRef.current = hasGachaOfflinePack(activeGame)
        .then(async (ready) => {
          if (ready) return sendProgress("ready", 100);
          sendProgress("downloading", 0);
          await downloadGachaOfflinePack(
            activeGame,
            gachaCatalogOfflineUrls(activeCatalog),
            (progress) =>
              sendProgress("downloading", offlinePackPercent(progress)),
          );
          sendProgress("ready", 100);
        })
        .catch((cause) =>
          sendProgress(
            "error",
            0,
            getUserFacingErrorMessage(cause, loadErrorMessage),
          ),
        )
        .finally(() => {
          downloadRef.current = null;
        });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [activeCatalog, activeGame, launch, loadErrorMessage, sendProgress]);

  const saveAvailableGames = useCallback(async () => {
    if (!launch || packDownload.status === "downloading") return;
    const imagesByGame = Object.fromEntries(
      availableGames.map((game) => [
        game,
        gachaCatalogOfflineUrls(launch.catalogs[game]),
      ]),
    );
    setPackDownload({ status: "downloading", progress: 1 });
    try {
      await downloadGachaOfflinePacks(
        availableGames,
        imagesByGame,
        (progress) =>
          setPackDownload({
            status: "downloading",
            progress: progress.percent,
            game: progress.gameType,
          }),
      );
      setPackDownload({ status: "ready", progress: 100 });
    } catch {
      setPackDownload({ status: "error", progress: 0 });
    }
  }, [availableGames, launch, packDownload.status]);

  return { iframeRef, packDownload, saveAvailableGames };
}
