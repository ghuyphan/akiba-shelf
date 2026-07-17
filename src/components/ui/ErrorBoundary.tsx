import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Localized fallback strings. Callers on the localized storefront pass
   * catalogI18n copy; platform routes fall back to the English defaults. */
  title?: string;
  message?: string;
  reloadLabel?: string;
  /** When this value changes, a caught error is cleared and children retry. */
  resetKey?: string | number;
  onError?: (error: Error) => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

const DEFAULT_FALLBACK = {
  title: "Something went wrong",
  message: "This page hit an unexpected error. Reload to try again.",
  reloadLabel: "Reload page",
} as const;

/**
 * Route-level error boundary. Keeps a render crash contained to one route so
 * the app shell (and the customer's cart) survives. The fallback reuses the
 * shared EmptyState/Button primitives, so it inherits design tokens.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Route render failed:", error);
    this.props.onError?.(error);
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <EmptyState
        tone="error"
        icon={<AlertTriangle size={28} />}
        title={this.props.title ?? DEFAULT_FALLBACK.title}
        message={this.props.message ?? DEFAULT_FALLBACK.message}
        action={
          <Button
            type="button"
            icon={<RotateCcw size={18} />}
            onClick={this.handleReload}
          >
            {this.props.reloadLabel ?? DEFAULT_FALLBACK.reloadLabel}
          </Button>
        }
      />
    );
  }
}
