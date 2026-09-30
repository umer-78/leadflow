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
  MapPin,
  MessageSquare,
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
    'I want to book an appointment next Tuesday morning for veneers. My number is 555-234-5678.',
  ];

  return (
    <div className={`flex flex-col h-full ${isEmbedded ? '' : 'min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-slate-950'}`}>
      <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col md:flex-row gap-6">
        {/* Left Side: Clinic Context & Sample Prompts */}
        <div className="w-full md:w-80 shrink-0 space-y-4">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider block">
              Active Practice Context
            </span>
            <h2 className="text-sm font-bold text-white mt-0.5">{currentOrg.name}</h2>
            <div className="mt-2 space-y-1.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{currentOrg.address || '420 Lexington Ave, Suite 800'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Mon-Fri 8am-6pm, Sat 9am-2pm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{currentOrg.phone}</span>
              </div>
            </div>
          </div>

          {/* Test Questions Quick Buttons */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <span className="text-[11px] font-semibold text-slate-300 block">
              Test Common Patient Scenarios:
            </span>
            <div className="space-y-1.5">
              {samplePrompts.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(q)}
                  disabled={isLoading}
                  className="w-full text-left p-2 rounded-lg bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800/80 text-[11px] text-slate-300 hover:text-white transition-colors"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>

          {lastExtractedLead && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Lead Captured & Qualified!</span>
              </div>
              <div className="text-[11px] text-slate-300">
                Service: <strong>{lastExtractedLead.service || 'Consultation'}</strong>
              </div>
              <div className="text-[11px] text-slate-300">
                Phone: <strong>{lastExtractedLead.phone}</strong>
              </div>
              <div className="text-[10px] text-emerald-400/80 pt-1">
                ✓ Recorded into Client Dashboard & Automation triggered.
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Interactive AI Chat Box */}
        <div className="flex-1 flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl min-h-[500px]">
          {/* Chat Header */}
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">24/7 AI Patient Coordinator</h3>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Online · Guarded by verified clinic knowledge</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Safe Clinical Guardrails</span>
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

                <div>
                  <div
                    className={`p-3 rounded-xl text-xs leading-relaxed ${
                      m.sender === 'VISITOR'
                        ? 'bg-sky-600 text-white rounded-tr-xs'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs whitespace-pre-line'
                    }`}
                  >
                    {m.content}
                  </div>
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
                  <span>Checking clinical guidelines and procedure fees...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
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
                placeholder="Ask about treatments, consultation availability, or pricing..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
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
