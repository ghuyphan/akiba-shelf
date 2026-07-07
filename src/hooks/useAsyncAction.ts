import { useCallback, useState } from "react";

export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async <Result,>(action: () => Promise<Result>) => {
    setBusy(true);
    setError("");

    try {
      return await action();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Something went wrong.";
      setError(message);
      throw caught;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, run, setError };
}
