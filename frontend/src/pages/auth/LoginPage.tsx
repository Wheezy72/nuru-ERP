import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [tenantOptions, setTenantOptions] = React.useState<
    { tenantId: string; name: string; code: string }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [googleError, setGoogleError] = React.useState<string | null>(null);
  const [resetIdentifier, setResetIdentifier] = React.useState('');
  const [resetCode, setResetCode] = React.useState('');
  const [resetPassword, setResetPassword] = React.useState('');
  const [resetStage, setResetStage] = React.useState<'idle' | 'codeSent'>('idle');
  const [resetMessage, setResetMessage] = React.useState<string | null>(null);

  const handleLookupTenants = async () => {
    setError(null);
    if (!email) {
      setError('Enter an email first.');
      return;
    }
    try {
      const res = await apiClient.post('/auth/lookup-tenants', { email });
      const { tenants } = res.data as {
        tenants: { tenantId: string; name: string; code: string }[];
      };
      setTenantOptions(tenants);
      if (tenants.length === 1) {
        setTenantId(tenants[0].tenantId);
      } else {
        setTenantId(null);
      }
    } catch (err: any) {
      setTenantOptions([]);
      setTenantId(null);
      setError(
        err?.response?.data?.message ||
          'Could not find any workspaces for this email.'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiClient.post('/auth/login', {
        email,
        password,
        tenantId,
      });

      const { token, user } = res.data as {
        token: string;
        user: { id: string; role: string; tenantId: string };
      };

      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user_id', user.id);
      localStorage.setItem('auth_role', user.role);
      localStorage.setItem('tenant_id', user.tenantId);

      navigate('/dashboard');
    } catch (err: any) {
      setError(
        err?.response?.data?.message || 'Login failed. Check your credentials.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleError(null);

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setGoogleError(
        'Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in your env.'
      );
      return;
    }

    if (!tenantId) {
      setGoogleError('Select a workspace before continuing with Google.');
      return;
    }

    const anyWindow = window as any;
    const google = anyWindow.google?.accounts?.id;
    if (!google) {
      setGoogleError(
        'Google Identity Services not loaded. Include the Google script on index.html to enable this.'
      );
      return;
    }

    google.initialize({
      client_id: clientId,
      callback: async (response: { credential?: string }) => {
        if (!response.credential) {
          setGoogleError('No Google credential received.');
          return;
        }
        try {
          const res = await apiClient.post('/auth/google', {
            idToken: response.credential,
            tenantId,
          });

          const { token, user } = res.data as {
            token: string;
            user: { id: string; role: string; tenantId: string };
          };

          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user_id', user.id);
          localStorage.setItem('auth_role', user.role);
          localStorage.setItem('tenant_id', user.tenantId);

          navigate('/dashboard');
        } catch (err: any) {
          setGoogleError(
            err?.response?.data?.message || 'Google login failed. Check configuration.'
          );
        }
      },
    });

    google.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        setGoogleError(
          'Google sign-in was cancelled or could not be displayed.'
        );
      }
    });
  };

  const handleSendReset = async () => {
    setResetMessage(null);
    try {
      await apiClient.post('/auth/forgot-password', {
        identifier: resetIdentifier,
      });
      setResetStage('codeSent');
      setResetMessage('Reset code sent via WhatsApp.');
    } catch (err: any) {
      setResetMessage(
        err?.response?.data?.message ||
          'Could not send reset code. Check identifier.'
      );
    }
  };

  const handleConfirmReset = async () => {
    setResetMessage(null);
    try {
      await apiClient.post('/auth/reset-password', {
        identifier: resetIdentifier,
        token: resetCode,
        newPassword: resetPassword,
      });
      setResetMessage('Password updated. You can sign in with the new password.');
      setResetStage('idle');
      setResetCode('');
      setResetPassword('');
    } catch (err: any) {
      setResetMessage(
        err?.response?.data?.message || 'Reset failed. Check code and try again.'
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden flex-1 items-center justify-center bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 p-10 text-emerald-50 md:flex">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight">
            Nuru
          </h1>
          <p className="mt-3 text-sm text-emerald-100">
            The operating system for the African enterprise. Multi-tenant, RLS-secure,
            and tuned for real-world cashflows.
          </p>
          <div className="mt-8 grid gap-4 text-sm text-emerald-50/90">
            <div className="rounded-lg bg-emerald-900/20 p-3">
              <div className="font-medium">Offline First</div>
              <div className="text-xs text-emerald-100/80">
                Designed to withstand flaky networks and power cuts.
              </div>
            </div>
            <div className="rounded-lg bg-emerald-900/20 p-3">
              <div className="font-medium">M-Pesa Native</div>
              <div className="text-xs text-emerald-100/80">
                Deep integration with mobile money rails.
              </div>
            </div>
            <div className="rounded-lg bg-emerald-900/20 p-3">
              <div className="font-medium">Trust Engine</div>
              <div className="text-xs text-emerald-100/80">
                Every sensitive action is logged and attributable.
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(236,252,203,0.16),transparent_55%),radial-gradient(circle_at_80%_0,rgba(187,247,208,0.1),transparent_60%)]" />
      </div>
      <div className="flex min-h-screen flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-sm p-6 shadow-neo">
          <h1 className="mb-2 text-lg font-semibold text-foreground">
            Welcome back
          </h1>
          <p className="mb-4 text-xs text-muted-foreground">
            Sign in to your workspace.
          </p>

          <Button
            type="button"
            variant="outline"
            className="mb-3 flex w-full items-center justify-center gap-2 bg-background"
            onClick={handleGoogleLogin}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-900">
              G
            </span>
            <span className="text-xs font-medium text-foreground">
              Continue with Google
            </span>
          </Button>
          {googleError && (
            <div className="mb-3 text-xs text-rose-600">
              {googleError}
            </div>
          )}

          <div className="mb-3 h-px w-full bg-border" />

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1 text-sm">
              <label className="block text-muted-foreground">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1 text-sm">
                <label className="block text-muted-foreground">
                  Workspace
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={tenantId ?? ''}
                  onChange={(e) =>
                    setTenantId(e.target.value ? e.target.value : null)
                  }
                >
                  <option value="">
                    {tenantOptions.length === 0
                      ? 'Enter email and find workspace'
                      : tenantOptions.length === 1
                      ? tenantOptions[0].name
                      : 'Select workspace'}
                  </option>
                  {tenantOptions.map((t) => (
                    <option key={t.tenantId} value={t.tenantId}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mb-1"
                onClick={handleLookupTenants}
              >
                Find
              </Button>
            </div>
            <div className="space-y-1 text-sm">
              <label className="block text-muted-foreground">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="text-xs text-rose-600">
                {error}
              </div>
            )}
            <div className="flex items-center justify-between text-[0.7rem]">
              <button
                type="button"
                className="text-emerald-700 underline-offset-2 hover:underline"
                onClick={() => setResetStage('idle')}
              >
                Forgot password?
              </button>
            </div>
            <Button
              type="submit"
              className="mt-2 w-full"
              disabled={isSubmitting || !tenantId}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-4">
            <div className="mb-2 text-xs font-semibold text-foreground">
              Reset password via WhatsApp
            </div>
            <div className="space-y-2 text-xs">
              <Input
                placeholder="Phone or email used for login"
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
              />
              {resetStage === 'idle' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={handleSendReset}
                >
                  Send reset code
                </Button>
              )}
              {resetStage === 'codeSent' && (
                <>
                  <Input
                    placeholder="6-digit code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="New password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={handleConfirmReset}
                  >
                    Confirm reset
                  </Button>
                </>
              )}
              {resetMessage && (
                <div className="text-[0.7rem] text-emerald-700">
                  {resetMessage}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}