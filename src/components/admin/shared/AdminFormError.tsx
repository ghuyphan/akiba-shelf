import { getUserFacingErrorMessage } from "../../../lib/errors";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { Alert } from "../../ui/Alert";

type AdminFormErrorProps = {
  error: string;
  fallback: string;
  title: string;
  onDismiss?: () => void;
};

export function AdminFormError({
  error,
  fallback,
  title,
  onDismiss,
}: AdminFormErrorProps) {
  const { t } = usePlatformI18n();
  if (!error) return null;

  return (
    <Alert
      variant="error"
      title={t(title)}
      className="admin-form-error"
      onClose={onDismiss}
      closeLabel={t("Dismiss notification")}
    >
      {t(getUserFacingErrorMessage(error, fallback))}
    </Alert>
  );
}
