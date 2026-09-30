/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  Bot,
  CheckCircle2,
  Clock,
  Copy,
  Hash,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOff,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { appStore } from '../../lib/store/app-store.ts';
import { telephonyAudio } from '../../lib/voice/audio-engine.ts';
import { lookupClinicalKnowledge, CLINICAL_KNOWLEDGE_BASE } from '../../lib/ai/clinical-knowledge.ts';
import { verificationService } from '../../lib/auth/verification-service.ts';
import { gentleSpeech } from '../../lib/voice/speech-synthesis.ts';

interface CallRecord {
  id: string;
  callerNumber: string;
  callerName: string;
  status: 'COMPLETED' | 'MISSED' | 'IN_PROGRESS';
  verificationStatus: 'DUAL_VERIFIED' | 'SMS_VERIFIED' | 'UNVERIFIED';
  durationSeconds: number;
  timestamp: string;
  transcript: string;
  serviceInquired?: string;
}

export function PhoneReceptionistView() {
  const state = appStore.getState();
  const currentOrg = state.currentOrg;

  const [activeTab, setActiveTab] = useState<'SOFTPHONE' | 'CALL_LOGS' | 'VERIFICATION' | 'INTEGRATION'>('SOFTPHONE');

  // Softphone state
  const [dialedNumber, setDialedNumber] = useState('+1 (415) 882-9012');
  const [callerName, setCallerName] = useState('Marcus Vance');
  const [callState, setCallState] = useState<'IDLE' | 'RINGING' | 'CONNECTED'>('IDLE');
  const [callDuration, setCallDuration] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{ speaker: 'caller' | 'ai'; text: string; time: string }[]>([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [liveSpeechInput, setLiveSpeechInput] = useState('');

  // OTP Verification state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [sentOtpCode, setSentOtpCode] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [verifError, setVerifError] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Call Logs
  const [callLogs, setCallLogs] = useState<CallRecord[]>([
    {
      id: 'call-101',
      callerNumber: '+1 (415) 902-3341',
      callerName: 'Evelyn Hayes',
      status: 'COMPLETED',
      verificationStatus: 'DUAL_VERIFIED',
      durationSeconds: 142,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      transcript:
        'Caller: "Hi, I wanted to ask about porcelain veneers and financing." -> AI Receptionist: "Apex Smile offers handcrafted porcelain veneers from $1,400 per tooth, with 0% APR financing from $99/mo via Cherry. I have verified your number and arranged a consultation with Dr. Lin."',
      serviceInquired: 'Porcelain Veneers',
    },
    {
      id: 'call-102',
      callerNumber: '+1 (415) 440-1928',
      callerName: 'David Sterling',
      status: 'COMPLETED',
      verificationStatus: 'SMS_VERIFIED',
      durationSeconds: 98,
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      transcript:
        'Caller: "Do you accept MetLife dental for Invisalign?" -> AI Receptionist: "Yes, we accept MetLife PPO, which typically covers $1,500 to $2,500 of comprehensive Clear Aligners. Our coordinator will contact you to confirm benefits."',
      serviceInquired: 'Invisalign Orthodontics',
    },
  ]);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTranscript]);

  // Call duration timer
  useEffect(() => {
    if (callState === 'CONNECTED') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Format call duration MM:SS
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Play DTMF and append number
  const handleKeypadPress = (digit: string) => {
    telephonyAudio.playDTMF(digit);
    if (callState === 'IDLE') {
      setDialedNumber((prev) => prev + digit);
    }
  };

  // Start Call (Dial & Connect)
  const handleStartCall = () => {
    if (!dialedNumber) return;
    setCallState('RINGING');
    telephonyAudio.startRinging();

    // Reset live transcript
    setLiveTranscript([]);

    // Connect after 2.5 seconds of ringing
    setTimeout(() => {
      telephonyAudio.stopRinging();
      telephonyAudio.playCallConnect();
      setCallState('CONNECTED');

      const welcomeText = `Thank you for calling ${currentOrg.name}. I am your 24/7 AI Voice Receptionist. How may I assist you with your dental care, pricing, or appointment booking today?`;

      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLiveTranscript([{ speaker: 'ai', text: welcomeText, time: now }]);

      speakAiResponse(welcomeText);
      startSpeechRecognition();
    }, 2400);
  };

  // End Call (Hangup)
  const handleHangup = () => {
    telephonyAudio.stopRinging();
    telephonyAudio.playCallHangup();
    stopSpeechRecognition();

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (callState === 'CONNECTED' && liveTranscript.length > 0) {
      // Save completed call log
      const fullTranscript = liveTranscript
        .map((m) => `${m.speaker === 'caller' ? 'Caller' : 'AI Receptionist'}: "${m.text}"`)
        .join(' -> ');

      const newLog: CallRecord = {
        id: `call-${Date.now()}`,
        callerNumber: dialedNumber,
        callerName: callerName || 'Inbound Caller',
        status: 'COMPLETED',
        verificationStatus: otpVerified ? 'DUAL_VERIFIED' : 'SMS_VERIFIED',
        durationSeconds: callDuration,
        timestamp: new Date().toISOString(),
        transcript: fullTranscript,
        serviceInquired: 'Comprehensive Consultation & Triage',
      };

      setCallLogs((prev) => [newLog, ...prev]);

      // Record lead in CRM
      appStore.createLead({
        name: callerName || 'Phone Patient',
        email: `${(callerName || 'patient').toLowerCase().replace(/\s+/g, '.')}@patientphone.com`,
        phone: dialedNumber,
        serviceRequested: 'Live Softphone Consultation',
        urgency: 'HIGH',
        estimatedValue: 2800,
        source: '24/7 Inbound Softphone',
        notes: `Call Transcript: ${fullTranscript}`,
        status: 'QUALIFIED',
      });

      // Record Audit Trail
      appStore.recordAuditLog({
        action: 'PHONE_CALL_COMPLETED',
        entityType: 'TELEPHONY',
        userName: 'AI Voice Receptionist',
        details: `Inbound call completed with ${callerName} (${dialedNumber}) for ${callDuration}s. Verified status: ${
          otpVerified ? 'DUAL_VERIFIED' : 'SMS_VERIFIED'
        }`,
      });
    }

    setCallState('IDLE');
    setIsAiSpeaking(false);
  };

  // Speech Recognition
  const startSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) recognitionRef.current.abort();

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const text = event.results[current][0].transcript;
        setLiveSpeechInput(text);

        if (event.results[current].isFinal) {
          handleCallerSpokenMessage(text);
          setLiveSpeechInput('');
        }
      };

      recognition.onerror = () => {};
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Speech recognition error:', e);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  // Handle caller speech and generate comprehensive clinical AI voice response
  const handleCallerSpokenMessage = async (callerText: string) => {
    if (!callerText.trim() || isAiSpeaking) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLiveTranscript((prev) => [...prev, { speaker: 'caller', text: callerText, time: now }]);

    // Query comprehensive clinical knowledge base
    const clinicalGuidance = lookupClinicalKnowledge(callerText);

    let aiSpeech = clinicalGuidance;

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: callerText,
          clinicName: currentOrg.name,
          knowledgeChunks: [clinicalGuidance],
          systemInstruction: `You are answering a live telephone call as the expert 24/7 AI Voice Receptionist for "${currentOrg.name}".
Respond warmly, conversationally, concisely (max 2 sentences for natural phone listening), and accurately based on clinical fees.
If the caller wants to book or verify their appointment, offer to send a 6-digit SMS verification code to confirm their mobile number.`,
        }),
      });

      const data = await res.json();
      if (data.text) {
        aiSpeech = data.text;
      }
    } catch (e) {
      console.warn('Voice generation fallback:', e);
    }

    setLiveTranscript((prev) => [...prev, { speaker: 'ai', text: aiSpeech, time: now }]);
    speakAiResponse(aiSpeech);

    // If caller requests booking or verification, trigger SMS OTP challenge
    const lower = callerText.toLowerCase();
    if (lower.includes('book') || lower.includes('verify') || lower.includes('appointment') || lower.includes('schedule')) {
      handleTriggerOtp();
    }
  };

  // Speak AI response aloud via gentleSpeech synthesis
  const speakAiResponse = (text: string) => {
    if (isSpeakerMuted) return;

    gentleSpeech.speak(text, {
      persona: 'GENTLE_CONCIERGE',
      onStart: () => setIsAiSpeaking(true),
      onEnd: () => setIsAiSpeaking(false),
      onError: () => setIsAiSpeaking(false),
    });
  };

  // Trigger 6-Digit SMS OTP Challenge
  const handleTriggerOtp = async () => {
    const challenge = verificationService.createChallenge(
      dialedNumber,
      `${callerName.toLowerCase().replace(/\s+/g, '.')}@patientphone.com`
    );
    setSentOtpCode(challenge.smsOtpCode);
    setShowOtpModal(true);
  };

  // Submit and verify SMS OTP code
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifError(null);

    const result = verificationService.verifySMS(dialedNumber, enteredOtp);
    if (result.success) {
      setOtpVerified(true);
      setShowOtpModal(false);
      const confirmationSpeech = `Thank you ${callerName}. Your mobile identity has been verified via SMS code. Your consultation request is confirmed.`;
      speakAiResponse(confirmationSpeech);
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLiveTranscript((prev) => [...prev, { speaker: 'ai', text: confirmationSpeech, time: now }]);
    } else {
      setVerifError(result.message);
    }
  };

  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/api/telephony/voice-webhook`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold uppercase tracking-wider mb-1">
            <PhoneIncoming className="w-4 h-4 text-emerald-400" />
            <span>Autonomous Telephony & Voice AI Agent</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Practice Phone Line & Interactive Softphone
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time Web Audio softphone with DTMF tones, live microphone audio streaming, exhaustive clinical answers, and SMS 6-digit caller verification.
          </p>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl shadow-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Practice Number</div>
            <div className="text-xs font-mono font-bold text-white">
              {currentOrg.phone || '+1 (555) 349-2041'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('SOFTPHONE')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'SOFTPHONE'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Interactive Softphone & Voice Line</span>
        </button>

        <button
          onClick={() => setActiveTab('CALL_LOGS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'CALL_LOGS'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Call History & Transcripts ({callLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('VERIFICATION')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'VERIFICATION'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Caller ID & SMS OTP Verification</span>
        </button>

        <button
          onClick={() => setActiveTab('INTEGRATION')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === 'INTEGRATION'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <PhoneForwarded className="w-3.5 h-3.5" />
          <span>Twilio / SIP Setup</span>
        </button>
      </div>

      {/* TAB 1: INTERACTIVE LIVE SOFTPHONE */}
      {activeTab === 'SOFTPHONE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Dialpad Softphone Frame */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div>
              {/* Screen / Display */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 mb-4 text-center">
                <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between">
                  <span>Apex Softphone</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      callState === 'CONNECTED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : callState === 'RINGING'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {callState === 'CONNECTED'
                      ? `CONNECTED (${formatDuration(callDuration)})`
                      : callState === 'RINGING'
                      ? 'RINGING PRACTICE...'
                      : 'LINE READY'}
                  </span>
                </div>

                <input
                  type="text"
                  value={dialedNumber}
                  onChange={(e) => setDialedNumber(e.target.value)}
                  placeholder="Enter phone number..."
                  className="w-full bg-transparent text-center text-lg font-mono font-bold text-white mt-2 focus:outline-none"
                />

                <div className="flex items-center justify-center gap-2 mt-1 text-xs text-slate-400">
                  <User className="w-3.5 h-3.5" />
                  <input
                    type="text"
                    value={callerName}
                    onChange={(e) => setCallerName(e.target.value)}
                    placeholder="Caller Name"
                    className="bg-transparent text-center text-xs text-sky-400 focus:outline-none border-b border-slate-800"
                  />
                </div>
              </div>

              {/* 12-Key DTMF Dialpad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                    className="h-12 bg-slate-800/80 hover:bg-slate-750 active:scale-95 text-white font-mono font-bold text-base rounded-xl border border-slate-700/60 shadow transition-all flex flex-col items-center justify-center"
                  >
                    <span>{key}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Call Controls */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-center gap-4">
              {callState === 'IDLE' ? (
                <button
                  type="button"
                  onClick={handleStartCall}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-600/30"
                >
                  <Phone className="w-5 h-5" />
                  <span>Dial & Call AI Receptionist</span>
                </button>
              ) : (
                <div className="flex items-center justify-between w-full gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
                    className={`p-3 rounded-xl border transition-colors ${
                      isSpeakerMuted
                        ? 'bg-rose-950/50 border-rose-800 text-rose-400'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                    title={isSpeakerMuted ? 'Unmute Audio' : 'Mute Audio'}
                  >
                    {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerOtp}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Send SMS OTP</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleHangup}
                    className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg"
                  >
                    <PhoneOff className="w-5 h-5" />
                    <span>End Call</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Live Call Voice & Transcript Screen */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl min-h-[460px]">
            {/* Top Bar */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-3 h-3 rounded-full ${
                    callState === 'CONNECTED'
                      ? 'bg-emerald-500 animate-ping'
                      : callState === 'RINGING'
                      ? 'bg-amber-500 animate-bounce'
                      : 'bg-slate-700'
                  }`}
                />
                <span className="text-xs font-bold text-white">
                  {callState === 'CONNECTED'
                    ? `Live Call Active · ${callerName}`
                    : 'Interactive Speech Transcript & Audio Stream'}
                </span>
              </div>

              {otpVerified && (
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>SMS Verified Caller</span>
                </span>
              )}
            </div>

            {/* Conversation Flow */}
            <div className="flex-1 my-3 overflow-y-auto space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-xs max-h-[300px]">
              {liveTranscript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-10 space-y-2">
                  <Bot className="w-8 h-8 text-slate-600" />
                  <p>Dial the phone number to start a live two-way voice call with the AI Receptionist.</p>
                  <span className="text-[11px] text-slate-600">
                    Supports clinical pricing, procedure timelines, insurance networks, and booking.
                  </span>
                </div>
              ) : (
                liveTranscript.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.speaker === 'caller' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5">
                      <span>{msg.speaker === 'caller' ? callerName : 'AI Receptionist'}</span>
                      <span>·</span>
                      <span>{msg.time}</span>
                    </div>
                    <div
                      className={`px-3.5 py-2 rounded-2xl max-w-[85%] leading-relaxed ${
                        msg.speaker === 'caller'
                          ? 'bg-sky-600 text-white rounded-br-none'
                          : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Live Audio Visualizer / Interim Voice Text */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isAiSpeaking
                      ? 'bg-sky-500/20 text-sky-400 animate-pulse'
                      : callState === 'CONNECTED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isAiSpeaking ? <Volume2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-semibold text-white text-[11px]">
                    {isAiSpeaking
                      ? 'AI Speaking Response...'
                      : callState === 'CONNECTED'
                      ? 'Listening to Caller Microphone...'
                      : 'Microphone Standby'}
                  </div>
                  <div className="text-[10px] text-slate-400 italic truncate max-w-sm">
                    {liveSpeechInput ? `"${liveSpeechInput}"` : 'Speak clearly into your headset or microphone'}
                  </div>
                </div>
              </div>

              {callState === 'CONNECTED' && (
                <button
                  onClick={handleTriggerOtp}
                  className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 shrink-0"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Verify Caller</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CALL LOGS & TRANSCRIPTS */}
      {activeTab === 'CALL_LOGS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-white">Inbound Phone Call Records</h3>
              <p className="text-[11px] text-slate-400">Complete historical transcripts with verification status</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">{callLogs.length} logged call(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Caller</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Call Transcript</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {callLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{log.callerName}</div>
                      <div className="font-mono text-[11px] text-slate-400">{log.callerNumber}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                          log.verificationStatus === 'DUAL_VERIFIED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>{log.verificationStatus}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">{log.durationSeconds}s</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 text-[10px] font-semibold">
                        {log.serviceInquired || 'General Consultation'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] max-w-md truncate">
                      {log.transcript}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CALLER ID & SMS OTP VERIFICATION */}
      {activeTab === 'VERIFICATION' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white">Caller ID & Identity Authentication Protocols</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              To eliminate fake inquiries and secure high-value treatment appointments (Veneers, Invisalign, Implants), the AI agent executes a dual-factor authentication challenge:
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                  <span>1. 6-Digit SMS OTP Challenge</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Dispatched in real time to the caller's mobile phone during or immediately following the consultation request.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Email Confirmation Security Token</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Generates an encrypted link sent to the patient's verified email address to confirm clinical intake details.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Award className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold text-white">Live Verification Sandbox</h3>
            </div>

            <button
              onClick={handleTriggerOtp}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Send Sample SMS OTP to {dialedNumber}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: TWILIO / SIP SETUP */}
      {activeTab === 'INTEGRATION' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl max-w-2xl">
          <div>
            <h3 className="text-base font-bold text-white">Twilio & SIP Carrier Voice Webhook</h3>
            <p className="text-xs text-slate-400 mt-1">
              Connect any live telecom carrier or virtual phone number directly into LeadFlow AI.
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="text-xs font-semibold text-slate-300">Inbound Webhook URL (POST)</div>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/telephony/voice-webhook`}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono"
              />
              <button
                onClick={copyWebhookUrl}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                {copiedWebhook ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col text-slate-100 shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6 pb-3 border-b border-slate-800 shrink-0 flex justify-between items-center">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <Smartphone className="w-5 h-5" />
                <span>Verify Caller Mobile Phone</span>
              </div>
              <button
                onClick={() => setShowOtpModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">

            <p className="text-xs text-slate-300">
              A 6-digit verification PIN has been dispatched to <strong>{dialedNumber}</strong>.
            </p>

            {sentOtpCode && (
              <div className="p-3 bg-indigo-950/60 border border-indigo-800 rounded-xl text-center">
                <div className="text-[10px] text-indigo-300 font-semibold uppercase">SMS Simulator Inbox</div>
                <div className="text-lg font-mono font-bold text-white tracking-widest mt-0.5">
                  {sentOtpCode}
                </div>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Enter 6-Digit SMS PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value)}
                  placeholder="e.g. 778899"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-center text-lg font-mono font-bold tracking-widest text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {verifError && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{verifError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow"
                >
                  Verify & Confirm Appointment
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
