import { useState } from 'react';
import { X } from 'lucide-react';
import { api, setAuthToken } from '../lib/api';
import { signInWithGoogleSearchConsole } from '../lib/googleAuth';
import type { UserAccount } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';
import { CountrySelect } from './GeoEngineControls';

interface AuthOnboardingModalProps {
  initialMode: 'login' | 'register' | 'onboarding';
  initialUser?: UserAccount | null;
  prefillQuery?: string;
  onClose: () => void;
  onSuccess: (user: UserAccount) => void;
}

const INDUSTRIES = [
  'B2B SaaS & Marketing',
  'E-Commerce & Retail',
  'Digital Agency / Consulting',
  'Fintech & Payments',
  'Developer Tools & AI',
  'Healthcare & Wellness',
  'Education & EdTech',
];

const OBJECTIVES = [
  'Discover Audience Channels',
  'Find Low-KD Keywords',
  'Benchmark Competitors',
  'Improve AI Search Visibility',
  'Mine Reddit Pain Points',
  'Generate Client Reports',
];

export function AuthOnboardingModal({
  initialMode,
  initialUser,
  prefillQuery,
  onClose,
  onSuccess,
}: AuthOnboardingModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'recover' | 'verify' | 'onboarding'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [previewCodeHint, setPreviewCodeHint] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<UserAccount | null>(initialUser || null);

  // Onboarding fields
  const [businessOrWebsite, setBusinessOrWebsite] = useState(initialUser?.onboarding.businessOrWebsite || '');
  const [industry, setIndustry] = useState(initialUser?.onboarding.industry || 'B2B SaaS & Marketing');
  const [targetAudience, setTargetAudience] = useState(
    prefillQuery || initialUser?.onboarding.targetAudience || ''
  );
  const [targetCountries, setTargetCountries] = useState(
    (initialUser?.onboarding.targetCountries || ['United States']).join(', ')
  );
  const [preferredLanguage, setPreferredLanguage] = useState(initialUser?.onboarding.preferredLanguage || 'English');
  const [objectives, setObjectives] = useState<string[]>(initialUser?.onboarding.objectives || ['Discover Audience Channels']);

  const handleDemo = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.demoLogin();
      setAuthToken(res.token);
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start demo session');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      setAuthToken(res.token);
      if (!res.user.onboarding.completed) {
        setPendingUser(res.user);
        setMode('onboarding');
      } else {
        onSuccess(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.register({ name, email, password });
      setAuthToken(res.token);
      setPendingUser(res.user);
      setPreviewCodeHint(res.previewVerificationCode);
      setMode('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const gResult = await signInWithGoogleSearchConsole();
      const targetEmail = gResult.user.email || email.trim() || 'alex.morgan@agency.demo';
      const targetName = gResult.user.displayName || name.trim() || 'Google User';
      const res = await api.googleSignIn({ email: targetEmail, name: targetName });
      setAuthToken(res.token);
      if (!res.user.onboarding.completed) {
        setPendingUser(res.user);
        setMode('onboarding');
      } else {
        onSuccess(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.verifyEmail(verificationCode);
      setPendingUser(res.user);
      setMode('onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    setLoading(true);
    try {
      const res = await api.recoverPassword({
        email,
        resetCode: resetCode || undefined,
        newPassword: newPassword || undefined,
      });
      setStatusMessage(res.message);
      if (res.previewResetCode) {
        setPreviewCodeHint(res.previewResetCode);
      }
      if (newPassword && resetCode) {
        setMode('login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async (skip = false) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.saveOnboarding(
        skip
          ? { completed: true }
          : {
              businessOrWebsite,
              industry,
              targetAudience,
              targetCountries: targetCountries
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              preferredLanguage,
              objectives,
              completed: true,
            }
      );
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save onboarding');
    } finally {
      setLoading(false);
    }
  };

  const toggleObjective = (obj: string) => {
    setObjectives((prev) => (prev.includes(obj) ? prev.filter((item) => item !== obj) : [...prev, obj]));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Account and workspace setup"
    >
      <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-display font-bold text-[#171B35] dark:text-white">
            {mode === 'login' && 'Sign in to Bizhub AI'}
            {mode === 'register' && 'Create your research workspace'}
            {mode === 'recover' && 'Reset your password'}
            {mode === 'verify' && 'Verify your email'}
            {mode === 'onboarding' && 'Tailor your research workspace'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {statusMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
            {statusMessage}
          </div>
        )}

        {(mode === 'login' || mode === 'register') && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleDemo}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#FFE500] text-[#171B35] font-bold text-sm hover:bg-[#F5DC00] transition-colors cursor-pointer"
            >
              Continue with Demo Workspace (Instant Access)
            </button>

            <div className="flex justify-center">
              <GoogleSignInButton
                onClick={handleGoogleSignIn}
                disabled={loading}
                label="Sign in with Google (Connects Search Console)"
              />
            </div>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              <span className="px-3 text-xs text-slate-400">or use email</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-3">
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-medium mb-1">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Maya Lin"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium mb-1">
                  Work Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-medium mb-1">
                  Password (min 8 chars)
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#565FEA] text-white font-semibold text-sm hover:bg-[#464ED8] transition-colors cursor-pointer"
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Free Account'}
              </button>
            </form>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2">
              {mode === 'login' ? (
                <>
                  <button type="button" onClick={() => setMode('register')} className="hover:text-[#565FEA] cursor-pointer">
                    Need an account? Sign up
                  </button>
                  <button type="button" onClick={() => setMode('recover')} className="hover:text-[#565FEA] cursor-pointer">
                    Forgot password?
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setMode('login')} className="hover:text-[#565FEA] cursor-pointer">
                  Already registered? Sign in
                </button>
              )}
            </div>
          </div>
        )}

        {mode === 'verify' && (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Enter the 6-digit verification code for <strong>{pendingUser?.email}</strong>.
              {previewCodeHint && (
                <span className="block mt-1 text-xs font-mono text-[#565FEA] dark:text-[#8E96FF]">
                  Preview verification code: {previewCodeHint}
                </span>
              )}
            </p>
            <div>
              <label htmlFor="verify-code" className="block text-xs font-medium mb-1">
                Verification Code
              </label>
              <input
                id="verify-code"
                type="text"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="6-digit code"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMode('onboarding')}
                className="text-xs text-slate-500 hover:underline cursor-pointer"
              >
                Verify later
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-[#565FEA] text-white text-sm font-semibold cursor-pointer"
              >
                Verify Email
              </button>
            </div>
          </form>
        )}

        {mode === 'recover' && (
          <form onSubmit={handleRecover} className="space-y-4">
            <div>
              <label htmlFor="recover-email" className="block text-xs font-medium mb-1">
                Account Email
              </label>
              <input
                id="recover-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
              />
            </div>
            {previewCodeHint && (
              <>
                <p className="text-xs font-mono text-[#565FEA] dark:text-[#8E96FF]">
                  Preview reset code: {previewCodeHint}
                </p>
                <div>
                  <label htmlFor="reset-code" className="block text-xs font-medium mb-1">
                    Reset Code
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="reset-new-pw" className="block text-xs font-medium mb-1">
                    New Password
                  </label>
                  <input
                    id="reset-new-pw"
                    type="password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                  />
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setMode('login')} className="text-xs text-slate-500 hover:underline cursor-pointer">
                Back to Sign In
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-[#565FEA] text-white text-sm font-semibold cursor-pointer"
              >
                {previewCodeHint ? 'Update Password' : 'Send Recovery Code'}
              </button>
            </div>
          </form>
        )}

        {mode === 'onboarding' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Personalize your initial research project and AI Research Copilot context. Optional questions can be skipped.
            </p>
            <div>
              <label htmlFor="onb-website" className="block text-xs font-medium mb-1">
                Business or Website (Optional)
              </label>
              <input
                id="onb-website"
                type="text"
                value={businessOrWebsite}
                onChange={(e) => setBusinessOrWebsite(e.target.value)}
                placeholder="https://yourcompany.com"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="onb-industry" className="block text-xs font-medium mb-1">
                  Industry
                </label>
                <select
                  id="onb-industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151A33] text-sm"
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="onb-language" className="block text-xs font-medium mb-1">
                  Preferred Language
                </label>
                <input
                  id="onb-language"
                  type="text"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="onb-audience" className="block text-xs font-medium mb-1">
                Target Audience (Optional)
              </label>
              <input
                id="onb-audience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., B2B Marketing Directors in North America"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="onb-countries" className="block text-xs font-medium">
                Target Countries (Pick from all countries or add multiple)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <CountrySelect
                  ariaLabel="Add target country"
                  value={targetCountries.split(',')[0]?.trim() || 'United States'}
                  onChange={(picked) => {
                    const existing = targetCountries
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (!existing.includes(picked)) {
                      setTargetCountries([picked, ...existing].join(', '));
                    } else {
                      setTargetCountries([picked, ...existing.filter((x) => x !== picked)].join(', '));
                    }
                  }}
                />
                <input
                  id="onb-countries"
                  type="text"
                  value={targetCountries}
                  onChange={(e) => setTargetCountries(e.target.value)}
                  placeholder="United States, Nigeria, United Kingdom"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium mb-1.5">Main Research Objectives</span>
              <div className="flex flex-wrap gap-2">
                {OBJECTIVES.map((obj) => {
                  const active = objectives.includes(obj);
                  return (
                    <button
                      key={obj}
                      type="button"
                      onClick={() => toggleObjective(obj)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#565FEA] text-white border-[#565FEA]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {obj}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleCompleteOnboarding(true)}
                disabled={loading}
                className="text-xs font-medium text-slate-500 hover:underline cursor-pointer"
              >
                Skip optional questions
              </button>
              <button
                type="button"
                onClick={() => handleCompleteOnboarding(false)}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-[#565FEA] text-white text-sm font-semibold hover:bg-[#464ED8] cursor-pointer"
              >
                Save &amp; Enter Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
