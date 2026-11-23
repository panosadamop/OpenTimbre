import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
 Activity, AlertTriangle, Ban, Check, CheckCircle2, Copy, History, KeyRound, Lock, LogOut, Pencil, Plus,
 RefreshCw, Search, Shield, ShieldCheck, Trash2, UserCheck, UserPlus, Users, UserX, Wand2, X,
} from 'lucide-react';
import { useAuth } from './AuthGate';

// ---------------------------------------------------------------------------
// Types & API
// ---------------------------------------------------------------------------

type Lang = 'el' | 'en';
type AdminUser = { id: number; email: string; name: string; provider: string; role: string; disabled: boolean; created_at: number; last_login: number | null; updated_at: number | null };
type Role = { name: string; label: string; description: string; permissions: string[]; builtin: boolean; locked: boolean; users: number };
type Permission = { name: string; group: 'studio' | 'admin'; en: string; el: string; description: string };
type Summary = { users: number; disabled: number; new_7d: number; active_7d: number; by_role: Record<string, number> };
type AuditEntry = { id: number; at: number; actor_id: number | null; actor_email: string | null; action: string; target_type: string | null; target_id: string | null; target_label: string | null; details: Record<string, any> };
type Flash = { kind: 'ok' | 'error'; text: string } | null;

const BASE = '/api/v1/admin';

async function call<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
 const r = await fetch(BASE + path, {
  method, credentials: 'same-origin',
  headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
  body: body !== undefined ? JSON.stringify(body) : undefined,
 });
 if (!r.ok) {
  const text = await r.text();
  let message = text.slice(0, 240) || `HTTP ${r.status}`;
  try {
   const d = JSON.parse(text).detail;
   if (typeof d === 'string') message = d;
   else if (Array.isArray(d)) message = d.map((x: any) => `${(x.loc || []).slice(1).join('.') || 'field'}: ${x.msg}`).join('; ');
  } catch { /* not JSON */ }
  throw new Error(message);
 }
 return (r.status === 204 ? null : r.json()) as T;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const initials = (u: { name: string; email: string }) => (u.name || u.email).split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('');

