import { FormEvent, useCallback, useEffect, useState } from "react";
import { ShieldCheck, Trash2, UserPlus, LoaderCircle, Users, RotateCw, Ban } from "lucide-react";
import { deleteStaffMember, getShopInvitations, getStaffMembers, inviteShopMember, saveStaffMember, updateShopInvitation, type ShopInvitation, type StaffAccess, type StaffRole } from "../../lib/api";
import { getErrorMessage } from "../../lib/errors";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field, SelectInput, TextInput } from "../ui/Field";
import { AdminCard } from "./AdminCard";
import { EmptyState } from "../ui/EmptyState";

export function StaffManager({ shopId }: { shopId: string }) {
  const [members, setMembers] = useState<StaffAccess[]>([]);
  const [invitations, setInvitations] = useState<ShopInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [nextMembers, nextInvitations] = await Promise.all([getStaffMembers(shopId), getShopInvitations(shopId)]);
    setMembers(nextMembers); setInvitations(nextInvitations);
  }, [shopId]);
  useEffect(() => { setLoading(true); void reload().catch((caught) => setError(getErrorMessage(caught))).finally(() => setLoading(false)); }, [reload]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
    setBusy(true); setError("");
    try { await inviteShopMember(shopId, email.trim().toLowerCase(), role); setEmail(""); await reload(); }
    catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); }
  }
  async function update(member: StaffAccess, changes: Partial<Pick<StaffAccess,"role"|"active">>) {
    if (!member.user_id) return; setBusy(true); setError("");
    try { await saveStaffMember(shopId,{user_id:member.user_id,role:changes.role??member.role,active:changes.active??member.active}); await reload(); }
    catch(caught){setError(getErrorMessage(caught));} finally{setBusy(false);}
  }
  async function remove(member: StaffAccess) {
    if(!member.user_id||!window.confirm("Remove this shop membership?"))return;setBusy(true);setError("");
    try{await deleteStaffMember(shopId,member.user_id);await reload();}catch(caught){setError(getErrorMessage(caught));}finally{setBusy(false);}
  }
  async function invitationAction(invitation: ShopInvitation, action:"resend"|"revoke") {
    setBusy(true);setError("");try{await updateShopInvitation(shopId,invitation.id,action);await reload();}catch(caught){setError(getErrorMessage(caught));}finally{setBusy(false);}
  }

  return <AdminCard title="Shop staff" description="Invite people by email and assign a role for this shop." icon={<ShieldCheck size={18}/> }>
    {error&&<Alert variant="error" title="Could not update staff" onClose={()=>setError("")}>{error}</Alert>}
    <form onSubmit={submit}><section className="admin-form-section">
      <div className="admin-form-section-heading"><span><UserPlus size={15}/></span><div><h3>Invite a staff member</h3><p>Existing users join immediately; new users receive a secure sign-in invitation.</p></div></div>
      <div className="form-grid"><Field label="Email"><TextInput type="email" value={email} placeholder="staff@example.com" onChange={(event)=>setEmail(event.target.value)}/></Field><Field label="Role"><SelectInput value={role} onChange={(event)=>setRole(event.target.value as StaffRole)}><option value="staff">Staff</option><option value="admin">Admin</option><option value="owner">Owner</option></SelectInput></Field></div>
      <Button type="submit" icon={<UserPlus size={16}/>} loading={busy}>Send invitation</Button>
    </section></form>
    <section className="admin-form-section" style={{marginTop:30}}><div className="admin-form-section-heading"><span><Users size={15}/></span><div><h3>Members</h3><p>Roles apply only to the active shop.</p></div></div>
      <div className="admin-staff-list">{!members.length?<EmptyState variant="compact" tone={loading?"loading":"neutral"} icon={loading?<LoaderCircle className="state-spinner" size={24}/>:<Users size={24}/>} title={loading?"Loading staff…":"No members yet"} message="Invite a staff member above."/>:members.map(member=><div key={member.user_id} className="admin-staff-row"><div className="admin-staff-identity"><strong>{member.email??"Shop member"}</strong><small>{member.role}</small></div><div className="admin-staff-controls"><SelectInput aria-label="Member role" value={member.role} disabled={busy} onChange={(event)=>void update(member,{role:event.target.value as StaffRole})}><option value="staff">Staff</option><option value="admin">Admin</option><option value="owner">Owner</option></SelectInput><label className="admin-toggle-label"><input type="checkbox" checked={member.active} disabled={busy} onChange={(event)=>void update(member,{active:event.target.checked})}/><span>Active</span></label><Button type="button" variant="danger" icon={<Trash2 size={15}/>} disabled={busy} onClick={()=>void remove(member)}>Remove</Button></div></div>)}</div>
    </section>
    {invitations.length>0&&<section className="admin-form-section" style={{marginTop:30}}><div className="admin-form-section-heading"><span><UserPlus size={15}/></span><div><h3>Invitations</h3><p>Pending and recent email invitations.</p></div></div><div className="admin-staff-list">{invitations.map(invitation=><div key={invitation.id} className="admin-staff-row"><div className="admin-staff-identity"><strong>{invitation.email}</strong><small>{invitation.role} · {invitation.status} · expires {new Date(invitation.expires_at).toLocaleDateString()}</small></div>{invitation.status==="pending"&&<div className="admin-staff-controls"><Button type="button" variant="secondary" icon={<RotateCw size={15}/>} disabled={busy} onClick={()=>void invitationAction(invitation,"resend")}>Resend</Button><Button type="button" variant="danger" icon={<Ban size={15}/>} disabled={busy} onClick={()=>void invitationAction(invitation,"revoke")}>Revoke</Button></div>}</div>)}</div></section>}
  </AdminCard>;
}
