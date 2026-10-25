import { CalendarCheck, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, useApi } from '../api.ts';
import { Button, ErrorNote, Field, Input } from '../ui.tsx';

export function AuthPage({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ clinicName: '', name: '', email: '', password: '' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const options = useApi<{ demo: boolean }>('/auth/options');
  const demo = options.data?.demo;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'signup') {
        await api('/auth/signup', {
          body: { ...form, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        });
      } else {
        await api('/auth/login', { body: { email: form.email, password: form.password } });
      }
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-teal-800 p-10 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">
            <MessageSquareText size={20} />
          </span>
          LeadFlow
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">Your clinic's receptionist that never sleeps.</h1>
          <ul className="mt-8 space-y-5 text-teal-50">
            <li className="flex gap-3">
              <Sparkles className="mt-0.5 flex-none" size={20} />
              <span>Answers patient questions from your own knowledge base, with your prices and policies, around the clock.</span>
            </li>
            <li className="flex gap-3">
              <CalendarCheck className="mt-0.5 flex-none" size={20} />
              <span>Captures and scores leads, offers real open times and requests the appointment.</span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 flex-none" size={20} />
              <span>Spots emergencies, never diagnoses, and runs on your server with no third-party AI.</span>
            </li>
          </ul>
        </div>
        <p className="text-sm text-teal-100">{demo ? 'Try the demo clinic: demo@leadflow.local / demo1234' : 'Runs on your own server.'}</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{mode === 'login' ? 'Sign in' : 'Create your clinic'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'login' ? 'Welcome back.' : 'Set up takes a few minutes. Your assistant comes with a ready-made dental knowledge base.'}
            </p>
          </div>
          {error && <ErrorNote error={error} />}
          {mode === 'signup' && (
            <>
              <Field label="Clinic name">{(id) => <Input id={id} required value={form.clinicName} onChange={set('clinicName')} autoComplete="organization" />}</Field>
              <Field label="Your name">{(id) => <Input id={id} required value={form.name} onChange={set('name')} autoComplete="name" />}</Field>
            </>
          )}
          <Field label="Email">{(id) => <Input id={id} type="email" required value={form.email} onChange={set('email')} autoComplete="email" />}</Field>
          <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
            {(id) => (
              <Input
                id={id}
                type="password"
                required
                minLength={mode === 'signup' ? 8 : undefined}
                value={form.password}
                onChange={set('password')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            )}
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={busy}>
            {mode === 'login' ? 'Sign in' : 'Create clinic'}
          </Button>
          <p className="text-center text-sm text-slate-600">
            {mode === 'login' ? 'New to LeadFlow? ' : 'Already have an account? '}
            <button
              type="button"
              className="font-medium text-teal-700 hover:underline"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(undefined);
              }}
            >
              {mode === 'login' ? 'Create a clinic' : 'Sign in'}
            </button>
          </p>
          {demo && (
            <button
              type="button"
              className="w-full rounded-lg border border-dashed border-teal-300 px-3 py-2 text-xs text-teal-800 hover:bg-teal-50"
              onClick={() => {
                setMode('login');
                setForm((f) => ({ ...f, email: 'demo@leadflow.local', password: 'demo1234' }));
              }}
            >
              Use the demo clinic (demo@leadflow.local / demo1234)
            </button>
          )}
        </form>
      </section>
    </div>
  );
}
