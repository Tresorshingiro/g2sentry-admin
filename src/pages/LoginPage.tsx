import { CircleCheck, Eye, EyeOff, Lock, Mail, Shield } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { login as apiLogin } from '@/services/api';

const FEATURES = [
  'Real-time guardian tracking and dispatch',
  'RNP-verified guardian management',
  'RRA EBM-compliant billing and invoicing',
];

function validate(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};
  if (!email) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Enter a valid email';
  if (!password) errors.password = 'Password is required';
  return errors;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(email, password);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { token, user } = await apiLogin(email, password);
      login(token, user);
      navigate('/dashboard', { replace: true });
    } catch {
      setErrors({ email: 'Sign in failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-[#0D1117] flex-col p-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">G2Sentry</span>
        </div>

        <div className="mt-auto mb-auto">
          <h1 className="text-white text-3xl font-bold mb-4 leading-tight">
            Operations Command
            <br />
            Center
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            Manage guardians, dispatch assignments, and monitor all security
            operations across Rwanda from one powerful dashboard.
          </p>
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3">
                <CircleCheck className="w-5 h-5 text-green-500 shrink-0" />
                <span className="text-gray-300 text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Admin sign in</h2>
          <p className="text-gray-500 text-sm mb-6">
            Access the G2Sentry operations dashboard.
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <Label htmlFor="email">Email address</Label>
              <div className="relative mt-1">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@g2sentry.rw"
                  className={errors.email ? 'border-red-500 pr-10' : 'pr-10'}
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 pointer-events-none" />
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={
                    errors.password ? 'border-red-500 pr-10' : 'pr-10'
                  }
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
              <div className="text-right mt-1">
                <span className="text-green-600 text-sm cursor-pointer hover:underline">
                  Forgot password?
                </span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign in to dashboard'
              )}
            </Button>
          </form>

          <div className="mt-4 p-3 border rounded-lg flex items-center gap-3">
            <Lock className="w-5 h-5 text-gray-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">
                Two-factor authentication
              </p>
              <p className="text-xs text-gray-400">Enabled for admin accounts</p>
            </div>
            <div className="w-10 h-6 bg-green-500 rounded-full flex items-center justify-end px-1 cursor-default">
              <div className="w-4 h-4 bg-white rounded-full shadow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
