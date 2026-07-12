import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck, Trash2, UserPlus, User, UserCheck, Copy, Check } from "lucide-react";
import { deleteStaffMember, getStaffMembers, saveStaffMember, type StaffAccess, type StaffRole } from "../../lib/api";
import { getErrorMessage } from "../../lib/errors";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field, SelectInput, TextInput } from "../ui/Field";
import { AdminCard } from "./AdminCard";

export function StaffManager() {
  const [members, setMembers] = useState<StaffAccess[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function reload() { setMembers(await getStaffMembers()); }
  useEffect(() => { void reload().catch((caught) => setError(getErrorMessage(caught))); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) { setError("Enter an existing Supabase Auth user UUID."); return; }
    setBusy(true); setError("");
    try { await saveStaffMember({ user_id: userId, role, active: true }); setUserId(""); await reload(); }
    catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); }
  }

  async function update(member: StaffAccess, changes: Partial<Pick<StaffAccess, "role" | "active">>) {
    if (!member.user_id) return;
    setBusy(true); setError("");
    try { await saveStaffMember({ user_id: member.user_id, role: changes.role ?? member.role, active: changes.active ?? member.active }); await reload(); }
    catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); }
  }

  async function remove(member: StaffAccess) {
    if (!member.user_id || !window.confirm("Remove this staff membership?")) return;
    setBusy(true); setError("");
    try { await deleteStaffMember(member.user_id); await reload(); }
    catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); }
  }

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AdminCard title="Staff access" description="Owners grant roles to existing Supabase Auth users." icon={<ShieldCheck size={18} />}>
      {error && <Alert variant="error" title="Could not update staff" onClose={() => setError("")}>{error}</Alert>}
      
      <form onSubmit={submit}>
        <section className="admin-form-section">
          <div className="admin-form-section-heading">
            <span><UserPlus size={15} /></span>
            <div>
              <h3>Grant staff access</h3>
              <p>Assign a role to an existing user via their Supabase Auth UUID.</p>
            </div>
          </div>
          
          <div className="form-grid">
            <Field label="Auth user UUID" hint="Create the user in Supabase Auth first.">
              <TextInput 
                value={userId} 
                placeholder="00000000-0000-0000-0000-000000000000" 
                onChange={(event) => setUserId(event.target.value)} 
              />
            </Field>
            <Field label="Role">
              <SelectInput value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </SelectInput>
            </Field>
          </div>
          <Button type="submit" icon={<UserPlus size={16} />} loading={busy}>Add staff member</Button>
        </section>
      </form>

      <section className="admin-form-section" style={{ marginTop: "30px" }}>
        <div className="admin-form-section-heading">
          <span><ShieldCheck size={15} /></span>
          <div>
            <h3>Current staff</h3>
            <p>Manage roles and active status for existing staff members.</p>
          </div>
        </div>

        <div className="admin-staff-list">
          {members.length === 0 ? (
            <p className="admin-empty-state">No staff members configured yet.</p>
          ) : (
            members.map((member) => {
              const displayId = member.user_id ? `${member.user_id.slice(0, 8)}...${member.user_id.slice(-8)}` : "";
              return (
                <div key={member.user_id} className="admin-staff-row">
                  <div className="admin-staff-identity">
                    <div className="admin-staff-avatar">
                      {member.role === "owner" ? <ShieldCheck size={16} className="role-icon-owner" /> : 
                       member.role === "admin" ? <UserCheck size={16} className="role-icon-admin" /> : 
                       <User size={16} className="role-icon-staff" />}
                    </div>
                    <code title={member.user_id}>{displayId}</code>
                    <button 
                      type="button" 
                      className="admin-staff-copy-btn" 
                      onClick={() => member.user_id && copyToClipboard(member.user_id)}
                      title="Copy full UUID"
                    >
                      {copiedId === member.user_id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  
                  <div className="admin-staff-controls">
                    <SelectInput 
                      aria-label={`Role for ${member.user_id}`} 
                      value={member.role} 
                      disabled={busy} 
                      onChange={(event) => void update(member, { role: event.target.value as StaffRole })}
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </SelectInput>

                    <label className="admin-toggle-label">
                      <input 
                        type="checkbox" 
                        checked={member.active} 
                        disabled={busy} 
                        onChange={(event) => void update(member, { active: event.target.checked })} 
                      />
                      <span>Active</span>
                    </label>

                    <Button 
                      type="button" 
                      variant="danger" 
                      icon={<Trash2 size={15} />} 
                      disabled={busy} 
                      onClick={() => void remove(member)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </AdminCard>
  );
}

