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
  const [tenantId, setTenantId] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [googleError, setGoogleError] = React.useState<string | null>(null);

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
    if (!tenantId) {
      setGoogleError('Enter a Tenant ID before continuing with Google.');
      return;
    }

    // This assumes you have integrated Google Identity Services on the page.
    // If not configured yet, show a helpful message.
    const anyWindow = window as any;
    if (!anyWindow.google || !anyWindow.google.accounts) {
      setGoogleError(
        'Google sign-in is not configured yet. Add Google Identity Services script to enable this.'
      );
      return;
    }

    // In a real setup, you would initialize google.accounts.id and get an ID token.
    // Here we expect an external callback to provide the token.
    anyWindow.google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        setGoogleError('Google sign-in was cancelled or could not be displayed.');
      }
    });

    // Note: The actual ID token handling should be wired via Google Identity callback.
    // For now, this is a placeholder to show where the handshake occurs.
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
              <label className="block text-muted-foreground">Tenant ID</label>
              <Input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="Tenant UUID"
                required
              />
            </div>
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
            <Button
              type="submit"
              className="mt-2 w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}