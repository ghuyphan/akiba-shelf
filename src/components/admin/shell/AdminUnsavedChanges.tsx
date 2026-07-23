import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { ConfirmationDialog } from "../../ui/ConfirmationDialog";

type DirtyRegistration = {
  dirty: boolean;
  discard?: () => void;
};

type AdminUnsavedChangesContextValue = {
  register: (id: string, value: DirtyRegistration) => () => void;
  requestNavigation: (action: () => void) => void;
};

const AdminUnsavedChangesContext =
  createContext<AdminUnsavedChangesContextValue | null>(null);

export function AdminUnsavedChangesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = usePlatformI18n();
  const registrations = useRef(new Map<string, DirtyRegistration>());
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const register = useCallback((id: string, value: DirtyRegistration) => {
    registrations.current.set(id, value);
    return () => registrations.current.delete(id);
  }, []);

  const hasUnsavedChanges = useCallback(
    () => [...registrations.current.values()].some((value) => value.dirty),
    [],
  );

  const requestNavigation = useCallback(
    (action: () => void) => {
      if (!hasUnsavedChanges()) {
        action();
        return;
      }
      setPendingAction(() => action);
    },
    [hasUnsavedChanges],
  );

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const value = useMemo(
    () => ({ register, requestNavigation }),
    [register, requestNavigation],
  );

  return (
    <AdminUnsavedChangesContext.Provider value={value}>
      {children}
      <ConfirmationDialog
        isOpen={Boolean(pendingAction)}
        title={t("Discard unsaved changes?")}
        message={t("Your current edits will be lost.")}
        cancelLabel={t("Keep editing")}
        confirmLabel={t("Discard changes")}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          for (const registration of registrations.current.values()) {
            if (registration.dirty) registration.discard?.();
          }
          const action = pendingAction;
          setPendingAction(null);
          action?.();
        }}
      />
    </AdminUnsavedChangesContext.Provider>
  );
}

export function useAdminNavigationGuard() {
  const context = useContext(AdminUnsavedChangesContext);
  return context?.requestNavigation ?? ((action: () => void) => action());
}

export function useAdminUnsavedChanges(
  id: string,
  dirty: boolean,
  discard?: () => void,
) {
  const context = useContext(AdminUnsavedChangesContext);
  useEffect(() => {
    if (!context) return;
    return context.register(id, { dirty, discard });
  }, [context, dirty, discard, id]);
}
