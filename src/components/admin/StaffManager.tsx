import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Ban,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  deleteStaffMember,
  getShopInvitations,
  getStaffMembers,
  inviteShopMember,
  saveStaffMember,
  updateShopInvitation,
  type ShopInvitation,
  type StaffAccess,
  type StaffRole,
} from "../../lib/api";
import { getErrorMessage } from "../../lib/errors";
import { useToast } from "../ui/ToastProvider";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { SelectMenu } from "../ui/SelectMenu";
import { AdminCard } from "./AdminCard";
import { EmptyState } from "../ui/EmptyState";
import { usePlatformI18n } from "../../lib/platformI18n";

const inviteRoles = [
  { value: "staff", label: "Staff", description: "Process and fulfil orders" },
  {
    value: "admin",
    label: "Admin",
    description: "Manage catalog, settings, and orders",
  },
];
const memberRoles = [
  ...inviteRoles,
  {
    value: "owner",
    label: "Owner",
    description: "Full shop and team access",
  },
];
export function StaffManager({ shopId }: { shopId: string }) {
  const [members, setMembers] = useState<StaffAccess[]>([]);
  const [invitations, setInvitations] = useState<ShopInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [ownershipBusy, setOwnershipBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<StaffAccess | null>(null);
  const [ownerChange, setOwnerChange] = useState<{
    member: StaffAccess;
    changes: Partial<Pick<StaffAccess, "role" | "active">>;
  } | null>(null);
  const toast = useToast();
  const { locale, t } = usePlatformI18n();
  const localizedInviteRoles = inviteRoles.map((option) => ({ ...option, label: t(option.label), description: t(option.description) }));
  const localizedMemberRoles = memberRoles.map((option) => ({ ...option, label: t(option.label), description: t(option.description) }));
  const reload = useCallback(async () => {
    const [nextMembers, nextInvitations] = await Promise.all([
      getStaffMembers(shopId),
      getShopInvitations(shopId),
    ]);
    setMembers(nextMembers);
    setInvitations(nextInvitations);
  }, [shopId]);
  useEffect(() => {
    setLoading(true);
    void reload()
      .catch((caught) =>
        toast.error(t(getErrorMessage(caught)), t("Could not load staff")),
      )
      .finally(() => setLoading(false));
  }, [reload, t, toast]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error(t("Enter a valid email address."), t("Could not send invitation"));
      return;
    }
    setInviteBusy(true);
    try {
      await inviteShopMember(shopId, email.trim().toLowerCase(), role);
      setEmail("");
      await reload();
      toast.success(t("Access request processed."));
    } catch (caught) {
      toast.error(t(getErrorMessage(caught)), t("Could not send invitation"));
    } finally {
      setInviteBusy(false);
    }
  }
  async function update(
    member: StaffAccess,
    changes: Partial<Pick<StaffAccess, "role" | "active">>,
    confirmed = false,
  ) {
    if (!member.user_id) return;
    if (!confirmed && (member.role === "owner" || changes.role === "owner")) {
      setOwnerChange({ member, changes });
      return;
    }
    setUpdatingId(member.user_id);
    try {
      await saveStaffMember(shopId, {
        user_id: member.user_id,
        role: changes.role ?? member.role,
        active: changes.active ?? member.active,
      });
      await reload();
      toast.success(t("Staff access updated."));
    } catch (caught) {
      toast.error(t(getErrorMessage(caught)), t("Could not update staff"));
    } finally {
      setUpdatingId(null);
    }
  }
  async function remove() {
    if (!removing?.user_id) return;
    setRemoveBusy(true);
    try {
      await deleteStaffMember(shopId, removing.user_id);
      setRemoving(null);
      await reload();
      toast.success(t("Shop access removed."));
    } catch (caught) {
      toast.error(t(getErrorMessage(caught)), t("Could not remove access"));
    } finally {
      setRemoveBusy(false);
    }
  }
  async function revoke(invitation: ShopInvitation) {
    setRevokingId(invitation.id);
    try {
      await updateShopInvitation(shopId, invitation.id, "revoke");
      await reload();
      toast.success(t("Invitation revoked."));
    } catch (caught) {
      toast.error(t(getErrorMessage(caught)), t("Could not revoke invitation"));
    } finally {
      setRevokingId(null);
    }
  }
  return (
    <AdminCard
      title={t("Shop staff")}
      description={t("Invite teammates and control access to this shop.")}
      icon={<ShieldCheck size={18} />}
      className="admin-team-card"
    >
      <div className="staff-manager-layout">
        <form onSubmit={submit} className="staff-invite-panel">
          <div className="staff-section-heading">
            <span>
              <UserPlus size={17} />
            </span>
            <div>
              <h3>{t("Invite a teammate")}</h3>
              <p>{t("They’ll receive secure access for this shop only.")}</p>
            </div>
          </div>
          <div className="staff-invite-fields">
            <Field label={t("Email")}>
              <TextInput
                type="email"
                autoComplete="email"
                value={email}
                placeholder="staff@example.com"
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label={t("Role")}>
              <SelectMenu
                label={t("Invitation role")}
                value={role}
                options={localizedInviteRoles}
                onChange={(value) => setRole(value as StaffRole)}
              />
            </Field>
          </div>
          <Button
            type="submit"
            icon={<UserPlus size={16} />}
            loading={inviteBusy}
            className="staff-invite-button"
          >
            {t("Send invitation")}
          </Button>
        </form>
        <section className="staff-members-panel">
          <div className="staff-section-heading">
            <span>
              <Users size={17} />
            </span>
            <div>
              <h3>{t("Members")}</h3>
              <p>
                {t("{{count}} people with shop access", { count: members.length })}
              </p>
            </div>
          </div>
          <div className="admin-staff-list">
            {!members.length ? (
              <EmptyState
                variant="compact"
                tone={loading ? "loading" : "neutral"}
                icon={
                  loading ? (
                    <LoaderCircle className="state-spinner" size={24} />
                  ) : (
                    <Users size={24} />
                  )
                }
                title={loading ? t("Loading staff…") : t("No members yet")}
                message={t("Invite a staff member above.")}
              />
            ) : (
              members.map((member) => (
                <article
                  key={member.user_id}
                  className={`admin-staff-row ${member.active ? "" : "inactive"}`}
                >
                  <div className="staff-avatar">
                    {(member.email?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="admin-staff-identity">
                    <strong>{member.email ?? t("Shop member")}</strong>
                    <span
                      className={`staff-status ${member.active ? "active" : "inactive"}`}
                    >
                      <i />
                      {t(member.active ? "Active" : "Inactive")}
                    </span>
                  </div>
                  <div className="admin-staff-controls">
                    <SelectMenu
                      label={t("Role for {{email}}", { email: member.email ?? "" })}
                      value={member.role}
                      options={localizedMemberRoles}
                      disabled={updatingId === member.user_id}
                      onChange={(value) =>
                        void update(member, { role: value as StaffRole })
                      }
                    />
                    <label className="staff-access-toggle">
                      <input
                        type="checkbox"
                        checked={member.active}
                        disabled={updatingId === member.user_id}
                        onChange={(event) =>
                          void update(member, { active: event.target.checked })
                        }
                      />
                      <span aria-hidden="true" />
                      <b>{t(member.active ? "Enabled" : "Disabled")}</b>
                    </label>
                    <Button
                      type="button"
                      variant="danger"
                      icon={<Trash2 size={15} />}
                      disabled={
                        removeBusy && removing?.user_id === member.user_id
                      }
                      onClick={() => setRemoving(member)}
                      aria-label={t("Remove {{email}}", { email: member.email ?? "" })}
                    >
                      {t("Remove")}
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
      {invitations.length > 0 && (
        <section className="staff-invitations">
          <div className="staff-section-heading">
            <span>
              <Mail size={17} />
            </span>
            <div>
              <h3>{t("Invitations")}</h3>
              <p>{t("Pending and recent email invitations")}</p>
            </div>
          </div>
          {invitations.map((invitation) => (
            <div key={invitation.id} className="staff-invitation-row">
              <div>
                <strong>{invitation.email}</strong>
                <small>
                  {t(invitation.role)} · {t(invitation.status)} · {t("expires")}{" "}
                  {new Date(invitation.expires_at).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US")}
                </small>
              </div>
              {invitation.status === "pending" && (
                <Button
                  type="button"
                  variant="danger"
                  icon={<Ban size={15} />}
                  loading={revokingId === invitation.id}
                  onClick={() => void revoke(invitation)}
                >
                  {t("Revoke")}
                </Button>
              )}
            </div>
          ))}
        </section>
      )}
      <Modal
        title={t("Confirm ownership change")}
        isOpen={Boolean(ownerChange)}
        onClose={() => setOwnerChange(null)}
      >
        <div className="staff-remove-confirm">
          <p>
            {t("Ownership changes affect full shop and team access. The shop must always retain at least one active owner.")}
          </p>
          <div>
            <Button variant="secondary" onClick={() => setOwnerChange(null)}>
              {t("Cancel")}
            </Button>
            <Button
              loading={ownershipBusy}
              onClick={() => {
                if (!ownerChange) return;
                const pending = ownerChange;
                setOwnershipBusy(true);
                void update(pending.member, pending.changes, true).finally(
                  () => {
                    setOwnershipBusy(false);
                    setOwnerChange(null);
                  },
                );
              }}
            >
              {t("Confirm change")}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        title={t("Remove shop access?")}
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
      >
        <div className="staff-remove-confirm">
          <p>
            <strong>{removing?.email}</strong> {t("will immediately lose access to this shop.")}
          </p>
          <div>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {t("Cancel")}
            </Button>
            <Button
              variant="danger"
              loading={removeBusy}
              onClick={() => void remove()}
            >
              {t("Remove access")}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminCard>
  );
}
