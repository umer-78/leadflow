/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Bot, MessageSquare } from 'lucide-react';
import { AuthModal } from './components/auth/AuthModal.tsx';
import { ClientDashboardView } from './components/dashboard/ClientDashboardView.tsx';
import { Navbar, ActiveView } from './components/layout/Navbar.tsx';
import { MarketingView } from './components/marketing/MarketingView.tsx';
import { AutonomousConsoleView } from './components/automation/AutonomousConsoleView.tsx';
import { AIAcquisitionView } from './components/acquisition/AIAcquisitionView.tsx';
import { OnboardingWizardModal } from './components/onboarding/OnboardingWizardModal.tsx';
import { OwnerCommandCenter } from './components/admin/OwnerCommandCenter.tsx';
import { PlaybookView } from './components/playbook/PlaybookView.tsx';
import { SystemTestView } from './components/tests/SystemTestView.tsx';
import { AIReceptionistWidget } from './components/widget/AIReceptionistWidget.tsx';
import { appStore } from './lib/store/app-store.ts';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('MARKETING');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showFloatingWidget, setShowFloatingWidget] = useState(false);
  const [, setTick] = useState(0);

  // Re-render when store updates
  useEffect(() => {
    const unsubscribe = appStore.subscribe(() => setTick((t) => t + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Navbar */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenAuth={() => setShowAuthModal(true)}
      />

      {/* Main View Router */}
      <div className="flex-1">
        {activeView === 'MARKETING' && (
          <MarketingView
            onOpenWidget={() => setActiveView('WIDGET_SIMULATOR')}
            onOpenDashboard={() => setActiveView('CLIENT_DASHBOARD')}
            onOpenOnboarding={() => setShowOnboardingModal(true)}
          />
        )}

        {activeView === 'AUTONOMOUS' && <AutonomousConsoleView />}

        {activeView === 'AI_ACQUISITION' && <AIAcquisitionView />}

        {activeView === 'CLIENT_DASHBOARD' && <ClientDashboardView />}

        {activeView === 'ADMIN_COMMAND' && <OwnerCommandCenter />}

        {activeView === 'WIDGET_SIMULATOR' && <AIReceptionistWidget />}

        {activeView === 'TESTS' && <SystemTestView />}

        {activeView === 'PLAYBOOK' && <PlaybookView />}
      </div>

      {/* Floating Widget Toggle (accessible on marketing page) */}
      {activeView === 'MARKETING' && (
        <div className="fixed bottom-6 right-6 z-40">
          {showFloatingWidget ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-[380px] h-[520px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
              <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-white">Live Clinic AI Receptionist</span>
                </div>
                <button
                  onClick={() => setShowFloatingWidget(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <AIReceptionistWidget isEmbedded={true} />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowFloatingWidget(true)}
              className="px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-full shadow-xl flex items-center gap-2 text-xs font-semibold transition-all hover:scale-105"
            >
              <Bot className="w-4 h-4" />
              <span>Ask AI Receptionist</span>
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <OnboardingWizardModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
      />
    </div>
  );
}
