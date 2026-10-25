import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  MessagesSquare,
  Settings as SettingsIcon,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { api, useApi } from './api.ts';
import { setClinicTimeZone } from './format.ts';
import { AppointmentsPage } from './pages/Appointments.tsx';
import { AuthPage } from './pages/Auth.tsx';
import { ConversationsPage } from './pages/Conversations.tsx';
import { KnowledgePage } from './pages/Knowledge.tsx';
import { LeadsPage } from './pages/Leads.tsx';
import { OutboxPage } from './pages/Outbox.tsx';
import { OverviewPage } from './pages/Overview.tsx';
import { SettingsPage } from './pages/Settings.tsx';
import { navigate, useRoute } from './router.ts';
import type { Me, Role } from './types.ts';
import { Badge, Loading, cx } from './ui.tsx';

export interface PageProps {
  me: Me;
  can: (minimum: Role) => boolean;
}

const RANK: Record<Role, number> = { VIEWER: 0, STAFF: 1, ADMIN: 2, OWNER: 3 };

const NAV: { path: string; label: string; icon: ReactNode }[] = [
  { path: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { path: 'leads', label: 'Leads', icon: <Users size={18} /> },
  { path: 'conversations', label: 'Conversations', icon: <MessagesSquare size={18} /> },
  { path: 'appointments', label: 'Appointments', icon: <CalendarDays size={18} /> },
  { path: 'knowledge', label: 'Knowledge & AI', icon: <BookOpen size={18} /> },
  { path: 'outbox', label: 'Emails', icon: <Mail size={18} /> },
  { path: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
];

export function App() {
  const me = useApi<Me | { user: null; org: null }>('/auth/me');
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    const on = () => setSignedOut(true);
    window.addEventListener('leadflow:signed-out', on);
    return () => window.removeEventListener('leadflow:signed-out', on);
  }, []);

  if (me.loading && !me.data) return <Loading label="Opening LeadFlow…" />;
  if (signedOut || !me.data?.user) {
    return (
      <AuthPage
        onSignedIn={() => {
          setSignedOut(false);
          me.reload();
        }}
      />
    );
  }
  setClinicTimeZone(me.data.org.timezone);
  const session = me.data as Me;
  return (
    <Shell
      me={session}
      onSignOut={async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setSignedOut(true);
        navigate('/');
      }}
      onOrgChanged={me.reload}
    />
  );
}

function Shell({ me, onSignOut, onOrgChanged }: { me: Me; onSignOut: () => void; onOrgChanged: () => void }) {
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const section = route.path[0] ?? 'overview';
  const can = (minimum: Role) => RANK[me.user.role] >= RANK[minimum];
  const props: PageProps = { me, can };

  useEffect(() => setMenuOpen(false), [section]);

  const page = (() => {
    switch (section) {
      case 'leads':
        return <LeadsPage {...props} leadId={route.path[1]} />;
      case 'conversations':
        return <ConversationsPage {...props} conversationId={route.path[1]} />;
      case 'appointments':
        return <AppointmentsPage {...props} />;
      case 'knowledge':
        return <KnowledgePage {...props} draftQuestion={route.query.get('new') ?? undefined} />;
      case 'outbox':
        return <OutboxPage {...props} />;
      case 'settings':
        return <SettingsPage {...props} tab={route.path[1]} onOrgChanged={onOrgChanged} />;
      default:
        return <OverviewPage {...props} />;
    }
  })();

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map((item) => (
        <a
          key={item.path}
          href={`#/${item.path}`}
          aria-current={section === item.path ? 'page' : undefined}
          className={cx(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
            section === item.path ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          {item.icon}
          {item.label}
        </a>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2 px-3">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-white">
        <MessageSquareText size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight text-slate-900">LeadFlow</p>
        <p className="truncate text-xs text-slate-500" title={me.org.name}>
          {me.org.name}
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-slate-200 px-3 pt-3">
      <p className="truncate text-sm font-medium text-slate-800">{me.user.name}</p>
      <p className="truncate text-xs text-slate-500">
        {me.user.email} · {me.user.role.toLowerCase()}
      </p>
      <button type="button" onClick={onSignOut} className="mt-2 flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col justify-between border-r border-slate-200 bg-white py-5 lg:flex">
        <div className="flex flex-col gap-6 px-3">
          {brand}
          {nav}
        </div>
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        {brand}
        <button type="button" onClick={() => setMenuOpen(true)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
          <Menu size={20} />
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="flex h-full w-72 flex-col justify-between bg-white py-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-6 px-3">
              <div className="flex items-center justify-between">
                {brand}
                <button type="button" onClick={() => setMenuOpen(false)} className="rounded-md p-1 text-slate-500" aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>
              {nav}
            </div>
            {footer}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        {me.org.isDemo && (
          <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
            <Badge tone="teal">Demo clinic</Badge>{' '}
            <span>
              Everything here is real and working. Chat with the assistant from{' '}
              <a className="font-medium underline" href="#/settings/widget">
                Settings → Website chat
              </a>
              , then watch leads and bookings appear.
            </span>
          </div>
        )}
        {page}
      </main>
    </div>
  );
}
