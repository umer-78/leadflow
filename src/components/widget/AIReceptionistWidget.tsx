/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { aiRouter } from '../../lib/ai/router.ts';
import { automationEngine } from '../../lib/automation/engine.ts';
import { appStore } from '../../lib/store/app-store.ts';
import { Message } from '../../lib/types/index.ts';
import { VoiceAudioInput } from '../voice/VoiceAudioInput.tsx';

interface AIReceptionistWidgetProps {
  isEmbedded?: boolean;
}

export function AIReceptionistWidget({ isEmbedded = false }: AIReceptionistWidgetProps) {
  const state = appStore.getState();
  const currentOrg = state.currentOrg;
  const currentKnowledge = state.knowledge.filter((k) => k.organizationId === currentOrg.id);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-init',
      conversationId: 'conv-sim-1',
      sender: 'AI',
      content: currentOrg.aiGreeting,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastExtractedLead, setLastExtractedLead] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      conversationId: 'conv-sim-1',
      sender: 'VISITOR',
      content: userText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Check if user is asking about Google Maps location / directions
      const lower = userText.toLowerCase();
      const isLocationQuery =
        lower.includes('where') ||
        lower.includes('location') ||
        lower.includes('address') ||
        lower.includes('parking') ||
        lower.includes('direction') ||
        lower.includes('how to get');

      // Gather relevant knowledge base chunks
      const chunks = currentKnowledge.flatMap((k) => k.chunks.map((c) => `${c.heading}: ${c.content}`));

      const aiResponse = await aiRouter.generate(userText, {
        clinicName: currentOrg.name,
        knowledgeChunks: chunks,
      });

      const aiMsg: Message = {
        id: `msg-ai-${Date.now()}`,
        conversationId: 'conv-sim-1',
        sender: 'AI',
        content: aiResponse.text,
        timestamp: new Date().toISOString(),
        metadata: {
          requiresHandoff: aiResponse.requiresHandoff,
          extractedLeadInfo: aiResponse.extractedLead,
          showMapsCard: isLocationQuery,
        },
      };

      setMessages((prev) => [...prev, aiMsg]);

      // If lead entities were extracted (phone or email detected)
      if (aiResponse.extractedLead && (aiResponse.extractedLead.phone || aiResponse.extractedLead.email)) {
        setLastExtractedLead(aiResponse.extractedLead);

        // Create or update lead automatically in the practice store
        const created = appStore.createLead({
          name: aiResponse.extractedLead.name || 'Website Inquiry Patient',
          email: aiResponse.extractedLead.email || 'patient@inquiry.example.com',
          phone: aiResponse.extractedLead.phone || '',
          serviceRequested: aiResponse.extractedLead.service || 'Elective Dental Consultation',
          urgency: aiResponse.extractedLead.urgency || 'MEDIUM',
          preferredDate: aiResponse.extractedLead.preferredDate,
          preferredTime: aiResponse.extractedLead.preferredTime,
          notes: `Captured via 24/7 AI Receptionist: "${userText}"`,
          status: 'QUALIFIED',
          source: 'Website AI Widget',
          estimatedValue: aiResponse.extractedLead.service?.toLowerCase().includes('veneer')
            ? 8400
            : aiResponse.extractedLead.service?.toLowerCase().includes('implant')
            ? 4800
            : 3800,
        });

        // Trigger Automation Engine for the new lead
        const executionResults = automationEngine.evaluateEvent('lead.created', created, state.automations);
        executionResults.forEach((res) => {
          appStore.recordAutomationRun(res.run);
        });
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          conversationId: 'conv-sim-1',
          sender: 'AI',
          content: 'I apologize for the delay. Our patient coordinators are currently in clinical procedures. Please leave your phone number and we will connect with you immediately.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    'How much do porcelain veneers cost?',
    'What are your location, hours, and parking?',
    'Do you offer financing for Invisalign?',
    'Doctor, my tooth is throbbing. Can you diagnose what infection I have?',
  ];

  return (
    <div className={`w-full flex flex-col ${isEmbedded ? '' : 'max-w-4xl mx-auto p-4'}`}>
      {!isEmbedded && (
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>24/7 Clinical Practice Receptionist</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Patient Intake & Consultation Scheduling Simulator
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Test procedure inquiries, after-hours intake, clinical guardrails, voice dictation, and Google Maps directions.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Side: Test Prompts & Clinical Context */}
        {!isEmbedded && (
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                <span>Test Prompts</span>
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">
                Click any prompt to simulate patient questions:
              </p>
              <div className="space-y-1.5">
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p)}
                    disabled={isLoading}
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800/80 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    "{p}"
                  </button>
                ))}
              </div>
            </div>

            {/* Practice Contact & Google Maps Quick Info */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-2.5">
              <div className="flex items-center gap-2 text-white font-semibold pb-2 border-b border-slate-800">
                <MapPin className="w-4 h-4 text-rose-400" />
                <span>Practice Location</span>
              </div>
              <div className="text-slate-300">
                <span className="font-semibold text-white block">{currentOrg.name}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">450 Sutter St, Suite 1420, San Francisco, CA 94108</span>
              </div>
              <div className="text-[11px] text-slate-400">
                <Clock className="w-3 h-3 inline mr-1 text-slate-500" />
                <span>{currentOrg.hours || 'Mon - Fri: 8:00 AM - 6:00 PM · Sat: 9:00 AM - 2:00 PM'}</span>
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(currentOrg.name + ' San Francisco')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium pt-1"
              >
                <span>Open in Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Right Side: Interactive AI Receptionist Widget */}
        <div
          className={`${
            isEmbedded ? 'col-span-12' : 'lg:col-span-8'
          } bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[520px] shadow-2xl overflow-hidden`}
        >
          {/* Header */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                  AI
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 absolute -bottom-0.5 -right-0.5" />
              </div>
              <div>
                <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                  <span>{currentOrg.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-mono">
                    24/7 AI Receptionist
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>Voice & Text Enabled · Guarded by clinical knowledge</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Safe Intake</span>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 max-w-[85%] ${
                  m.sender === 'VISITOR' ? 'ml-auto flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                    m.sender === 'VISITOR'
                      ? 'bg-slate-700 text-slate-200'
                      : 'bg-sky-600 text-white'
                  }`}
                >
                  {m.sender === 'VISITOR' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                <div className="space-y-2">
                  <div
                    className={`p-3 rounded-xl text-xs leading-relaxed ${
                      m.sender === 'VISITOR'
                        ? 'bg-sky-600 text-white rounded-tr-xs'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs whitespace-pre-line'
                    }`}
                  >
                    {m.content}
                  </div>

                  {/* Interactive Google Maps Direction Card if location queried */}
                  {m.metadata?.showMapsCard && (
                    <div className="p-3 bg-slate-900/90 border border-sky-800/60 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-sky-300 font-semibold">
                          <Navigation className="w-3.5 h-3.5 text-sky-400" />
                          <span>Google Maps Practice Navigation</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono">Validated</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        📍 450 Sutter St, Suite 1420, San Francisco, CA 94108
                      </p>
                      <p className="text-[10px] text-slate-400">
                        🅿️ Validated parking is available in the Sutter-Stockton Garage adjacent to the building.
                      </p>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                          '450 Sutter St, San Francisco, CA 94108'
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-sm"
                      >
                        <Compass className="w-3 h-3" />
                        <span>Get Instant Directions</span>
                      </a>
                    </div>
                  )}

                  <div
                    className={`text-[10px] text-slate-500 mt-1 ${
                      m.sender === 'VISITOR' ? 'text-right' : ''
                    }`}
                  >
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 max-w-[85%]">
                <div className="w-7 h-7 rounded-full bg-sky-600 flex items-center justify-center text-white shrink-0">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl rounded-tl-xs text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                  <span>Processing inquiry and verifying clinical guidelines...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box with Voice Audio Dictation */}
          <div className="p-3 bg-slate-950 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type or click the microphone to speak..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />

              {/* Live Microphone Voice Input */}
              <VoiceAudioInput
                onTranscript={(voiceText) => {
                  setInput(voiceText);
                  handleSendMessage(voiceText);
                }}
                isProcessing={isLoading}
                size="sm"
              />

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
