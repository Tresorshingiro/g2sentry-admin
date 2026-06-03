import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, MapPin, Shield, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const FEATURES = [
  {
    icon: Zap,
    title: 'Live dispatch & tracking',
    desc: 'Real-time guardian locations and one-click dispatch across all Kigali districts.',
  },
  {
    icon: ShieldCheck,
    title: 'RNP-verified roster',
    desc: 'Guardian vetting, certification management and activation workflows.',
  },
  {
    icon: MapPin,
    title: 'RRA EBM billing',
    desc: 'Invoice generation, MoMo/Airtel payments, and electronic tax receipts.',
  },
];

const INPUT_CLS =
  'w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none transition-all placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 bg-white';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(phone, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  // Shared form JSX — inlined directly, not a nested component
  const formJSX = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
          Phone number
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+250 788 123 456"
          required
          autoComplete="tel"
          className={INPUT_CLS}
        />
      </div>

      {/* Password */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <button type="button" className="text-xs text-green-600 hover:text-green-700 transition-colors cursor-pointer font-medium">
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="current-password"
            className={`${INPUT_CLS} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-0.5"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3.5 py-2.5 rounded-xl flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠</span>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-lg shadow-green-500/25 mt-2"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Signing in…
          </>
        ) : (
          <>
            Sign in to dashboard
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );

  return (
    <>
      {/* ── Mobile / tablet (hidden lg+) ── */}
      <div className="lg:hidden min-h-screen bg-[#0D1117] flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-6 justify-center">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-xl shadow-green-500/40 ring-2 ring-green-400/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">G2Sentry</span>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl p-6 shadow-2xl shadow-black/40 ring-1 ring-white/10">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Admin sign in</h2>
              <p className="text-slate-500 text-sm mt-1">Access the G2Sentry operations dashboard.</p>
            </div>
            {formJSX}
          </div>

          {/* Trust indicators */}
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              RNP certified
            </span>
            <span className="text-slate-700 text-xs">·</span>
            <span className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              RRA EBM compliant
            </span>
            <span className="text-slate-700 text-xs">·</span>
            <span className="text-xs text-slate-600">Authorized personnel only</span>
          </div>
        </div>
      </div>

      {/* ── Desktop (hidden below lg) ── */}
      <div className="hidden lg:flex min-h-screen">

        {/* Left dark panel */}
        <div className="w-[52%] bg-[#0D1117] flex flex-col justify-center px-14 py-12 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-green-500/5 to-transparent pointer-events-none" />

          <div className="relative z-10 max-w-md">
            <div className="flex items-center gap-2.5 mb-14">
              <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30 ring-1 ring-green-400/30">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold text-lg tracking-tight">G2Sentry</span>
            </div>

            <h1 className="text-[2.5rem] font-bold text-white leading-[1.15] mb-4 tracking-tight">
              Operations<br />Command Center
            </h1>
            <p className="text-slate-400 text-base leading-relaxed mb-12">
              Dispatch guardians, manage verifications, and oversee all security operations across Rwanda.
            </p>

            <ul className="space-y-5">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold leading-snug">{title}</p>
                    <p className="text-slate-500 text-xs mt-1 leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-12 pt-6 border-t border-white/8 grid grid-cols-3 gap-6">
              {[
                { value: '500+', label: 'Guardians' },
                { value: '30',   label: 'Districts covered' },
                { value: '24/7', label: 'Operations' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-white text-xl font-bold tabular-nums">{value}</p>
                  <p className="text-slate-600 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 bg-slate-50 flex flex-col justify-center px-16">
          <div className="max-w-sm w-full mx-auto">
            <div className="mb-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-700">Secure admin portal</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Admin sign in</h2>
              <p className="text-slate-500 text-sm mt-1">Access the G2Sentry operations dashboard.</p>
            </div>

            {formJSX}

            <p className="mt-8 text-center text-xs text-slate-400">
              G2Sentry Admin · For authorized personnel only
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
