import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Hero */}
      <header className="border-b border-border bg-gradient-to-b from-emerald-50 to-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="text-sm font-semibold tracking-tight text-emerald-900">
            Nuru
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="rounded-full border border-emerald-600 px-3 py-1 text-[0.7rem] font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Sign in
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:flex-row md:items-center">
          <div className="max-w-xl space-y-6">
            <p className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-800">
              Multi-tenant ERP for Africa
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              The operating system for the African enterprise.
            </h1>
            <p className="text-sm text-slate-600">
              Run inventory, invoicing, chama banking, and cashflows from one
              RLS-secure, multi-tenant workspace. Built for volatility, mobile
              money, and scale.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="rounded-full bg-emerald-600 px-6 text-sm font-medium text-emerald-50 shadow-neo hover:bg-emerald-700"
                onClick={() => navigate('/login')}
              >
                Get Started
              </Button>
              <span className="text-[0.75rem] text-muted-foreground">
                No credit card. Your tenant, your data.
              </span>
            </div>
          </div>
          <div className="relative flex-1">
            <div className="relative mx-auto h-64 max-w-md rounded-2xl bg-card p-4 shadow-neo">
              <div className="mb-3 flex items-center justify-between text-[0.7rem] text-muted-foreground">
                <span>Today at a glance</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                  KES workspace
                </span>
              </div>
              <div className="grid gap-3 text-xs md:grid-cols-2">
                <Card className="border-none bg-emerald-50/70 p-3 text-emerald-900 shadow-none">
                  <div className="text-[0.65rem] font-semibold uppercase text-emerald-800/80">
                    Total Sales
                  </div>
                  <div className="mt-1 text-lg font-semibold">KES 128,450</div>
                  <div className="mt-1 text-[0.65rem] text-emerald-800/80">
                    Posted &amp; paid invoices
                  </div>
                </Card>
                <Card className="border-none bg-slate-900 text-slate-50 shadow-none">
                  <div className="text-[0.65rem] font-semibold uppercase text-slate-200">
                    Cash at Hand
                  </div>
                  <div className="mt-1 text-lg font-semibold">KES 64,300</div>
                  <div className="mt-1 text-[0.65rem] text-slate-300">
                    Across chama &amp; tills
                  </div>
                </Card>
                <Card className="border-none bg-background p-3 shadow-none">
                  <div className="text-[0.65rem] font-semibold uppercase text-slate-500">
                    Stock Alerts
                  </div>
                  <div className="mt-1 text-[0.7rem] text-slate-600">
                    5 products below minimum. 2 expiring this week.
                  </div>
                </Card>
                <Card className="border-none bg-background p-3 shadow-none">
                  <div className="text-[0.65rem] font-semibold uppercase text-slate-500">
                    Trust Engine
                  </div>
                  <div className="mt-1 text-[0.7rem] text-slate-600">
                    Every invoice and loan is audit-logged with who, what, and
                    when.
                  </div>
                </Card>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-8 -top-6 h-24 w-24 rounded-full bg-emerald-200/60 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 left-4 h-24 w-32 rounded-full bg-amber-100/70 blur-3xl" />
          </div>
        </div>
      </header>

      {/* Feature grid */}
      <main className="mx-auto mt-8 w-full max-w-5xl flex-1 px-4 pb-16">
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-none bg-card p-4 shadow-neo">
            <div className="text-sm font-semibold text-foreground">
              Offline First
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Designed for unreliable power and networks. Keep working and sync
              when you&apos;re back online.
            </p>
          </Card>
          <Card className="border-none bg-card p-4 shadow-neo">
            <div className="text-sm font-semibold text-foreground">
              M-Pesa Native
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Built to plug into mobile money and local rails, not the other way
              around.
            </p>
          </Card>
          <Card className="border-none bg-card p-4 shadow-neo">
            <div className="text-sm font-semibold text-foreground">
              Trust Engine
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Immutable audit trails for invoices, loans, and cash—so teams can
              trust each other and their numbers.
            </p>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 text-[0.7rem] text-muted-foreground">
          <span>© {new Date().getFullYear()} Nuru.</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="hover:text-foreground"
              onClick={() => navigate('/login')}
            >
              Sign in
            </button>
            <span className="hidden md:inline-block">Docs</span>
            <span className="hidden md:inline-block">Status</span>
          </div>
        </div>
      </footer>
    </div>
  );
}