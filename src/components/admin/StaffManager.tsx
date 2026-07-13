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
  { value: "owner", label: "Owner", description: "Full shop and staff access" },
];

export function StaffManager({ shopId }: { shopId: string }) {
  const [members, setMembers] = useState<StaffAccess[]>([]);
  const [invitations, setInvitations] = useState<ShopInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<StaffAccess | null>(null);
  const [ownerChange, setOwnerChange] = useState<{
    member: StaffAccess;
    changes: Partial<Pick<StaffAccess, "role" | "active">>;
  } | null>(null);
  const toast = useToast();
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
        toast.error(getErrorMessage(caught), "Could not load staff"),
      )
      .finally(() => setLoading(false));
  }, [reload, toast]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Enter a valid email address.", "Could not send invitation");
      return;
    }
    setBusy(true);
    try {
      const outcome = await inviteShopMember(
        shopId,
        email.trim().toLowerCase(),
        role,
      );
      setEmail("");
      await reload();
      toast.success(
        outcome === "invitation_sent"
          ? "Invitation email sent."
          : outcome === "membership_granted"
            ? "Existing account granted access."
            : outcome === "already_owner"
              ? "This person is already an owner."
              : "This person already has shop access.",
      );
    } catch (caught) {
      toast.error(getErrorMessage(caught), "Could not send invitation");
    } finally {
      setBusy(false);
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
    setBusy(true);
    try {
      await saveStaffMember(shopId, {
        user_id: member.user_id,
        role: changes.role ?? member.role,
        active: changes.active ?? member.active,
      });
      await reload();
      toast.success("Staff access updated.");
    } catch (caught) {
      toast.error(getErrorMessage(caught), "Could not update staff");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!removing?.user_id) return;
    setBusy(true);
    try {
      await deleteStaffMember(shopId, removing.user_id);
      setRemoving(null);
      await reload();
      toast.success("Shop access removed.");
    } catch (caught) {
      toast.error(getErrorMessage(caught), "Could not remove access");
    } finally {
      setBusy(false);
    }
  }
  async function revoke(invitation: ShopInvitation) {
    setBusy(true);
    try {
      await updateShopInvitation(shopId, invitation.id, "revoke");
      await reload();
      toast.success("Invitation revoked.");
    } catch (caught) {
      toast.error(getErrorMessage(caught), "Could not revoke invitation");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminCard
      title="Shop staff"
      description="Invite teammates and control access to this shop."
      icon={<ShieldCheck size={18} />}
    >
      <div className="staff-manager-layout">
        <form onSubmit={submit} className="staff-invite-panel">
          <div className="staff-section-heading">
            <span>
              <UserPlus size={17} />
            </span>
            <div>
              <h3>Invite a teammate</h3>
              <p>They’ll receive secure access for this shop only.</p>
            </div>
          </div>
          <div className="staff-invite-fields">
            <Field label="Email">
              <TextInput
                type="email"
                autoComplete="email"
                value={email}
                placeholder="staff@example.com"
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="Role">
              <SelectMenu
                label="Invitation role"
                value={role}
                options={inviteRoles}
                onChange={(value) => setRole(value as StaffRole)}
              />
            </Field>
          </div>
          <Button
            type="submit"
            icon={<UserPlus size={16} />}
            loading={busy}
            className="staff-invite-button"
          >
            Send invitation
          </Button>
        </form>
        <section className="staff-members-panel">
          <div className="staff-section-heading">
            <span>
              <Users size={17} />
            </span>
            <div>
              <h3>Members</h3>
              <p>
                {members.length} {members.length === 1 ? "person" : "people"}{" "}
                with shop access
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
                title={loading ? "Loading staff…" : "No members yet"}
                message="Invite a staff member above."
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
                    <strong>{member.email ?? "Shop member"}</strong>
                    <span
                      className={`staff-status ${member.active ? "active" : "inactive"}`}
                    >
                      <i />
                      {member.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="admin-staff-controls">
                    <SelectMenu
                      label={`Role for ${member.email}`}
                      value={member.role}
                      options={memberRoles}
                      disabled={busy}
                      onChange={(value) =>
                        void update(member, { role: value as StaffRole })
                      }
                    />
                    <label className="staff-access-toggle">
                      <input
                        type="checkbox"
                        checked={member.active}
                        disabled={busy}
                        onChange={(event) =>
                          void update(member, { active: event.target.checked })
                        }
                      />
                      <span aria-hidden="true" />
                      <b>{member.active ? "Enabled" : "Disabled"}</b>
                    </label>
                    <Button
                      type="button"
                      variant="danger"
                      icon={<Trash2 size={15} />}
                      disabled={busy}
                      onClick={() => setRemoving(member)}
                      aria-label={`Remove ${member.email}`}
                    >
                      Remove
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
              <h3>Invitations</h3>
              <p>Pending and recent email invitations</p>
            </div>
          </div>
          {invitations.map((invitation) => (
            <div key={invitation.id} className="staff-invitation-row">
              <div>
                <strong>{invitation.email}</strong>
                <small>
                  {invitation.role} · {invitation.status} · expires{" "}
                  {new Date(invitation.expires_at).toLocaleDateString()}
                </small>
              </div>
              {invitation.status === "pending" && (
                <Button
                  type="button"
                  variant="danger"
                  icon={<Ban size={15} />}
                  disabled={busy}
                  onClick={() => void revoke(invitation)}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </section>
      )}
      <Modal
        title="Confirm ownership change"
        isOpen={Boolean(ownerChange)}
        onClose={() => setOwnerChange(null)}
      >
        <div className="staff-remove-confirm">
          <p>
            Ownership changes affect full shop and team access. The shop must
            always retain at least one active owner.
          </p>
          <div>
            <Button variant="secondary" onClick={() => setOwnerChange(null)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() => {
                if (!ownerChange) return;
                const pending = ownerChange;
                setOwnerChange(null);
                void update(pending.member, pending.changes, true);
              }}
            >
              Confirm change
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        title="Remove shop access?"
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
      >
        <div className="staff-remove-confirm">
          <p>
            <strong>{removing?.email}</strong> will immediately lose access to
            this shop.
          </p>
          <div>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => void remove()}
            >
              Remove access
            </Button>
          </div>
        </div>
      </Modal>
    </AdminCard>
  );
}
