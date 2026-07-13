import { useCallback, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { usePlatformI18n } from "../../lib/platformI18n";

type SwipeConfirmButtonProps = {
  onConfirm: () => boolean | Promise<boolean>;
  isConfirming: boolean;
};

export function SwipeConfirmButton({ onConfirm, isConfirming }: SwipeConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "dragging" | "committing" | "success" | "error">("idle");
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const phaseRef = useRef<typeof phase>("idle");
  const startXRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const { t } = usePlatformI18n();

  const updateProgress = useCallback((next: number) => { progressRef.current = next; setProgress(next); }, []);
  const updatePhase = useCallback((next: typeof phase) => { phaseRef.current = next; setPhase(next); }, []);
  const commit = useCallback(async () => {
    if (phaseRef.current === "committing" || phaseRef.current === "success" || isConfirming) return;
    updateProgress(1);
    updatePhase("committing");
    if (await onConfirm()) { updatePhase("success"); return; }
    updatePhase("error");
    window.setTimeout(() => { updateProgress(0); updatePhase("idle"); }, 700);
  }, [isConfirming, onConfirm, updatePhase, updateProgress]);
  const finishGesture = (velocity = 0) => {
    if (phaseRef.current !== "dragging") return;
    if (progressRef.current >= 0.88 || (progressRef.current >= 0.68 && velocity > 0.55)) void commit();
    else { updateProgress(0); updatePhase("idle"); }
  };

  return (
    <div
      className={`swipe-track phase-${phase}`}
      ref={trackRef}
      role="button"
      tabIndex={isConfirming ? -1 : 0}
      aria-label={t("Swipe right or press Enter to confirm payment and update stock")}
      aria-disabled={isConfirming || phase === "committing"}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void commit(); } }}
      onPointerDown={(event) => {
        if (isConfirming || phaseRef.current !== "idle") return;
        event.currentTarget.setPointerCapture(event.pointerId);
        startXRef.current = event.clientX;
        lastXRef.current = event.clientX;
        lastTimeRef.current = performance.now();
        updatePhase("dragging");
      }}
      onPointerMove={(event) => {
        if (phaseRef.current !== "dragging" || !trackRef.current) return;
        const maxTravel = Math.max(1, trackRef.current.clientWidth - 54);
        updateProgress(Math.max(0, Math.min(1, (event.clientX - startXRef.current) / maxTravel)));
        lastXRef.current = event.clientX;
        lastTimeRef.current = performance.now();
      }}
      onPointerUp={(event) => {
        const elapsed = Math.max(1, performance.now() - lastTimeRef.current);
        finishGesture((event.clientX - lastXRef.current) / elapsed);
      }}
      onPointerCancel={() => finishGesture()}
      style={{ "--swipe-progress": progress } as React.CSSProperties}
    >
      <div className="swipe-bg" />
      <span className="swipe-text">{t(phase === "committing" || isConfirming ? "Confirming payment…" : phase === "success" ? "Payment confirmed" : phase === "error" ? "Could not confirm — try again" : "Swipe to confirm payment")}</span>
      <div className="swipe-handle">{phase === "success" ? <Check size={19} /> : phase === "committing" ? <Loader2 size={18} className="spin-icon" /> : <span>›</span>}</div>
      <span className="sr-only" aria-live="polite">{phase === "success" ? t("Payment confirmed and stock updated") : phase === "error" ? t("Confirmation failed. Try again.") : ""}</span>
    </div>
  );
}
