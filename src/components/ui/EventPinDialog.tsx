import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "./Button";
import { Modal, ModalFooter } from "./Modal";

type EventPinDialogCopy = {
  title: string;
  message: string;
  pinLabel: string;
  confirmPinLabel: string;
  cancelLabel: string;
  submitLabel: string;
  submittingLabel: string;
  invalidPin: string;
  pinMismatch: string;
  submitError: string;
  closeLabel: string;
};

type EventPinDialogProps = {
  isOpen: boolean;
  mode: "setup" | "verify";
  copy: EventPinDialogCopy;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<string | void>;
};

function normalizePin(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function EventPinDialog({
  isOpen,
  mode,
  copy,
  onClose,
  onSubmit,
}: EventPinDialogProps) {
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPin("");
    setConfirmation("");
    setError("");
    setBusy(false);
    const focusFrame = window.requestAnimationFrame(() =>
      pinInputRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(focusFrame);
  }, [isOpen, mode]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setError(copy.invalidPin);
      return;
    }
    if (mode === "setup" && pin !== confirmation) {
      setError(copy.pinMismatch);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const nextError = await onSubmit(pin);
      if (nextError) setError(nextError);
    } catch {
      setError(copy.submitError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={copy.title}
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!busy}
      mobileSheet
      historyEnabled={false}
      className="event-pin-modal"
      closeLabel={copy.closeLabel}
    >
      <form className="event-pin-form" onSubmit={handleSubmit} noValidate>
        <span className="event-pin-icon" aria-hidden="true">
          <KeyRound size={24} />
        </span>
        <p>{copy.message}</p>
        <label className="event-pin-field">
          <span>{copy.pinLabel}</span>
          <input
            ref={pinInputRef}
            type="password"
            aria-label={copy.pinLabel}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete={
              mode === "setup" ? "new-password" : "current-password"
            }
            value={pin}
            disabled={busy}
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => {
              setPin(normalizePin(event.target.value));
              if (error) setError("");
            }}
          />
        </label>
        {mode === "setup" && (
          <label className="event-pin-field">
            <span>{copy.confirmPinLabel}</span>
            <input
              type="password"
              aria-label={copy.confirmPinLabel}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="new-password"
              value={confirmation}
              disabled={busy}
              aria-invalid={Boolean(error) || undefined}
              onChange={(event) => {
                setConfirmation(normalizePin(event.target.value));
                if (error) setError("");
              }}
            />
          </label>
        )}
        {error && (
          <p className="event-pin-error" role="alert">
            {error}
          </p>
        )}
        <ModalFooter className="event-pin-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            {copy.cancelLabel}
          </Button>
          <Button
            type="submit"
            loading={busy}
            loadingText={copy.submittingLabel}
          >
            {copy.submitLabel}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
