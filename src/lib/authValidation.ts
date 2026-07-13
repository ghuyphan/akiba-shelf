export const NEW_PASSWORD_MIN_LENGTH = 10;
export const NEW_PASSWORD_HINT =
  "Use 10+ characters with uppercase, lowercase, and a number.";

export function isStrongPassword(password: string) {
  return (
    password.length >= NEW_PASSWORD_MIN_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );
}

export function getNewPasswordError(password: string, confirmation: string) {
  if (!isStrongPassword(password)) return NEW_PASSWORD_HINT;
  if (password !== confirmation) return "Both passwords must match.";
  return null;
}
