import type { ReactNode } from "react";
import { useCatalogCopy } from "../../../lib/i18n/catalogLocale";
import type { CatalogCopy } from "../../../lib/i18n/catalogI18n";
import { AppUpdateNotice } from "../../ui/AppUpdateNotice";
import { ToastLocalization } from "../../ui/ToastProvider";

export function CatalogUpdateNotice({ copy }: { copy: CatalogCopy }) {
  return (
    <AppUpdateNotice
      copy={{
        ariaLabel: copy.updateAvailableLabel,
        title: copy.updateReadyTitle,
        message: copy.updateReadyHint,
        updateLabel: copy.updateNow,
        updatingLabel: copy.updatingApp,
        laterLabel: copy.updateLater,
        dismissLabel: copy.dismissUpdateNotice,
      }}
    />
  );
}

export function CatalogAppChrome({ children }: { children?: ReactNode }) {
  const copy = useCatalogCopy();
  return (
    <>
      <ToastLocalization
        labels={{
          successTitle: copy.toastSuccessTitle,
          errorTitle: copy.toastErrorTitle,
          infoTitle: copy.toastInfoTitle,
          dismiss: copy.dismissNotification,
        }}
      />
      <CatalogUpdateNotice copy={copy} />
      {children}
    </>
  );
}
