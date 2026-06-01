import {
  Check,
  CheckCircle2,
  ClipboardCopy,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  Shield,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  changePassword,
  fetchFullProfile,
  updateProfileEmail,
  type FullProfile,
} from '@/services/api';

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 border border-purple-200',
  OPS_ADMIN:   'bg-blue-100 text-blue-700 border border-blue-200',
  CLIENT_OWNER:'bg-amber-100 text-amber-700 border border-amber-200',
  GUARDIAN:    'bg-green-100 text-green-700 border border-green-200',
};

function roleLabel(r: string) {
  return r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncateId(id: string) {
  return `${id.slice(0, 8)}···${id.slice(-4)}`;
}

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Email edit
  const [emailValue, setEmailValue] = useState('');
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Password change
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Copy ID
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchFullProfile()
      .then((data) => {
        setProfile(data);
        setEmailValue(data.email ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveEmail() {
    if (!emailValue.trim()) return;
    setEmailSaving(true);
    setEmailMsg(null);
    try {
      await updateProfileEmail(emailValue.trim());
      setProfile((prev) => (prev ? { ...prev, email: emailValue.trim() } : prev));
      setEmailEditing(false);
      setEmailMsg({ text: 'Email updated.', ok: true });
      setTimeout(() => setEmailMsg(null), 3000);
    } catch (err) {
      setEmailMsg({ text: err instanceof Error ? err.message : 'Update failed.', ok: false });
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 8) {
      setPwMsg({ text: 'Password must be at least 8 characters.', ok: false });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ text: 'Passwords do not match.', ok: false });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await changePassword(newPw, confirmPw);
      setNewPw('');
      setConfirmPw('');
      setPwMsg({ text: 'Password updated successfully.', ok: true });
      setTimeout(() => setPwMsg(null), 4000);
    } catch (err) {
      setPwMsg({ text: err instanceof Error ? err.message : 'Password change failed.', ok: false });
    } finally {
      setPwSaving(false);
    }
  }

  function copyId() {
    if (!profile) return;
    void navigator.clipboard.writeText(profile.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">

      {/* ── Banner header ── */}
      <div className="relative bg-[#0D1117] px-8 pt-10 pb-8 shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-green-600 flex items-center justify-center text-white text-xl font-bold ring-4 ring-green-500/20 shrink-0 select-none">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <h1 className="text-white text-xl font-bold tracking-tight">
                {user?.name ?? profile?.phone ?? 'Admin'}
              </h1>
              {profile?.roles.map((r) => (
                <span
                  key={r}
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[11px] font-semibold',
                    ROLE_BADGE[r] ?? 'bg-slate-700 text-slate-300 border border-slate-600',
                  )}
                >
                  {roleLabel(r)}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Phone className="w-3 h-3" />
                {profile?.phone}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    profile?.status === 'ACTIVE' ? 'bg-green-400' : 'bg-red-400',
                  )}
                />
                <span className={profile?.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}>
                  {profile?.status === 'ACTIVE' ? 'Active' : (profile?.status ?? '—')}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-6 space-y-4 max-w-5xl w-full">

        <div className="grid grid-cols-2 gap-4">

          {/* ── Contact ── */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <User className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Contact information</h2>
            </div>
            <div className="p-5 space-y-5">

              {/* Phone — read-only */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                  Phone · Rwanda
                </p>
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-800 font-medium flex-1">{profile?.phone}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                    read-only
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                  Phone is your identity in the auth system and cannot be changed here.
                </p>
              </div>

              {/* Email — inline edit */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Email address
                  </p>
                  {!emailEditing && (
                    <button
                      type="button"
                      onClick={() => setEmailEditing(true)}
                      className="text-xs text-green-600 hover:text-green-700 font-semibold transition-colors cursor-pointer"
                    >
                      {profile?.email ? 'Edit' : '+ Add'}
                    </button>
                  )}
                </div>

                {emailEditing ? (
                  <div className="space-y-2">
                    <input
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      type="email"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      placeholder="admin@example.com"
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEmail}
                        disabled={emailSaving || !emailValue.trim()}
                        className="flex-1 py-2 text-xs font-semibold bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer"
                      >
                        {emailSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEmailEditing(false); setEmailValue(profile?.email ?? ''); }}
                        className="px-4 py-2 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {profile?.email
                      ? <span className="text-sm text-slate-800">{profile.email}</span>
                      : <span className="text-sm text-slate-400 italic">Not set</span>}
                  </div>
                )}

                {emailMsg && (
                  <p className={cn('text-xs mt-2', emailMsg.ok ? 'text-green-600' : 'text-red-500')}>
                    {emailMsg.text}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── Security ── */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <KeyRound className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Change password</h2>
            </div>
            <form onSubmit={handleChangePassword} className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Choose a strong password for your admin account. Minimum 8 characters.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => { setNewPw(e.target.value); setPwMsg(null); }}
                      placeholder="Min. 8 characters"
                      className="w-full px-3 py-2.5 pr-9 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowNewPw((v) => !v)}
                      aria-label={showNewPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPw}
                      onChange={(e) => { setConfirmPw(e.target.value); setPwMsg(null); }}
                      placeholder="Re-enter new password"
                      className="w-full px-3 py-2.5 pr-9 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirmPw((v) => !v)}
                      aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      {showConfirmPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Strength indicator */}
              {newPw.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-colors',
                          newPw.length >= level * 3
                            ? level <= 1 ? 'bg-red-400'
                              : level <= 2 ? 'bg-amber-400'
                              : level <= 3 ? 'bg-blue-400'
                              : 'bg-green-500'
                            : 'bg-slate-100',
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {newPw.length < 4 ? 'Too short'
                      : newPw.length < 7 ? 'Weak'
                      : newPw.length < 10 ? 'Fair'
                      : newPw.length < 12 ? 'Good'
                      : 'Strong'}
                  </p>
                </div>
              )}

              {pwMsg && (
                <div className={cn('flex items-center gap-1.5 text-xs', pwMsg.ok ? 'text-green-600' : 'text-red-500')}>
                  {pwMsg.ok && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  {pwMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={pwSaving || !newPw || !confirmPw}
                className="w-full py-2.5 text-sm font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer"
              >
                {pwSaving ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </section>
        </div>

        {/* ── Account details ── */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <Shield className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Account details</h2>
          </div>
          <div className="grid grid-cols-4 divide-x divide-slate-100">

            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Account ID
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-slate-700">
                  {profile?.id ? truncateId(profile.id) : '—'}
                </code>
                <button
                  type="button"
                  onClick={copyId}
                  aria-label="Copy account ID"
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {copied
                    ? <Check className="w-3.5 h-3.5 text-green-500" />
                    : <ClipboardCopy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Status
              </p>
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    profile?.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-400',
                  )}
                />
                <span className="text-sm font-medium text-slate-800 capitalize">
                  {profile?.status?.toLowerCase() ?? '—'}
                </span>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Roles
              </p>
              <div className="flex flex-wrap gap-1">
                {profile?.roles.length
                  ? profile.roles.map((r) => (
                      <span
                        key={r}
                        className={cn(
                          'px-2 py-0.5 rounded text-[11px] font-semibold',
                          ROLE_BADGE[r] ?? 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {roleLabel(r)}
                      </span>
                    ))
                  : <span className="text-sm text-slate-400">—</span>}
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Permissions
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900 leading-none">
                  {profile?.permissions.length ?? 0}
                </span>
                <span className="text-xs text-slate-400">granted</span>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
