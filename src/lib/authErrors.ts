type AuthAction = "signin" | "signup" | "recovery" | "callback" | "password";

type AuthErrorLike = {
  code?: unknown;
  status?: unknown;
};

export type AuthErrorNotice = {
  title: string;
  message: string;
};

export function getAuthErrorNotice(
  error: unknown,
  action: AuthAction,
): AuthErrorNotice {
  const authError =
    error && typeof error === "object" ? (error as AuthErrorLike) : {};
  const code = typeof authError.code === "string" ? authError.code : "";
  const status = typeof authError.status === "number" ? authError.status : 0;

  if (
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    return {
      title: "Please wait a moment",
      message:
        action === "recovery" || action === "signup"
          ? "Too many emails were requested. Wait a few minutes before trying again."
          : "Too many attempts were made. Wait a few minutes before trying again.",
    };
  }

  if (code === "invalid_credentials") {
    return {
      title: "Sign in failed",
      message: "The email address or password is incorrect.",
    };
  }

  if (code === "email_not_confirmed") {
    return {
      title: "Confirm your email",
      message: "Open the confirmation email before signing in.",
    };
  }

  if (code === "weak_password") {
    return {
      title: "Choose a stronger password",
      message:
        "Use at least 10 characters with an uppercase letter, a lowercase letter, and a number.",
    };
  }

  if (code === "otp_expired" || code === "flow_state_expired") {
    return {
      title: "Link expired",
      message: "This secure link is invalid or expired. Request a new one.",
    };
  }

  const defaults: Record<AuthAction, AuthErrorNotice> = {
    signin: {
      title: "Sign in failed",
      message: "We could not sign you in. Check your details and try again.",
    },
    signup: {
      title: "Could not create account",
      message: "We could not create the account. Please try again.",
    },
    recovery: {
      title: "Could not send recovery email",
      message: "We could not send the recovery email. Please try again later.",
    },
    callback: {
      title: "Could not finish sign in",
      message: "This secure link is invalid or expired. Request a new one.",
    },
    password: {
      title: "Could not set password",
      message: "We could not save the password. Request a new secure link.",
    },
  };

  return defaults[action];
}