function relative(ts: number | null, lang: Lang) {
 if (!ts) return lang === 'el' ? 'Ποτέ' : 'Never';
 const diff = Date.now() / 1000 - ts;
 const rtf = new Intl.RelativeTimeFormat(lang === 'el' ? 'el' : 'en', { numeric: 'auto' });
 if (diff < 60) return rtf.format(0, 'second');
 if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
 if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
 if (diff < 30 * 86400) return rtf.format(-Math.round(diff / 86400), 'day');
 return new Date(ts * 1000).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB');
}
const fullDate = (ts: number | null, lang: Lang) => (ts ? new Date(ts * 1000).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB') : '—');

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Modal({ title, icon, onClose, children, footer, wide }: { title: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
 useEffect(() => {
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
 }, [onClose]);
 return (
  <div className="adm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
   <div className={'adm-modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
    <div className="adm-modal-head">{icon}<h3>{title}</h3><button className="adm-icon" aria-label="Close" onClick={onClose}><X size={16} /></button></div>
    <div className="adm-modal-body">{children}</div>
    {footer && <div className="adm-modal-foot">{footer}</div>}
   </div>
  </div>
 );
}

function CopyField({ value, label }: { value: string; label: string }) {
 const [copied, setCopied] = useState(false);
 return (
  <div className="adm-secret">
   <span>{label}</span>
   <div><code>{value}</code>
    <button type="button" onClick={() => { void navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>
     {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}
    </button>
   </div>
  </div>
 );
}

const RoleBadge = ({ role, roles }: { role: string; roles: Role[] }) => (
 <span className={'adm-role ' + (['superadmin', 'admin', 'user'].includes(role) ? role : 'custom')}>
  {role === 'superadmin' ? <ShieldCheck size={12} /> : role === 'admin' ? <Shield size={12} /> : null}
  {roles.find((r) => r.name === role)?.label || role}
 </span>
);

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function AdminPanel({ lang }: { lang: Lang }) {
 const el = lang === 'el';
 const t = (en: string, gr: string) => (el ? gr : en);
 const { user: me, can, refresh: refreshMe } = useAuth();
 const tabs = [
  can('users.view') && { id: 'users', label: t('Users', 'Χρήστες'), icon: <Users size={15} /> },
  can('users.view') && { id: 'roles', label: t('Roles & permissions', 'Ρόλοι & δικαιώματα'), icon: <Shield size={15} /> },
  can('audit.view') && { id: 'activity', label: t('Activity', 'Ιστορικό'), icon: <History size={15} /> },
 ].filter(Boolean) as { id: string; label: string; icon: React.ReactNode }[];
 const [tab, setTab] = useState(tabs[0]?.id || 'users');
 const [users, setUsers] = useState<AdminUser[]>([]);
 const [roles, setRoles] = useState<Role[]>([]);
 const [perms, setPerms] = useState<Permission[]>([]);
 const [summary, setSummary] = useState<Summary | null>(null);
 const [flash, setFlash] = useState<Flash>(null);
 const [loading, setLoading] = useState(true);

 const ok = (text: string) => setFlash({ kind: 'ok', text });
 const fail = (e: unknown) => setFlash({ kind: 'error', text: errText(e) });

 const load = useCallback(async () => {
  if (!can('users.view')) { setLoading(false); return; }
  try {
   const [u, r, p, s] = await Promise.all([call('/users'), call('/roles'), call('/permissions'), call('/summary')]);
   setUsers(u.users); setRoles(r.roles); setPerms(p.permissions); setSummary(s);
  } catch (e) { fail(e); } finally { setLoading(false); }
 }, [can]);
 useEffect(() => { void load(); }, [load]);

 // Run an admin mutation, then reload data (and our own session, in case we changed ourselves).
 const mutate: Mutate = async <T,>(fn: () => Promise<T>, success: string) => {
  try { const result = await fn(); ok(success); await Promise.all([load(), refreshMe()]); return result; } catch (e) { fail(e); return undefined; }
 };

 if (!tabs.length) return <section className="panel"><p className="empty">{t('You do not have access to administration.', 'Δεν έχετε πρόσβαση στη διαχείριση.')}</p></section>;

 return (
  <div className="adm">
   {summary && (
    <div className="adm-stats">
     <div><Users size={18} /><b>{summary.users}</b><span>{t('Total users', 'Σύνολο χρηστών')}</span></div>
     <div><UserCheck size={18} /><b>{summary.active_7d}</b><span>{t('Signed in · 7 days', 'Σύνδεση · 7 ημέρες')}</span></div>
     <div><UserPlus size={18} /><b>{summary.new_7d}</b><span>{t('New · 7 days', 'Νέοι · 7 ημέρες')}</span></div>
     <div className={summary.disabled ? 'warn' : ''}><UserX size={18} /><b>{summary.disabled}</b><span>{t('Disabled', 'Απενεργοποιημένοι')}</span></div>
    </div>
   )}

   <div className="adm-tabs" role="tablist">
    {tabs.map((x) => <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>{x.icon}{x.label}</button>)}
    <button className="adm-refresh" title={t('Refresh', 'Ανανέωση')} aria-label={t('Refresh', 'Ανανέωση')} onClick={() => { setFlash(null); void load(); }}><RefreshCw size={15} /></button>
   </div>

   {flash && <div className={'adm-flash ' + flash.kind} role={flash.kind === 'error' ? 'alert' : 'status'}>{flash.kind === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}<span>{flash.text}</span><button aria-label="Dismiss" onClick={() => setFlash(null)}><X size={14} /></button></div>}

   {loading ? <section className="panel"><p className="empty">{t('Loading…', 'Φόρτωση…')}</p></section> :
    tab === 'users' ? <UsersTab {...{ lang, t, me: me!, can, users, roles, mutate }} /> :
    tab === 'roles' ? <RolesTab {...{ lang, t, me: me!, can, roles, perms, mutate }} /> :
    <ActivityTab {...{ lang, t, roles }} />}
  </div>
 );
}

type Ctx = { lang: Lang; t: (en: string, gr: string) => string };
type Mutate = <T>(fn: () => Promise<T>, success: string) => Promise<T | undefined>;
type Me = NonNullable<ReturnType<typeof useAuth>['user']>;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

type UserDialog =
 | { kind: 'create' } | { kind: 'edit'; user: AdminUser } | { kind: 'password'; user: AdminUser }
 | { kind: 'delete'; user: AdminUser } | { kind: 'revoke'; user: AdminUser }
 | { kind: 'secret'; title: string; email: string; password: string };

function UsersTab({ lang, t, me, can, users, roles, mutate }: Ctx & { me: Me; can: (p: string) => boolean; users: AdminUser[]; roles: Role[]; mutate: Mutate }) {
 const [q, setQ] = useState('');
 const [roleFilter, setRoleFilter] = useState('');
 const [status, setStatus] = useState('');
 const [dialog, setDialog] = useState<UserDialog | null>(null);
 const manage = can('users.manage');
 const isSuper = me.role === 'superadmin';

 const shown = useMemo(() => users.filter((u) =>
  (!q || (u.name + ' ' + u.email).toLowerCase().includes(q.toLowerCase())) &&
  (!roleFilter || u.role === roleFilter) &&
  (!status || (status === 'disabled') === u.disabled)), [users, q, roleFilter, status]);

 // Mirrors the backend rules so the UI does not offer actions that will be refused.
 const canTouch = (u: AdminUser) => manage && (u.role !== 'superadmin' || isSuper);
 const providerLabel = (p: string) => (p === 'password' ? t('Email & password', 'Email & κωδικός') : p === 'google' ? 'Google' : p === 'github' ? 'GitHub' : p);

 return (
  <section className="panel adm-panel">
   <div className="adm-toolbar">
    <label className="adm-search"><Search size={15} /><input placeholder={t('Search name or email…', 'Αναζήτηση ονόματος ή email…')} value={q} onChange={(e) => setQ(e.target.value)} /></label>
    <select className="adm-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label={t('Role', 'Ρόλος')}>
     <option value="">{t('All roles', 'Όλοι οι ρόλοι')}</option>
     {roles.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
    </select>
    <select className="adm-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('Status', 'Κατάσταση')}>
     <option value="">{t('All statuses', 'Όλες οι καταστάσεις')}</option>
     <option value="active">{t('Active', 'Ενεργοί')}</option>
     <option value="disabled">{t('Disabled', 'Απενεργοποιημένοι')}</option>
    </select>
    {manage && <button className="primary adm-new" onClick={() => setDialog({ kind: 'create' })}><UserPlus size={16} />{t('New user', 'Νέος χρήστης')}</button>}
   </div>

   <div className="tablewrap">
    <table className="adm-table">
     <thead><tr><th>{t('User', 'Χρήστης')}</th><th>{t('Role', 'Ρόλος')}</th><th>{t('Sign-in method', 'Τρόπος σύνδεσης')}</th><th>{t('Status', 'Κατάσταση')}</th><th>{t('Last sign-in', 'Τελευταία σύνδεση')}</th><th>{t('Created', 'Δημιουργία')}</th><th /></tr></thead>
     <tbody>
      {shown.map((u) => {
       const self = u.id === me.id;
       return (
        <tr key={u.id} className={u.disabled ? 'off' : ''}>
         <td><div className="adm-user"><span className="adm-avatar">{initials(u)}</span><div><b>{u.name}{self && <em className="adm-you">{t('you', 'εσείς')}</em>}</b><small>{u.email}</small></div></div></td>
         <td><RoleBadge role={u.role} roles={roles} /></td>
         <td className="adm-muted">{providerLabel(u.provider)}</td>
         <td><span className={'adm-status ' + (u.disabled ? 'off' : 'on')}>{u.disabled ? t('Disabled', 'Ανενεργός') : t('Active', 'Ενεργός')}</span></td>
         <td className="adm-muted" title={fullDate(u.last_login, lang)}>{relative(u.last_login, lang)}</td>
         <td className="adm-muted" title={fullDate(u.created_at, lang)}>{relative(u.created_at, lang)}</td>
         <td>
          {canTouch(u) && (
           <div className="adm-actions">
            <button className="adm-icon" title={t('Edit', 'Επεξεργασία')} aria-label={t('Edit', 'Επεξεργασία')} onClick={() => setDialog({ kind: 'edit', user: u })}><Pencil size={14} /></button>
            {u.provider === 'password' && <button className="adm-icon" title={t('Reset password', 'Επαναφορά κωδικού')} aria-label={t('Reset password', 'Επαναφορά κωδικού')} onClick={() => setDialog({ kind: 'password', user: u })}><KeyRound size={14} /></button>}
            <button className="adm-icon" title={t('Sign out everywhere', 'Αποσύνδεση παντού')} aria-label={t('Sign out everywhere', 'Αποσύνδεση παντού')} onClick={() => setDialog({ kind: 'revoke', user: u })}><LogOut size={14} /></button>
            {!self && (u.disabled
             ? <button className="adm-icon" title={t('Enable', 'Ενεργοποίηση')} aria-label={t('Enable', 'Ενεργοποίηση')} onClick={() => void mutate(() => call(`/users/${u.id}`, 'PATCH', { disabled: false }), t(`${u.email} enabled.`, `Ο ${u.email} ενεργοποιήθηκε.`))}><UserCheck size={14} /></button>
             : <button className="adm-icon warn" title={t('Disable', 'Απενεργοποίηση')} aria-label={t('Disable', 'Απενεργοποίηση')} onClick={() => void mutate(() => call(`/users/${u.id}`, 'PATCH', { disabled: true }), t(`${u.email} disabled and signed out.`, `Ο ${u.email} απενεργοποιήθηκε.`))}><Ban size={14} /></button>)}
            {!self && <button className="adm-icon danger" title={t('Delete', 'Διαγραφή')} aria-label={t('Delete', 'Διαγραφή')} onClick={() => setDialog({ kind: 'delete', user: u })}><Trash2 size={14} /></button>}
           </div>
          )}
         </td>
        </tr>
       );
      })}
     </tbody>
    </table>
    {!shown.length && <p className="empty">{t('No users match these filters.', 'Κανένας χρήστης δεν ταιριάζει στα φίλτρα.')}</p>}
   </div>
   <p className="hint adm-count">{t(`Showing ${shown.length} of ${users.length} users`, `Εμφάνιση ${shown.length} από ${users.length} χρήστες`)}</p>

   {dialog?.kind === 'create' && <UserForm {...{ lang, t, me, can, roles }} onClose={() => setDialog(null)} onSubmit={async (v) => {
    const result = await mutate(() => call<AdminUser & { generated_password?: string }>('/users', 'POST', v), t(`User ${v.email} created.`, `Ο χρήστης ${v.email} δημιουργήθηκε.`));
    if (result) setDialog(result.generated_password ? { kind: 'secret', title: t('User created', 'Ο χρήστης δημιουργήθηκε'), email: result.email, password: result.generated_password } : null);
   }} />}
   {dialog?.kind === 'edit' && <UserForm {...{ lang, t, me, can, roles }} user={dialog.user} onClose={() => setDialog(null)} onSubmit={async (v) => {
    const u = dialog.user;
    const patch: Record<string, unknown> = {};
    if (v.name !== u.name) patch.name = v.name;
    if (v.email !== u.email) patch.email = v.email;
    if (v.role !== u.role) patch.role = v.role;
    if (v.disabled !== u.disabled) patch.disabled = v.disabled;
    if (!Object.keys(patch).length) { setDialog(null); return; }
    if (await mutate(() => call(`/users/${u.id}`, 'PATCH', patch), t('Changes saved.', 'Οι αλλαγές αποθηκεύτηκαν.'))) setDialog(null);
   }} />}
   {dialog?.kind === 'password' && <PasswordDialog {...{ lang, t }} user={dialog.user} onClose={() => setDialog(null)} onSubmit={async (password) => {
    const u = dialog.user;
    const r = await mutate(() => call<{ generated_password?: string }>(`/users/${u.id}/password`, 'POST', password ? { password } : {}), t(`Password reset for ${u.email}; their sessions were signed out.`, `Ο κωδικός του ${u.email} άλλαξε.`));
    if (r) setDialog(r.generated_password ? { kind: 'secret', title: t('New password', 'Νέος κωδικός'), email: u.email, password: r.generated_password } : null);
   }} />}
   {dialog?.kind === 'revoke' && <Confirm {...{ t }} title={t('Sign out everywhere', 'Αποσύνδεση παντού')} icon={<LogOut size={18} />} confirm={t('Sign out', 'Αποσύνδεση')}
    onClose={() => setDialog(null)} onConfirm={async () => { if (await mutate(() => call(`/users/${dialog.user.id}/revoke-sessions`, 'POST'), t(`${dialog.user.email} was signed out of all sessions.`, `Ο ${dialog.user.email} αποσυνδέθηκε.`)) !== undefined) setDialog(null); }}>
    <p>{dialog.user.id === me.id
     ? t('This ends every session for your account, including this one. You will need to sign in again.', 'Τερματίζει όλες τις συνεδρίες σας, και αυτήν. Θα χρειαστεί να συνδεθείτε ξανά.')
     : t(`Ends every active session for ${dialog.user.email}. They can sign in again with their credentials.`, `Τερματίζει όλες τις συνεδρίες του ${dialog.user.email}.`)}</p>
   </Confirm>}
   {dialog?.kind === 'delete' && <DeleteDialog {...{ t }} user={dialog.user} onClose={() => setDialog(null)} onConfirm={async () => { if (await mutate(() => call(`/users/${dialog.user.id}`, 'DELETE'), t(`${dialog.user.email} deleted.`, `Ο ${dialog.user.email} διαγράφηκε.`)) !== undefined) setDialog(null); }} />}
   {dialog?.kind === 'secret' && <Modal title={dialog.title} icon={<KeyRound size={18} />} onClose={() => setDialog(null)} footer={<button className="primary" onClick={() => setDialog(null)}>{t('Done', 'Τέλος')}</button>}>
    <p className="adm-note"><AlertTriangle size={15} />{t('This password is shown only once. Share it securely and ask the user to keep it safe.', 'Ο κωδικός εμφανίζεται μόνο μία φορά. Μοιραστείτε τον με ασφάλεια.')}</p>
    <CopyField label="Email" value={dialog.email} />
    <CopyField label={t('Password', 'Κωδικός')} value={dialog.password} />
   </Modal>}
  </section>
 );
}

function UserForm({ t, me, can, roles, user, onClose, onSubmit }: Ctx & { me: Me; can: (p: string) => boolean; roles: Role[]; user?: AdminUser; onClose: () => void; onSubmit: (v: { name: string; email: string; role: string; disabled: boolean; password?: string }) => Promise<void> }) {
 const [name, setName] = useState(user?.name || '');
 const [email, setEmail] = useState(user?.email || '');
 const [role, setRole] = useState(user?.role || 'user');
 const [disabled, setDisabled] = useState(user?.disabled || false);
 const [mode, setMode] = useState<'generate' | 'manual'>('generate');
 const [password, setPassword] = useState('');
 const [busy, setBusy] = useState(false);
 const self = user?.id === me.id;
 const mine = new Set(me.permissions || []);
 // A role is grantable only if its permissions are a subset of ours (superadmin only by superadmins).
 const grantable = (r: Role) => r.permissions.every((p) => mine.has(p)) && (r.name !== 'superadmin' || me.role === 'superadmin');
 const roleLocked = !can('roles.manage') || self;
 const emailLocked = !!user && user.provider !== 'password';
 const invalid = !name.trim() || !/^\S+@\S+\.\S+$/.test(email) || (!user && mode === 'manual' && password.length < 12);

 return (
  <Modal title={user ? t('Edit user', 'Επεξεργασία χρήστη') : t('New user', 'Νέος χρήστης')} icon={user ? <Pencil size={18} /> : <UserPlus size={18} />} onClose={onClose}
   footer={<><button onClick={onClose}>{t('Cancel', 'Ακύρωση')}</button><button className="primary" disabled={invalid || busy} onClick={async () => { setBusy(true); await onSubmit({ name: name.trim(), email: email.trim().toLowerCase(), role, disabled, ...(mode === 'manual' && !user ? { password } : {}) }); setBusy(false); }}>{busy ? t('Saving…', 'Αποθήκευση…') : user ? t('Save changes', 'Αποθήκευση') : t('Create user', 'Δημιουργία')}</button></>}>
   <label className="adm-field">{t('Full name', 'Ονοματεπώνυμο')}<input autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></label>
   <label className="adm-field">Email<input type="email" value={email} disabled={emailLocked} onChange={(e) => setEmail(e.target.value)} />
    {emailLocked && <small>{t(`Signs in with ${user!.provider}; the email comes from that provider.`, `Σύνδεση μέσω ${user!.provider}· το email δεν αλλάζει.`)}</small>}</label>
   <label className="adm-field">{t('Role', 'Ρόλος')}
    <select className="adm-select" value={role} disabled={roleLocked} onChange={(e) => setRole(e.target.value)}>
     {roles.map((r) => <option key={r.name} value={r.name} disabled={!grantable(r) && r.name !== user?.role}>{r.label}{!grantable(r) ? ` (${t('not grantable', 'μη διαθέσιμος')})` : ''}</option>)}
    </select>
    {roleLocked && <small>{self ? t('You cannot change your own role.', 'Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο.') : t('Changing roles requires the “Manage roles” permission.', 'Απαιτείται το δικαίωμα «Διαχείριση ρόλων».')}</small>}
    {!roleLocked && <small>{roles.find((r) => r.name === role)?.description}</small>}
   </label>
   {user && !self && (
    <label className="adm-switch"><input type="checkbox" checked={!disabled} onChange={(e) => setDisabled(!e.target.checked)} /><span />{disabled ? t('Account disabled — cannot sign in', 'Ο λογαριασμός είναι απενεργοποιημένος') : t('Account active', 'Ενεργός λογαριασμός')}</label>
   )}
   {!user && (
    <div className="adm-field">{t('Initial password', 'Αρχικός κωδικός')}
     <div className="adm-seg">
      <button type="button" className={mode === 'generate' ? 'on' : ''} onClick={() => setMode('generate')}><Wand2 size={14} />{t('Generate', 'Αυτόματα')}</button>
      <button type="button" className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><KeyRound size={14} />{t('Set manually', 'Χειροκίνητα')}</button>
     </div>
     {mode === 'manual'
      ? <><input type="text" autoComplete="new-password" value={password} placeholder={t('At least 12 characters', 'Τουλάχιστον 12 χαρακτήρες')} onChange={(e) => setPassword(e.target.value)} /><small>{password.length}/12</small></>
      : <small>{t('A strong password is generated and shown once after creation.', 'Δημιουργείται ισχυρός κωδικός που εμφανίζεται μία φορά.')}</small>}
    </div>
   )}
  </Modal>
 );
}

function PasswordDialog({ t, user, onClose, onSubmit }: Ctx & { user: AdminUser; onClose: () => void; onSubmit: (password: string) => Promise<void> }) {
 const [mode, setMode] = useState<'generate' | 'manual'>('generate');
 const [password, setPassword] = useState('');
 const [busy, setBusy] = useState(false);
 return (
  <Modal title={t('Reset password', 'Επαναφορά κωδικού')} icon={<KeyRound size={18} />} onClose={onClose}
   footer={<><button onClick={onClose}>{t('Cancel', 'Ακύρωση')}</button><button className="primary" disabled={busy || (mode === 'manual' && password.length < 12)} onClick={async () => { setBusy(true); await onSubmit(mode === 'manual' ? password : ''); setBusy(false); }}>{t('Reset password', 'Επαναφορά')}</button></>}>
   <p>{t(`Set a new password for ${user.email}. All of their current sessions will be signed out.`, `Ορίστε νέο κωδικό για ${user.email}. Όλες οι συνεδρίες του θα τερματιστούν.`)}</p>
   <div className="adm-seg">
    <button type="button" className={mode === 'generate' ? 'on' : ''} onClick={() => setMode('generate')}><Wand2 size={14} />{t('Generate', 'Αυτόματα')}</button>
    <button type="button" className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><KeyRound size={14} />{t('Set manually', 'Χειροκίνητα')}</button>
   </div>
   {mode === 'manual' && <label className="adm-field">{t('New password', 'Νέος κωδικός')}<input autoFocus type="text" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><small>{password.length}/12</small></label>}
  </Modal>
 );
}

function Confirm({ t, title, icon, confirm, danger, children, onClose, onConfirm, disabled }: { t: Ctx['t']; title: string; icon: React.ReactNode; confirm: string; danger?: boolean; children: React.ReactNode; onClose: () => void; onConfirm: () => Promise<void>; disabled?: boolean }) {
 const [busy, setBusy] = useState(false);
 return (
  <Modal title={title} icon={icon} onClose={onClose}
   footer={<><button onClick={onClose}>{t('Cancel', 'Ακύρωση')}</button><button className={danger ? 'adm-danger-btn' : 'primary'} disabled={busy || disabled} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}>{confirm}</button></>}>
   {children}
  </Modal>
 );
}

function DeleteDialog({ t, user, onClose, onConfirm }: { t: Ctx['t']; user: AdminUser; onClose: () => void; onConfirm: () => Promise<void> }) {
 const [typed, setTyped] = useState('');
 return (
  <Confirm {...{ t, onClose, onConfirm }} danger title={t('Delete user', 'Διαγραφή χρήστη')} icon={<Trash2 size={18} />} confirm={t('Delete permanently', 'Οριστική διαγραφή')} disabled={typed.trim().toLowerCase() !== user.email}>
   <p className="adm-note danger"><AlertTriangle size={15} />{t('This permanently deletes the account and all of its songs, recordings, libraries and trained models. It cannot be undone. Consider disabling the account instead.', 'Διαγράφει οριστικά τον λογαριασμό και όλες τις συνθέσεις, ηχογραφήσεις, βιβλιοθήκες και μοντέλα του. Δεν αναιρείται. Εξετάστε την απενεργοποίηση.')}</p>
   <label className="adm-field">{t(`Type ${user.email} to confirm`, `Πληκτρολογήστε ${user.email} για επιβεβαίωση`)}<input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} /></label>
  </Confirm>
 );
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

function RolesTab({ lang, t, me, can, roles, perms, mutate }: Ctx & { me: Me; can: (p: string) => boolean; roles: Role[]; perms: Permission[]; mutate: Mutate }) {
 const [editing, setEditing] = useState<Role | 'new' | null>(null);
 const [deleting, setDeleting] = useState<Role | null>(null);
 const manage = can('roles.manage');
 const label = (p: Permission) => (lang === 'el' ? p.el : p.en);
 const groups: [Permission['group'], string][] = [['studio', t('Studio', 'Στούντιο')], ['admin', t('Administration', 'Διαχείριση')]];

 return (
  <>
   <section className="panel adm-panel">
    <div className="adm-toolbar">
     <p className="adm-intro">{t('Roles bundle permissions. Every user has exactly one role; new sign-ups get “User”.', 'Οι ρόλοι ομαδοποιούν δικαιώματα. Κάθε χρήστης έχει έναν ρόλο· οι νέοι λογαριασμοί παίρνουν «User».')}</p>
     {manage && <button className="primary adm-new" onClick={() => setEditing('new')}><Plus size={16} />{t('New role', 'Νέος ρόλος')}</button>}
    </div>
    <div className="adm-roles">
     {roles.map((r) => (
      <article key={r.name} className={'adm-rolecard ' + (['superadmin', 'admin', 'user'].includes(r.name) ? r.name : 'custom')}>
       <header>
        <div><h4>{r.label}</h4><code>{r.name}</code></div>
        <div className="adm-rolemeta">
         {r.locked ? <span className="adm-chip"><Lock size={11} />{t('Locked', 'Κλειδωμένος')}</span> : r.builtin ? <span className="adm-chip">{t('Built-in', 'Ενσωματωμένος')}</span> : <span className="adm-chip custom">{t('Custom', 'Προσαρμοσμένος')}</span>}
         <span className="adm-chip"><Users size={11} />{r.users}</span>
        </div>
       </header>
       <p>{r.description || t('No description.', 'Χωρίς περιγραφή.')}</p>
       {groups.map(([g, title]) => {
        const list = perms.filter((p) => p.group === g);
        return <div key={g} className="adm-permrow"><span>{title}</span><div>{list.map((p) => <span key={p.name} className={'adm-perm ' + (r.permissions.includes(p.name) ? 'yes' : 'no')} title={p.description}>{r.permissions.includes(p.name) ? <Check size={11} /> : <X size={11} />}{label(p)}</span>)}</div></div>;
       })}
       {manage && !r.locked && (
        <footer>
         <button onClick={() => setEditing(r)}><Pencil size={14} />{t('Edit', 'Επεξεργασία')}</button>
         {!r.builtin && <button className="adm-icon danger" disabled={r.users > 0} title={r.users ? t('Reassign its users first', 'Αλλάξτε πρώτα τον ρόλο των χρηστών του') : t('Delete role', 'Διαγραφή ρόλου')} aria-label={t('Delete role', 'Διαγραφή ρόλου')} onClick={() => setDeleting(r)}><Trash2 size={14} /></button>}
        </footer>
       )}
      </article>
     ))}
    </div>
   </section>

   <section className="panel adm-panel">
    <div className="sectiontitle"><h3>{t('Permission matrix', 'Πίνακας δικαιωμάτων')}</h3><span>{perms.length} {t('PERMISSIONS', 'ΔΙΚΑΙΩΜΑΤΑ')}</span></div>
    <div className="tablewrap">
     <table className="adm-matrix">
      <thead><tr><th>{t('Permission', 'Δικαίωμα')}</th>{roles.map((r) => <th key={r.name}>{r.label}</th>)}</tr></thead>
      <tbody>{perms.map((p) => <tr key={p.name}><td><b>{label(p)}</b><small>{p.description}</small></td>{roles.map((r) => <td key={r.name}>{r.permissions.includes(p.name) ? <Check size={15} className="yes" /> : <span className="no">—</span>}</td>)}</tr>)}</tbody>
     </table>
    </div>
   </section>

   {editing && <RoleForm {...{ lang, t, me, perms }} role={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSubmit={async (v) => {
    const done = editing === 'new'
     ? await mutate(() => call('/roles', 'POST', v), t(`Role “${v.label}” created.`, `Ο ρόλος «${v.label}» δημιουργήθηκε.`))
     : await mutate(() => call(`/roles/${editing.name}`, 'PATCH', { label: v.label, description: v.description, permissions: v.permissions }), t(`Role “${v.label}” updated.`, `Ο ρόλος «${v.label}» ενημερώθηκε.`));
    if (done) setEditing(null);
   }} />}
   {deleting && <Confirm {...{ t }} danger title={t('Delete role', 'Διαγραφή ρόλου')} icon={<Trash2 size={18} />} confirm={t('Delete role', 'Διαγραφή')} onClose={() => setDeleting(null)}
    onConfirm={async () => { if (await mutate(() => call(`/roles/${deleting.name}`, 'DELETE'), t(`Role “${deleting.label}” deleted.`, `Ο ρόλος «${deleting.label}» διαγράφηκε.`)) !== undefined) setDeleting(null); }}>
    <p>{t(`Delete the role “${deleting.label}”? No users currently have it.`, `Διαγραφή του ρόλου «${deleting.label}»;`)}</p>
   </Confirm>}
  </>
 );
}

function RoleForm({ lang, t, me, perms, role, onClose, onSubmit }: Ctx & { me: Me; perms: Permission[]; role?: Role; onClose: () => void; onSubmit: (v: { name: string; label: string; description: string; permissions: string[] }) => Promise<void> }) {
 const [label, setLabel] = useState(role?.label || '');
 const [name, setName] = useState(role?.name || '');
 const [nameTouched, setNameTouched] = useState(false);
 const [description, setDescription] = useState(role?.description || '');
 const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions || ['workspace.use']));
 const [busy, setBusy] = useState(false);
 const mine = new Set(me.permissions || []);
 const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^[^a-z]+/, '').slice(0, 32);
 const validName = /^[a-z][a-z0-9_-]{1,31}$/.test(name);
 const ownRoleLosesManage = role?.name === me.role && !selected.has('roles.manage');
 const toggle = (p: string) => setSelected((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
 const groups: [Permission['group'], string][] = [['studio', t('Studio features', 'Λειτουργίες στούντιο')], ['admin', t('Administration', 'Διαχείριση')]];

 return (
  <Modal wide title={role ? t(`Edit role · ${role.label}`, `Επεξεργασία ρόλου · ${role.label}`) : t('New role', 'Νέος ρόλος')} icon={<Shield size={18} />} onClose={onClose}
   footer={<><button onClick={onClose}>{t('Cancel', 'Ακύρωση')}</button><button className="primary" disabled={busy || !label.trim() || !validName || ownRoleLosesManage} onClick={async () => { setBusy(true); await onSubmit({ name, label: label.trim(), description: description.trim(), permissions: perms.filter((p) => selected.has(p.name)).map((p) => p.name) }); setBusy(false); }}>{role ? t('Save role', 'Αποθήκευση') : t('Create role', 'Δημιουργία')}</button></>}>
   <div className="adm-grid2">
    <label className="adm-field">{t('Display name', 'Όνομα')}<input autoFocus value={label} maxLength={60} onChange={(e) => { setLabel(e.target.value); if (!role && !nameTouched) setName(slug(e.target.value)); }} /></label>
    <label className="adm-field">{t('Role id', 'Αναγνωριστικό')}<input value={name} disabled={!!role} maxLength={32} onChange={(e) => { setNameTouched(true); setName(e.target.value.toLowerCase()); }} />
     <small>{role ? t('The id cannot be changed.', 'Δεν αλλάζει.') : validName ? t('Lowercase letters, digits, - and _.', 'Πεζά, ψηφία, - και _.') : <span className="adm-bad">{t('2–32 chars, start with a letter; a–z, 0–9, - or _.', '2–32 χαρακτήρες, ξεκινά με γράμμα.')}</span>}</small></label>
   </div>
   <label className="adm-field">{t('Description', 'Περιγραφή')}<input value={description} maxLength={240} onChange={(e) => setDescription(e.target.value)} placeholder={t('What is this role for?', 'Σε τι χρησιμεύει ο ρόλος;')} /></label>
   {groups.map(([g, title]) => (
    <fieldset key={g} className="adm-permset">
     <legend>{title}</legend>
     {perms.filter((p) => p.group === g).map((p) => {
      const locked = !mine.has(p.name);
      return (
       <label key={p.name} className={'adm-check' + (locked ? ' locked' : '')} title={locked ? t('You cannot grant a permission you do not hold.', 'Δεν μπορείτε να δώσετε δικαίωμα που δεν έχετε.') : ''}>
        <input type="checkbox" checked={selected.has(p.name)} disabled={locked} onChange={() => toggle(p.name)} />
        <span><b>{lang === 'el' ? p.el : p.en}</b><small>{p.description}</small></span>
        <code>{p.name}</code>
       </label>
      );
     })}
    </fieldset>
   ))}
   {ownRoleLosesManage && <p className="adm-note danger"><AlertTriangle size={15} />{t('This is your own role — removing “Manage roles” would lock you out of role management.', 'Είναι ο δικός σας ρόλος — δεν μπορείτε να αφαιρέσετε τη «Διαχείριση ρόλων».')}</p>}
  </Modal>
 );
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

const ACTIONS: Record<string, [string, string]> = {
 'auth.login': ['Signed in', 'Σύνδεση'], 'auth.login_failed': ['Failed sign-in', 'Αποτυχημένη σύνδεση'], 'auth.login_blocked': ['Blocked sign-in (disabled)', 'Μπλοκαρισμένη σύνδεση'],
 'auth.register': ['Registered', 'Εγγραφή'], 'user.create': ['Created user', 'Δημιουργία χρήστη'], 'user.update': ['Edited user', 'Επεξεργασία χρήστη'],
 'user.role': ['Changed role', 'Αλλαγή ρόλου'], 'user.disable': ['Disabled user', 'Απενεργοποίηση'], 'user.enable': ['Enabled user', 'Ενεργοποίηση'],
 'user.password_reset': ['Reset password', 'Επαναφορά κωδικού'], 'user.sessions_revoked': ['Signed out everywhere', 'Αποσύνδεση παντού'], 'user.delete': ['Deleted user', 'Διαγραφή χρήστη'],
 'role.create': ['Created role', 'Δημιουργία ρόλου'], 'role.update': ['Edited role', 'Επεξεργασία ρόλου'], 'role.delete': ['Deleted role', 'Διαγραφή ρόλου'],
};

function ActivityTab({ lang, t }: Ctx & { roles: Role[] }) {
 const [entries, setEntries] = useState<AuditEntry[]>([]);
 const [total, setTotal] = useState(0);
 const [q, setQ] = useState('');
 const [action, setAction] = useState('');
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 const PAGE = 50;

 const load = useCallback(async (offset: number) => {
  setLoading(true); setError('');
  try {
   const params = new URLSearchParams({ q, action, limit: String(PAGE), offset: String(offset) });
   const r = await call<{ total: number; entries: AuditEntry[] }>('/audit?' + params);
   setTotal(r.total); setEntries((prev) => (offset ? [...prev, ...r.entries] : r.entries));
  } catch (e) { setError(errText(e)); } finally { setLoading(false); }
 }, [q, action]);
 useEffect(() => { const h = setTimeout(() => void load(0), 250); return () => clearTimeout(h); }, [load]);

 const describe = (e: AuditEntry) => {
  const d = e.details || {};
  if (d.role && typeof d.role === 'object') return `${d.role.from} → ${d.role.to}`;
  if (e.action === 'user.create') return `${t('role', 'ρόλος')}: ${d.role}`;
  if (d.method) return d.method;
  if (d.permissions) return `${d.permissions.length} ${t('permissions', 'δικαιώματα')}`;
  if (d.workspace_items !== undefined) return `${d.workspace_items} ${t('workspace items removed', 'στοιχεία διαγράφηκαν')}`;
  if (d.name) return `${t('name', 'όνομα')} → ${d.name}`;
  if (d.email) return `email → ${d.email}`;
  if (d.generated) return t('generated password', 'αυτόματος κωδικός');
  return '';
 };
 const tone = (a: string) => (a.endsWith('failed') || a.endsWith('blocked') || a.endsWith('delete') || a === 'user.disable' ? 'bad' : a.startsWith('auth.') ? 'auth' : a.startsWith('role.') ? 'role' : 'user');

 return (
  <section className="panel adm-panel">
   <div className="adm-toolbar">
    <label className="adm-search"><Search size={15} /><input placeholder={t('Search actor or target email…', 'Αναζήτηση email…')} value={q} onChange={(e) => setQ(e.target.value)} /></label>
    <select className="adm-select" value={action} onChange={(e) => setAction(e.target.value)} aria-label={t('Event type', 'Τύπος')}>
     <option value="">{t('All events', 'Όλα τα συμβάντα')}</option>
     <option value="auth.">{t('Sign-ins', 'Συνδέσεις')}</option>
     <option value="auth.login_failed">{t('Failed sign-ins', 'Αποτυχημένες συνδέσεις')}</option>
     <option value="user.">{t('User changes', 'Αλλαγές χρηστών')}</option>
     <option value="role.">{t('Role changes', 'Αλλαγές ρόλων')}</option>
    </select>
   </div>
   {error && <p className="adm-note danger"><AlertTriangle size={15} />{error}</p>}
   <div className="tablewrap">
    <table className="adm-table adm-log">
     <thead><tr><th>{t('When', 'Πότε')}</th><th>{t('Event', 'Συμβάν')}</th><th>{t('By', 'Από')}</th><th>{t('Target', 'Στόχος')}</th><th>{t('Details', 'Λεπτομέρειες')}</th></tr></thead>
     <tbody>{entries.map((e) => (
      <tr key={e.id}>
       <td className="adm-muted" title={fullDate(e.at, lang)}>{relative(e.at, lang)}</td>
       <td><span className={'adm-event ' + tone(e.action)}><Activity size={12} />{ACTIONS[e.action]?.[lang === 'el' ? 1 : 0] || e.action}</span></td>
       <td>{e.actor_email || <span className="adm-muted">—</span>}</td>
       <td>{e.target_label || <span className="adm-muted">—</span>}</td>
       <td className="adm-muted">{describe(e)}</td>
      </tr>
     ))}</tbody>
    </table>
    {!entries.length && !loading && <p className="empty">{t('No activity matches these filters.', 'Δεν βρέθηκε δραστηριότητα.')}</p>}
   </div>
   <div className="adm-more">
    <span className="hint">{t(`${entries.length} of ${total} events`, `${entries.length} από ${total} συμβάντα`)}</span>
    {entries.length < total && <button disabled={loading} onClick={() => void load(entries.length)}>{loading ? t('Loading…', 'Φόρτωση…') : t('Load more', 'Περισσότερα')}</button>}
   </div>
  </section>
 );
}
