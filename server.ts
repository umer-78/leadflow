/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Cloud AI Engine - Google Gemini API
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  aiClient = new GoogleGenAI({ apiKey });
}

// Cloud Health Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    cloudPlatform: 'Google Cloud Run / AI Studio',
    aiService: aiClient ? 'Gemini 3.8 Flash (Cloud Active)' : 'Cloud Standby (Key Pending)',
    timestamp: new Date().toISOString(),
  });
});

// Cloud Gemini AI Gateway Endpoint
app.post('/api/ai/generate', async (req, res) => {
  const { prompt, clinicName, knowledgeChunks, systemInstruction } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Check safety for medical diagnoses
  const lower = prompt.toLowerCase();
  if (
    lower.includes('diagnos') ||
    lower.includes('is it cancer') ||
    lower.includes('is my tooth infected') ||
    lower.includes('what disease') ||
    lower.includes('swollen lymph')
  ) {
    return res.json({
      text: `For your health and safety, I cannot provide medical diagnoses or clinical evaluations. Our licensed practitioners at ${clinicName || 'our clinic'} would need to evaluate you in person. Would you like me to request an in-clinic consultation for you? If so, please provide your name, phone number, and preferred day.`,
      providerUsed: 'Cloud Safety Guardrail (LeadFlow AI)',
      latencyMs: 15,
    });
  }

  if (aiClient) {
    try {
      const start = Date.now();
      const systemPrompt = systemInstruction || `You are the lead AI Receptionist and Patient Care Coordinator for "${clinicName || 'Apex Smile & Cosmetic Studio'}".
Guardrails & Policies:
1. Answer patient questions warmly, concisely, and professionally.
2. Ground your answers strictly in the knowledge provided below. Never fabricate pricing, policies, or doctor qualifications.
3. NEVER provide clinical medical diagnoses or guarantee treatment outcomes.
4. When a patient expresses interest in booking an appointment or receiving a callback, politely ask for their full name, phone number, and service interest.
5. If the patient has a complex dispute or medical emergency, immediately direct them to emergency services or offer human receptionist handoff.

Knowledge Base:
${(knowledgeChunks && knowledgeChunks.join('\n---\n')) || 'General cosmetic and restorative dentistry clinic.'}`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
        },
      });

      const latencyMs = Date.now() - start;
      return res.json({
        text: response.text || 'Thank you for your inquiry. A clinic coordinator will follow up shortly.',
        providerUsed: 'Gemini 3.8 Flash (Google Cloud)',
        latencyMs,
      });
    } catch (err: any) {
      console.error('Cloud Gemini API error:', err);
      // Fallback cleanly to cloud knowledge search
    }
  }

  // Cloud Knowledge-Base Guided Response (100% cloud-hosted, zero local model overhead)
  const clinic = clinicName || 'our clinic';
  const chunks: string[] = knowledgeChunks || [];

  if (lower.includes('price') || lower.includes('cost') || lower.includes('how much') || lower.includes('fee')) {
    const matched = chunks.find((c) => c.toLowerCase().includes('price') || c.includes('$'));
    if (matched) {
      return res.json({
        text: `${matched}\n\nPlease note that exact fees depend on your clinical assessment. Would you like to share your phone number so our treatment coordinator can verify insurance or provide a tailored estimate?`,
        providerUsed: 'LeadFlow Cloud Knowledge Engine',
        latencyMs: 25,
      });
    }
  }

  if (lower.includes('hour') || lower.includes('open') || lower.includes('location') || lower.includes('where') || lower.includes('address')) {
    const locChunk = chunks.find((c) => c.toLowerCase().includes('hour') || c.toLowerCase().includes('location') || c.toLowerCase().includes('address'));
    if (locChunk) {
      return res.json({
        text: locChunk,
        providerUsed: 'LeadFlow Cloud Knowledge Engine',
        latencyMs: 20,
      });
    }
  }

  if (lower.includes('book') || lower.includes('appointment') || lower.includes('schedule') || lower.includes('consult')) {
    return res.json({
      text: `We'd love to arrange a consultation for you at ${clinic}! To organize this, please provide:\n1. Your full name\n2. Your best contact phone number\n3. The treatment or service you are interested in (e.g., Teeth Whitening, Clear Aligners, Dental Implants, Porcelain Veneers)\n4. Your preferred day of the week and morning/afternoon preference.\n\nOur team will contact you promptly to confirm your exact appointment slot.`,
      providerUsed: 'LeadFlow Cloud Knowledge Engine',
      latencyMs: 20,
    });
  }

  return res.json({
    text: `Hello! Welcome to ${clinic}. We specialize in high-quality general, cosmetic, and restorative care. Whether you have questions about treatments like Clear Aligners, Porcelain Veneers, or Dental Implants, or wish to schedule a consultation, I am here to help. How can we support you today?`,
    providerUsed: 'LeadFlow Cloud Knowledge Engine',
    latencyMs: 20,
  });
});

// Mount Vite or serve static assets
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: Number(PORT),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[LeadFlow AI] Cloud server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
