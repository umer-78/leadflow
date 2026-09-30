/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';

interface VoiceAudioInputProps {
  onTranscript: (text: string) => void;
  isProcessing?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function VoiceAudioInput({
  onTranscript,
  isProcessing = false,
  className = '',
  size = 'md',
}: VoiceAudioInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check browser SpeechRecognition support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          onTranscript(finalTranscript.trim());
          setIsListening(false);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow mic permissions.');
        } else if (event.error !== 'no-speech') {
          setError(`Voice input: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup abort
        }
      }
    };
  }, [onTranscript]);

  const requestMicPermission = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stream acquired successfully, stop tracks immediately
      stream.getTracks().forEach((t) => t.stop());
      // Re-trigger speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (err: any) {
      console.warn('getUserMedia permission request failed:', err);
      setError('Mic blocked by browser. Click the lock/camera icon in address bar to Allow Mic, or use text chat.');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        setError('Voice recognition is not supported in this browser. Please use Google Chrome, Edge, or text chat.');
        return;
      }
      try {
        setError(null);
        recognitionRef.current.start();
      } catch (err: any) {
        console.warn('Recognition start failed:', err);
        requestMicPermission();
      }
    }
  };

  const sizeClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
    lg: 'p-3 text-base',
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        disabled={isProcessing}
        title={isListening ? 'Click to stop voice intake' : 'Click to speak with microphone'}
        className={`rounded-lg transition-all flex items-center justify-center ${sizeClasses[size]} ${
          isListening
            ? 'bg-rose-600 text-white animate-pulse shadow-lg ring-2 ring-rose-400'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-sky-400 border border-slate-700'
        } ${className}`}
      >
        {isListening ? (
          <div className="flex items-center gap-1.5">
            <Mic className="w-4 h-4 text-white animate-bounce" />
            <span className="text-[11px] font-semibold">Listening...</span>
          </div>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      {error && (
        <div className="absolute bottom-full mb-2 right-0 sm:left-0 w-64 p-2.5 bg-slate-900 border border-amber-500/60 text-slate-200 text-[11px] rounded-xl shadow-2xl z-50 space-y-2">
          <div className="flex items-start gap-1.5 text-amber-400 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Microphone Permission Guide</span>
          </div>
          <p className="text-[10px] text-slate-300 leading-snug">
            {error}
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800 gap-1">
            <button
              type="button"
              onClick={requestMicPermission}
              className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-semibold transition-colors"
            >
              Request Mic Access
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-[10px] text-slate-400 hover:text-slate-200 underline"
            >
              Use Text
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
