import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AxiosError } from 'axios';
import { ChevronRight } from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { RetroWindowBar } from '../../components/common/RetroWindowBar';
import { AuthDecorations } from '../../components/auth/AuthDecorations';
import { OtpInput } from '../../components/auth/OtpInput';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../context/ToastContext';
import { ApiErrorResponse } from '../../types/api';
import { getApiErrorMessage } from '../../lib/apiError';

type AuthMode = 'login' | 'register' | 'forgot';
type AuthStep = 'credentials' | 'otp';

// Authentication view supporting sign in, registration, email OTP verification, and password reset matching Figma 100%
export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();
  const { showToast } = useToast();

  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<AuthStep>('credentials');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [authNotice, setAuthNotice] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);

  // Resend countdown timer
  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setStep('credentials');
    setOtp(['', '', '', '', '', '']);
    setAuthNotice('');
    setLoading(false);
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthNotice('');

    try {
      if (mode === 'login') {
        const result = await authService.login({ email, password });
        setAuth(result.user, result.accessToken);
        showToast('Welcome back to your DevPulse workspace.', 'success', 'Signed in');

        const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
        navigate(from, { replace: true });
        return;
      }

      if (mode === 'register') {
        await authService.register({ name, email, password });
        setStep('otp');
        setCountdown(60);
        showToast('A 6-digit verification code was sent to your email.', 'info', 'Code sent');
        return;
      }

      if (mode === 'forgot') {
        await authService.forgotPassword(email);
        setStep('otp');
        setCountdown(60);
        showToast('Password reset code was sent to your email.', 'info', 'Code sent');
        return;
      }
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;
      const errorMessage = getApiErrorMessage(err);

      // Transition to OTP if account is pending activation
      if (axiosErr.response?.status === 403 && errorMessage.toLowerCase().includes('verify')) {
        showToast('Please verify your email address to complete activation.', 'warning', 'Email verification');
        setMode('register');
        setStep('otp');
        setCountdown(60);
        try {
          await authService.resendVerificationOtp(email);
        } catch {
          // Keep on OTP step even if resend rate-limited
        }
      } else {
        showToast(errorMessage, 'error', 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      showToast('Please enter all 6 digits of the verification code.', 'warning', 'Invalid code');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const result = await authService.verifyEmail({ email, otp: otpCode });
        setAuth(result.user, result.accessToken);
        showToast('Your account is verified and ready to use.', 'success', 'Account activated');
        navigate('/', { replace: true });
        return;
      }

      if (mode === 'forgot') {
        if (newPassword !== confirmPassword) {
          showToast('New password and confirmation do not match.', 'error', 'Passwords do not match');
          setLoading(false);
          return;
        }

        if (newPassword.length < 8) {
          showToast('Password must be at least 8 characters long.', 'warning', 'Password too short');
          setLoading(false);
          return;
        }

        await authService.resetPassword({ email, otp: otpCode, newPassword });
        setMode('login');
        setStep('credentials');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setAuthNotice('Password updated. You can sign in now.');
        showToast('Your verification code and new password were accepted.', 'success', 'Password updated');
      }
    } catch (err) {
      const errorMessage = getApiErrorMessage(err);
      showToast(errorMessage, 'error', 'Verification error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || loading) return;
    setLoading(true);
    try {
      if (mode === 'register') {
        await authService.resendVerificationOtp(email);
      } else {
        await authService.forgotPassword(email);
      }
      setCountdown(60);
      showToast('A 6-digit verification code was sent to your email.', 'info', 'Code sent');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      showToast(msg, 'error', 'Resend failed');
    } finally {
      setLoading(false);
    }
  };

  const heading =
    step === 'otp'
      ? mode === 'forgot'
        ? 'Verify and reset.'
        : 'Check your inbox.'
      : mode === 'login'
        ? 'Welcome back.'
        : mode === 'register'
          ? 'Create your workspace.'
          : 'Reset your password.';

  const description =
    step === 'otp'
      ? mode === 'forgot'
        ? 'Enter the 6-digit code and choose your new password.'
        : 'Enter the 6-digit verification code we sent to your email.'
      : mode === 'login'
        ? 'Sign in to continue to your workspace.'
        : mode === 'register'
          ? 'Start monitoring your first endpoint in a few minutes.'
          : 'Enter your email and we’ll send a secure verification code.';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-[#d9e8d1] p-4 text-zinc-950 sm:p-8">
      <AuthDecorations />

      <section className="relative z-10 w-full max-w-4xl overflow-hidden rounded-lg border-2 border-zinc-950 bg-cream shadow-[10px_10px_0_#18181b]">
        <RetroWindowBar title="Secure workspace access" tone="blue" />

        <div className="md:grid md:grid-cols-[.8fr_1.2fr]">
          {/* Left Hero Panel */}
          <div className="flex flex-col border-b-2 border-zinc-950 bg-retro-lilac p-6 md:border-b-0 md:border-r-2 md:p-8">
            <Logo />

            <div className="mt-8 hidden w-fit items-center gap-2 rounded-full border border-zinc-950 bg-mint px-3 py-1.5 text-[10px] font-black uppercase tracking-wider md:flex">
              <span className="size-2 rounded-full bg-emerald-600" />
              Systems online
            </div>

            <div className="mt-5 md:mt-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-700">
                DevPulse monitoring
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight tracking-[-0.04em]">
                Know before your users do.
              </h1>
              <p className="mt-4 text-sm font-medium leading-6 text-zinc-700">
                Uptime, latency, and incident context in one focused workspace.
              </p>
            </div>

            <div className="mt-auto hidden grid-cols-2 gap-3 pt-8 md:grid">
              <div className="rounded-md border-2 border-zinc-950 bg-cream p-3">
                <div className="font-black">99.99%</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                  Uptime
                </div>
              </div>
              <div className="rounded-md border-2 border-zinc-950 bg-yellow-200 p-3">
                <div className="font-black">24/7</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                  Monitoring
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="bg-[#fffaf0] p-6 sm:p-8 md:p-9">
            <div className="mx-auto max-w-md">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600">
                {step === 'otp'
                  ? 'Email verification'
                  : mode === 'forgot'
                    ? 'Account recovery'
                    : 'Observability, simplified'}
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-zinc-950">
                {heading}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </div>

            {authNotice && (
              <div className="mx-auto mt-5 max-w-md rounded-md border-2 border-zinc-950 bg-mint px-4 py-3 text-xs font-bold text-zinc-950">
                {authNotice}
              </div>
            )}

            {step === 'credentials' ? (
              <form onSubmit={handleCredentialsSubmit} className="mx-auto mt-6 max-w-md space-y-4">
                {mode === 'register' && (
                  <label className="block text-sm font-bold text-zinc-950">
                    Full name
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      minLength={2}
                      maxLength={50}
                      disabled={loading}
                      className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition-shadow focus:shadow-[4px_4px_0_#65d6c4]"
                      placeholder="Alex Pham"
                    />
                  </label>
                )}

                <label className="block text-sm font-bold text-zinc-950">
                  Email address
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition-shadow focus:shadow-[4px_4px_0_#65d6c4]"
                    placeholder="you@company.com"
                  />
                </label>

                {mode !== 'forgot' && (
                  <label className="block text-sm font-bold text-zinc-950">
                    Password
                    <input
                      required
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      disabled={loading}
                      className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition-shadow focus:shadow-[4px_4px_0_#65d6c4]"
                      placeholder="At least 8 characters"
                    />
                  </label>
                )}

                {mode === 'login' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => changeMode('forgot')}
                      className="text-sm font-bold underline decoration-2 underline-offset-4 text-zinc-950 hover:opacity-80"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-zinc-950 bg-coral px-5 py-3 text-sm font-black text-zinc-950 shadow-[4px_4px_0_#18181b] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#18181b] active:translate-y-0 active:shadow-none disabled:opacity-60"
                >
                  <span>
                    {loading
                      ? 'Please wait...'
                      : mode === 'login'
                        ? 'Sign in'
                        : mode === 'register'
                          ? 'Create account'
                          : 'Send verification code'}
                  </span>
                  <ChevronRight className="size-4 stroke-[3]" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="mx-auto mt-7 max-w-md space-y-5">
                <OtpInput value={otp} onChange={setOtp} disabled={loading} />

                {mode === 'forgot' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-bold text-zinc-950">
                      New password
                      <input
                        required
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={8}
                        disabled={loading}
                        className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-3 py-2.5 text-sm outline-none focus:shadow-[3px_3px_0_#65d6c4]"
                        placeholder="At least 8 characters"
                      />
                    </label>

                    <label className="block text-sm font-bold text-zinc-950">
                      Confirm password
                      <input
                        required
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={8}
                        disabled={loading}
                        className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-3 py-2.5 text-sm outline-none focus:shadow-[3px_3px_0_#65d6c4]"
                        placeholder="Repeat password"
                      />
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.some((digit) => !digit)}
                  className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-zinc-950 bg-coral px-5 py-3 text-sm font-black text-zinc-950 shadow-[4px_4px_0_#18181b] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#18181b] active:translate-y-0 active:shadow-none disabled:opacity-50"
                >
                  <span>
                    {loading
                      ? mode === 'forgot'
                        ? 'Updating...'
                        : 'Verifying...'
                      : mode === 'forgot'
                        ? 'Verify & update password'
                        : 'Verify code'}
                  </span>
                  <ChevronRight className="size-4 stroke-[3]" />
                </button>

                <button
                  type="button"
                  disabled={countdown > 0 || loading}
                  onClick={handleResendOtp}
                  className="w-full text-center text-xs font-black text-zinc-600 underline decoration-2 underline-offset-4 disabled:no-underline disabled:opacity-60"
                >
                  {countdown > 0
                    ? `Resend code in ${countdown}s`
                    : 'Resend verification code'}
                </button>
              </form>
            )}

            <div className="mx-auto mt-6 max-w-md border-t border-zinc-300 pt-5 text-center text-sm text-zinc-600">
              {mode === 'login' && step === 'credentials' ? (
                <>
                  New to DevPulse?{' '}
                  <button
                    type="button"
                    onClick={() => changeMode('register')}
                    className="font-black text-zinc-950 underline decoration-2 underline-offset-4"
                  >
                    Create account
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => changeMode('login')}
                  className="font-black text-zinc-950 underline decoration-2 underline-offset-4"
                >
                  Back to sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
