import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, MapPin, Shield, ShieldCheck, Zap } from 'lucide-react';
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

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex">

      {/* ── Left dark panel ── */}
      <div className="w-1/2 bg-[#0D1117] flex flex-col justify-center px-14 py-12 relative overflow-hidden">
        {/* Subtle background grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-12">
            <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">G2Sentry</span>
          </div>

          {/* Headline */}
          <h1 className="text-[2.25rem] font-bold text-white leading-tight mb-4 tracking-tight">
            Operations<br />Command Center
          </h1>
          <p className="text-slate-400 text-[15px] leading-relaxed mb-10">
            Dispatch guardians, manage verifications, and oversee all security operations across Rwanda.
          </p>

          {/* Feature list */}
          <ul className="space-y-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-snug">{title}</p>
                  <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Footer line */}
          <div className="mt-12 pt-6 border-t border-white/10">
            <p className="text-slate-600 text-xs">
              Rwanda National Police certified · RRA EBM compliant
            </p>
          </div>
        </div>
      </div>

      {/* ── Right white panel ── */}
      <div className="w-1/2 bg-white flex flex-col justify-center px-16">
        <div className="max-w-sm w-full mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">
            Admin sign in
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            Access the G2Sentry operations dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+250 788 123 456"
                required
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <button type="button" className="text-xs text-green-600 hover:text-green-700 transition-colors">
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
                  className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3.5 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            >
              {loading ? 'Signing in…' : 'Sign in to dashboard'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">
            G2Sentry Admin · For authorized personnel only
          </p>
        </div>
      </div>

    </div>
  );
}
