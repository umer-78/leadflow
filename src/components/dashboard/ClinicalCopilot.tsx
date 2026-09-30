/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Copy,
  Check,
  FileText,
  MessageSquare,
  Mic,
  Send,
  Sparkles,
  Stethoscope,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import { appStore } from '../../lib/store/app-store.ts';
import { VoiceAudioInput } from '../voice/VoiceAudioInput.tsx';
import { performGoogleSearchGrounding, SearchCitation } from '../../lib/ai/google-search-grounding.ts';

interface CopilotMessage {
  id: string;
  sender: 'USER' | 'COPILOT';
  content: string;
  timestamp: string;
  citations?: SearchCitation[];
}

export function ClinicalCopilot() {
  const state = appStore.getState();
  const currentOrg = state.currentOrg;
  const orgLeads = state.leads.filter((l) => l.organizationId === currentOrg.id);

  const [enableGoogleGrounding, setEnableGoogleGrounding] = useState(true);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'COPILOT',
      content: `Hello Dr. ${state.currentUser.name.split(' ')[1] || 'Doctor'}! I am your Clinical Practice Copilot. You can ask me to summarize incoming patient leads, draft post-consultation treatment plans, search 2026 fee benchmarks with Google Grounding, or dictate clinical consultation notes using your microphone.`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      sender: 'USER',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      let groundedCitations: SearchCitation[] = [];
      let extraGroundingContext = '';

      if (enableGoogleGrounding) {
        const groundedData = await performGoogleSearchGrounding(text, 'CLINICAL');
        groundedCitations = groundedData.citations;
        extraGroundingContext = `\nGoogle Search Grounded Facts: ${groundedData.answer}`;
      }

      // Call backend AI gateway
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text + extraGroundingContext,
          clinicName: currentOrg.name,
          systemInstruction: `You are Dr. AI, an expert Clinical Practice & Front-Desk Copilot for "${currentOrg.name}".
Your role is to assist the doctor and front desk staff with:
1. Summarizing incoming high-ticket patient inquiries.
2. Drafting professional, empathetic post-consultation treatment letters and payment estimates.
3. Structuring clinical consultation dictation notes into clean SOAP format (Subjective, Objective, Assessment, Plan).
4. Explaining procedure timelines and patient FAQs.
Current practice active lead count: ${orgLeads.length} leads.`,
        }),
      });

      const data = await response.json();
      const aiReply: CopilotMessage = {
        id: `ai-${Date.now()}`,
        sender: 'COPILOT',
        content: data.text || 'I have recorded your request.',
        timestamp: new Date().toISOString(),
        citations: groundedCitations,
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'COPILOT',
          content: 'Unable to process clinical request. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const quickActions = [
    {
      title: 'Summarize Unread Patient Inquiries',
      prompt: `Please review our current patient leads queue (${orgLeads.length} leads) and summarize the top 3 high-value cosmetic procedure cases requiring immediate doctor attention today.`,
    },
    {
      title: 'Draft Veneer Case Consultation Letter',
      prompt: `Draft an empathetic post-consultation follow-up email for a patient interested in 8 porcelain veneers ($12,000 package), including our financing options and complimentary 3D smile preview.`,
    },
    {
      title: 'Structure SOAP Clinical Note',
      prompt: `Format a standard clinical SOAP chart note for a patient presenting with cosmetic enamel wear desiring Clear Aligners and upper anterior bonding.`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold uppercase tracking-wider mb-1">
            <Stethoscope className="w-4 h-4" />
            <span>Doctor & Staff Clinical Copilot</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Multi-Turn Practice Assistant & Voice Dictation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Summarize inquiries, dictate clinical notes, and draft patient consultation estimates.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => setEnableGoogleGrounding(!enableGoogleGrounding)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              enableGoogleGrounding
                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300 shadow-xs'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Toggle Google Search Grounding for real-time web research and fee benchmarks"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Google Grounding: {enableGoogleGrounding ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() =>
              setMessages([
                {
                  id: 'welcome-reset',
                  sender: 'COPILOT',
                  content: 'Chat history cleared. How may I assist you with clinical operations today?',
                  timestamp: new Date().toISOString(),
                },
              ])
            }
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Clear Thread</span>
          </button>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {quickActions.map((qa, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(qa.prompt)}
            disabled={isProcessing}
            className="p-3 bg-slate-900/60 hover:bg-slate-850 border border-slate-800 rounded-xl text-left transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-white group-hover:text-sky-400 transition-colors">
                {qa.title}
              </span>
              <Zap className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400" />
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2">
              {qa.prompt}
            </p>
          </button>
        ))}
      </div>

      {/* Chat Stream Window */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[500px] overflow-hidden shadow-2xl">
        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/60">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 max-w-[88%] ${
                m.sender === 'USER' ? 'ml-auto flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  m.sender === 'USER'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-indigo-600 text-white shadow-sm'
                }`}
              >
                {m.sender === 'USER' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className="space-y-1">
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    m.sender === 'USER'
                      ? 'bg-sky-600 text-white rounded-tr-xs'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs whitespace-pre-line'
                  }`}
                >
                  {m.content}

                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Google Search Grounded Citations</span>
                      </div>
                      <div className="space-y-1">
                        {m.citations.map((c, cIdx) => (
                          <a
                            key={cIdx}
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-[11px] transition-colors"
                          >
                            <div className="font-semibold text-sky-400 hover:underline">{c.title}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{c.snippet}</div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between px-1 text-[10px] text-slate-500">
                  <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {m.sender === 'COPILOT' && (
                    <button
                      onClick={() => handleCopy(m.id, m.content)}
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                      title="Copy response"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3 max-w-[88%]">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl rounded-tl-xs text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span>Dr. AI is generating clinical response...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar with Voice Audio Dictation */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800">
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
              placeholder="Ask Dr. AI, draft a letter, or speak with microphone..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />

            {/* Voice Audio Dictation */}
            <VoiceAudioInput
              onTranscript={(dictatedText) => {
                setInput(dictatedText);
                handleSendMessage(dictatedText);
              }}
              isProcessing={isProcessing}
              size="md"
            />

            <button
              type="submit"
              disabled={isProcessing || !input.trim()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
