import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { updateShop } from "../../../lib/api/shops";
import { SHOP_NAME_MAX_LENGTH } from "../../../lib/constants";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { useAsyncAction } from "../../../hooks/shared/useAsyncAction";
import type { ShopMembership } from "../../../types/catalog";
import { Button } from "../../ui/Button";
import { Field, TextInput } from "../../ui/Field";
import { Modal } from "../../ui/Modal";
import { useToast } from "../../ui/ToastProvider";
import { getUserFacingErrorMessage } from "../../../lib/errors";

type DashboardEditShopDialogProps = {
  shop: ShopMembership | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function DashboardEditShopDialog({
  shop,
  onClose,
  onSaved,
}: DashboardEditShopDialogProps) {
  const { t } = usePlatformI18n();
  const toast = useToast();
  const [name, setName] = useState("");
  const { busy, run, setError } = useAsyncAction();

  useEffect(() => {
    setName(shop?.shop_name ?? "");
    setError("");
  }, [shop, setError]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!shop) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(
        t("Shop name is required."),
        t("Could not save shop details"),
      );
      return;
    }
    if (trimmedName.length > SHOP_NAME_MAX_LENGTH) {
      toast.error(
        t("Shop name must be between 1 and 100 characters."),
        t("Could not save shop details"),
      );
      return;
    }

    let saved = false;
    await run(async () => {
      await updateShop(shop.shop_id, trimmedName);
      saved = true;
    }).catch((error) =>
      toast.error(
        t(getUserFacingErrorMessage(error, "Could not save shop details")),
        t("Could not save shop details"),
      ),
    );

    if (saved) {
      onClose();
      await onSaved();
    }
  }

  return (
    <Modal
      title={t("Edit shop details")}
      isOpen={shop !== null}
      onClose={onClose}
      appearance="admin"
      dismissible={!busy}
      mobileSheet
      className="edit-shop-modal"
      closeLabel={t("Close modal")}
    >
      <form
        onSubmit={handleSubmit}
        className="admin-form dashboard-edit-form"
        noValidate
      >
        <div className="dashboard-edit-intro">
          <span className="dashboard-edit-icon" aria-hidden="true">
            <Store size={20} />
          </span>
          <p>{t("Update the name customers see across your storefront.")}</p>
        </div>

        <section className="dashboard-edit-section">
          <Field label={t("Shop name")}>
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("My shop name")}
              maxLength={SHOP_NAME_MAX_LENGTH}
              disabled={busy}
            />
          </Field>
          <div className="dashboard-url-field">
            <span className="field-label">{t("Storefront URL")}</span>
            <div className="dashboard-url-readout">
              <code>/s/{shop?.shop_slug}</code>
              <span>{t("Fixed")}</span>
            </div>
            <span className="field-hint">
              {t("Shop URLs cannot currently be changed after creation.")}
            </span>
          </div>
        </section>

        <div className="dashboard-edit-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onClose}
          >
            {t("Cancel")}
          </Button>
          <Button type="submit" loading={busy} loadingText={t("Saving…")}>
            {t("Save changes")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
