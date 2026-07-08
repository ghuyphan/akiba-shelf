import { useCallback, useState } from "react";
import { getErrorMessage, isSessionNoise } from "../lib/errors";

export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async <Result,>(action: () => Promise<Result>) => {
    setBusy(true);
    setError("");

    try {
      return await action();
    } catch (caught) {
      setError(isSessionNoise(caught) ? "" : getErrorMessage(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, run, setError };
}
