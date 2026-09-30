import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  HeartHandshake,
  Mic,
  MicOff,
  Phone,
  RefreshCw,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { appStore } from '../../lib/store/app-store.ts';
import { gentleSpeech, VocalPersona } from '../../lib/voice/speech-synthesis.ts';
import { lookupClinicalKnowledge } from '../../lib/ai/clinical-knowledge.ts';

interface LiveVoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LiveVoiceAssistantModal({ isOpen, onClose }: LiveVoiceAssistantModalProps) {
  if (!isOpen) return null;

  const state = appStore.getState();
  const currentOrg = state.currentOrg;

  const [vocalPersona, setVocalPersona] = useState<VocalPersona>('GENTLE_CONCIERGE');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<
    { speaker: 'user' | 'agent'; text: string; time: string }[]
  >([
    {
      speaker: 'agent',
      text: `Hello and welcome to ${currentOrg.name}. I am your gentle 24/7 AI Voice Concierge. How may I assist you with your dental care, veneer fees, or appointment reservations today?`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [liveSpeechInput, setLiveSpeechInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [manualText, setManualText] = useState('');

  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Initial welcome voice greeting using gentleSpeech
  useEffect(() => {
    if (isOpen && !audioMuted) {
      const initialGreeting = `Hello and welcome to ${currentOrg.name}. I am your gentle 24/7 AI Voice Concierge. How may I guide you with your dental care or appointment booking today?`;
      speakText(initialGreeting);
    }
    return () => {
      stopListening();
      gentleSpeech.stop();
    };
  }, [isOpen]);

  const speakText = (text: string) => {
    if (audioMuted) return;

    gentleSpeech.speak(text, {
      persona: vocalPersona,
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        // Automatically start listening for seamless hands-free conversation
        startListening();
      },
      onError: () => setIsSpeaking(false),
    });
  };

  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  const requestMicAccess = async () => {
    try {
      setMicPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      startListening();
    } catch (err: any) {
      console.warn('Microphone access denied:', err);
      setMicPermissionError('Microphone blocked by browser. Please click the lock icon in your browser address bar to Allow Microphone, or use text chat below.');
    }
  };

  const startListening = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicPermissionError('Voice recognition is not supported in this browser. Please use text chat.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setMicPermissionError(null);
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const text = event.results[current][0].transcript;
        setLiveSpeechInput(text);

        if (event.results[current].isFinal) {
          handleUserVoiceMessage(text);
          setLiveSpeechInput('');
        }
      };

      recognition.onerror = (errEvent: any) => {
        setIsListening(false);
        if (errEvent.error === 'not-allowed') {
          setMicPermissionError('Microphone access denied. Please click the lock/camera icon in your address bar to Allow Mic, or use text chat below.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Speech recognition start error:', e);
      setIsListening(false);
      requestMicAccess();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleUserVoiceMessage = async (userText: string) => {
    if (!userText.trim() || isProcessing) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTranscript((prev) => [...prev, { speaker: 'user', text: userText, time }]);
    setIsProcessing(true);
    stopListening();

    // Consult medical knowledge base first for instant accuracy
    const clinicalAnswer = lookupClinicalKnowledge(userText);
    let agentResponseText = clinicalAnswer;

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          clinicName: currentOrg.name,
          knowledgeChunks: [clinicalAnswer],
          systemInstruction: `You are the gentle, warm 24/7 AI Voice Concierge for ${currentOrg.name}.
Answer politely in 1-2 short, articulate sentences so the spoken voice sounds natural, warm, and inviting.
Always present pricing accurately (Veneers $1,400/tooth, Invisalign $3,800 or $129/mo, Implants $2,400).`,
        }),
      });

      const data = await response.json();
      if (data.text) {
        agentResponseText = data.text;
      }
    } catch (e) {
      console.warn('AI voice generation fallback:', e);
    }

    setIsProcessing(false);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTranscript((prev) => [...prev, { speaker: 'agent', text: agentResponseText, time: nowTime }]);

    // Auto-record lead if user mentions booking or contact details
    const lower = userText.toLowerCase();
    if (lower.includes('book') || lower.includes('appointment') || lower.includes('consultation')) {
      appStore.createLead({
        name: 'Voice Concierge Patient',
        email: 'voice.patient@apexcosmetic.com',
        phone: '+1 (415) 882-9012',
        serviceRequested: 'Gentle Voice Consultation',
        urgency: 'HIGH',
        estimatedValue: 2800,
        source: '24/7 Hands-Free Voice Concierge',
        notes: `Inquiry: "${userText}" -> Response: "${agentResponseText}"`,
        status: 'QUALIFIED',
      });
    }

    speakText(agentResponseText);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    handleUserVoiceMessage(manualText);
    setManualText('');
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col text-slate-100 shadow-2xl relative overflow-hidden">
        {/* Header Bar */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-800 shrink-0 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-tight">
                  24/7 Gentle AI Voice Concierge
                </h3>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Speak directly into your microphone for hands-free clinical assistance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Persona Switcher */}
            <div className="hidden sm:flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setVocalPersona('GENTLE_CONCIERGE')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  vocalPersona === 'GENTLE_CONCIERGE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Gentle Concierge
              </button>
              <button
                type="button"
                onClick={() => setVocalPersona('CLINICAL_SPECIALIST')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  vocalPersona === 'CLINICAL_SPECIALIST'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Clinical Specialist
              </button>
            </div>

            <button
              onClick={() => setAudioMuted(!audioMuted)}
              className={`p-2 rounded-xl border transition-colors ${
                audioMuted
                  ? 'bg-rose-950/50 border-rose-800 text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col justify-between space-y-4">
          {/* Conversation Stream */}
          <div className="flex-1 overflow-y-auto space-y-3 bg-slate-950/90 p-4 rounded-2xl border border-slate-800/80 text-xs min-h-[220px]">
          {transcript.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.speaker === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                <span>{msg.speaker === 'user' ? 'You' : 'AI Voice Concierge'}</span>
                <span>·</span>
                <span>{msg.time}</span>
              </div>
              <div
                className={`px-4 py-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                  msg.speaker === 'user'
                    ? 'bg-sky-600 text-white rounded-br-none shadow-md'
                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60 shadow-md'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Animated Microphone & Speech Bar */}
        <div className="space-y-3">
          {micPermissionError && (
            <div className="p-3 bg-amber-950/80 border border-amber-600/80 rounded-2xl text-amber-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-snug">{micPermissionError}</span>
              </div>
              <button
                type="button"
                onClick={requestMicAccess}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-[10px] shrink-0 transition-colors shadow-xs"
              >
                Allow Mic Access
              </button>
            </div>
          )}

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-500 text-white ring-4 ring-rose-500/30 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/20'
                }`}
              >
                {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <div>
                <div className="font-bold text-xs text-white">
                  {isListening
                    ? 'Listening... Speak now'
                    : isSpeaking
                    ? 'AI Concierge Speaking...'
                    : 'Microphone Ready'}
                </div>
                <div className="text-[11px] text-slate-400 italic truncate max-w-sm">
                  {liveSpeechInput
                    ? `"${liveSpeechInput}"`
                    : 'Click microphone button to talk directly to the AI concierge'}
                </div>
              </div>
            </div>

            {/* Waveform Pulse Visualizer */}
            <div className="flex items-center gap-1 h-6">
              {[1, 2, 3, 4, 5, 6].map((bar) => (
                <div
                  key={bar}
                  className={`w-1 rounded-full bg-emerald-500 transition-all ${
                    isListening || isSpeaking ? 'animate-pulse' : 'h-2 opacity-30'
                  }`}
                  style={{
                    height: isListening || isSpeaking ? `${Math.random() * 20 + 8}px` : '8px',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Fallback Text Input Form */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Or type your question here (e.g. How much are veneers?)..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!manualText.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors shadow"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
);
}
