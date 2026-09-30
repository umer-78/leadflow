export type VocalPersona = 'GENTLE_CONCIERGE' | 'CLINICAL_SPECIALIST';

export interface VoiceSynthesisOptions {
  persona?: VocalPersona;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

class GentleSpeechEngine {
  private currentPersona: VocalPersona = 'GENTLE_CONCIERGE';

  // Elevate vocabulary to warm, articulate, gentle medical concierge phrasing
  public polishVocabulary(text: string): string {
    return text
      .replace(/\bhi\b/gi, 'Hello and welcome')
      .replace(/\bguy\b/gi, 'valued patient')
      .replace(/\bcheap\b/gi, 'accessible and affordable')
      .replace(/\bhurt\b/gi, 'cause slight discomfort')
      .replace(/\bpain\b/gi, 'sensitivity')
      .replace(/\bdr\b/gi, 'Doctor')
      .replace(/\bapprox\b/gi, 'approximately')
      .replace(/\bcost\b/gi, 'investment')
      .replace(/\bprice\b/gi, 'fee schedule');
  }

  // Split text into natural 10-14 word phrase chunks for smooth, lag-free speech
  private chunkText(text: string): string[] {
    const sanitized = this.polishVocabulary(text);
    // Split by punctuation first
    const clauses = sanitized.split(/(?<=[.?!;:,])\s+/);
    const chunks: string[] = [];

    for (const clause of clauses) {
      if (clause.length < 90) {
        chunks.push(clause);
      } else {
        // Split long clauses by conjunctions or spaces
        const words = clause.split(' ');
        let current = '';
        for (const word of words) {
          if ((current + ' ' + word).length > 80) {
            chunks.push(current.trim());
            current = word;
          } else {
            current += (current ? ' ' : '') + word;
          }
        }
        if (current.trim()) chunks.push(current.trim());
      }
    }

    return chunks.filter((c) => c.length > 0);
  }

  // Select the highest quality natural female/warm neural voice
  private getBestVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // Prefer Natural / Premium female voices for gentle concierge
    const preferredNames = [
      'Google US English',
      'Google UK English Female',
      'Samantha',
      'Victoria',
      'Microsoft Aria Online (Natural)',
      'Microsoft Jenny Online (Natural)',
      'Karen',
      'Moira',
    ];

    for (const name of preferredNames) {
      const match = voices.find((v) => v.name.toLowerCase().includes(name.toLowerCase()));
      if (match) return match;
    }

    // Fallback to any English female voice
    const englishVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Google'))
    );
    return englishVoice || voices[0] || null;
  }

  // Speak text with gentle cadence, zero lag, and phrase chunking
  public speak(text: string, options: VoiceSynthesisOptions = {}) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Cancel ongoing speech to ensure immediate response
    window.speechSynthesis.cancel();

    const persona = options.persona || this.currentPersona;
    const chunks = this.chunkText(text);
    if (chunks.length === 0) return;

    let index = 0;
    const voice = this.getBestVoice();

    const speakNextChunk = () => {
      if (index >= chunks.length) {
        if (options.onEnd) options.onEnd();
        return;
      }

      const chunk = chunks[index];
      const utterance = new SpeechSynthesisUtterance(chunk);

      if (voice) utterance.voice = voice;

      // Vocal tuning parameters for ultra-soft, warm & gentle delivery
      if (persona === 'GENTLE_CONCIERGE') {
        utterance.rate = 0.92; // Ultra-soft, gentle, empathetic pacing
        utterance.pitch = 1.05; // Soft, warm, inviting pitch
      } else {
        utterance.rate = 0.96; // Crisp clinical pacing
        utterance.pitch = 1.0;
      }

      utterance.lang = 'en-US';

      if (index === 0 && options.onStart) {
        utterance.onstart = options.onStart;
      }

      utterance.onend = () => {
        index++;
        speakNextChunk();
      };

      utterance.onerror = (e) => {
        console.warn('Speech error on chunk:', e);
        index++;
        speakNextChunk();
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextChunk();
  }

  public stop() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  public setPersona(persona: VocalPersona) {
    this.currentPersona = persona;
  }
}

export const gentleSpeech = new GentleSpeechEngine();
