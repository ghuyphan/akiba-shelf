import { useCallback, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";

type SwipeButtonProps = {
  onConfirm: () => boolean | Promise<boolean>;
  isConfirming: boolean;
  idleText: string;
  committingText: string;
  successText: string;
  errorText: string;
  ariaLabel: string;
};

export function SwipeButton({
  onConfirm,
  isConfirming,
  idleText,
  committingText,
  successText,
  errorText,
  ariaLabel,
}: SwipeButtonProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "dragging" | "committing" | "success" | "error">("idle");
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const phaseRef = useRef<typeof phase>("idle");
  const startXRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);

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
      aria-label={ariaLabel}
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
      <span className="swipe-text">
        {phase === "committing" || isConfirming
          ? committingText
          : phase === "success"
          ? successText
          : phase === "error"
          ? errorText
          : idleText}
      </span>
      <div className="swipe-handle">
        {phase === "success" ? (
          <Check size={19} />
        ) : phase === "committing" ? (
          <Loader2 size={18} className="spin-icon" />
        ) : (
          <span>›</span>
        )}
      </div>
    </div>
  );
}
