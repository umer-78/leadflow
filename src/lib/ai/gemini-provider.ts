/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { AIProvider, AIProviderHealth } from './types.ts';

export class GeminiProvider implements AIProvider {
  name = 'Gemini 3.8 Flash (Cloud)';
  private client: GoogleGenAI | null = null;
  private apiKey: string | null = null;

  constructor() {
    this.initClient();
  }

  private initClient() {
    const key =
      (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
      '';
    if (key && key !== 'MY_GEMINI_API_KEY') {
      this.apiKey = key;
      this.client = new GoogleGenAI({ apiKey: key });
    }
  }

  async healthCheck(): Promise<AIProviderHealth> {
    this.initClient();
    if (!this.client || !this.apiKey) {
      return {
        providerName: this.name,
        status: 'UNAVAILABLE',
        latencyMs: 0,
        details: 'API key not injected in environment (using deterministic fallback)',
        isPrimary: true,
      };
    }

    try {
      const start = Date.now();
      const response = await this.client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: 'ping',
      });
      const latency = Date.now() - start;
      if (response && response.text) {
        return {
          providerName: this.name,
          status: 'HEALTHY',
          latencyMs: latency,
          details: 'Connected to Gemini API (gemini-3.8-flash)',
          isPrimary: true,
        };
      }
      return {
        providerName: this.name,
        status: 'DEGRADED',
        latencyMs: latency,
        details: 'Received unexpected response format',
        isPrimary: true,
      };
    } catch (err: any) {
      return {
        providerName: this.name,
        status: 'DEGRADED',
        latencyMs: 0,
        details: err?.message || 'Remote API error',
        isPrimary: true,
      };
    }
  }

  async generate(
    prompt: string,
    context?: {
      systemInstruction?: string;
      knowledgeChunks?: string[];
      clinicName?: string;
    }
  ): Promise<string> {
    this.initClient();
    if (!this.client) {
      throw new Error('Gemini API key is not configured');
    }

    const systemPrompt = `You are the lead AI Receptionist and Patient Care Coordinator for "${context?.clinicName || 'Apex Smile & Cosmetic Studio'}".
Guardrails & Policies:
1. Answer patient questions warmly, concisely, and professionally.
2. Ground your answers strictly in the knowledge provided below. Never fabricate pricing, policies, or doctor qualifications.
3. NEVER provide clinical medical diagnoses or guarantee treatment outcomes.
4. When a patient expresses interest in booking an appointment or receiving a callback, politely ask for their full name, phone number, and service interest.
5. If the patient has a complex dispute or medical emergency, immediately direct them to emergency services or offer human receptionist handoff.

Knowledge Base:
${context?.knowledgeChunks?.join('\n---\n') || 'General cosmetic and restorative dentistry clinic.'}
`;

    const response = await this.client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: context?.systemInstruction || systemPrompt,
        temperature: 0.2,
      },
    });

    return response.text || 'Thank you for your inquiry. A team member will contact you shortly.';
  }
}
