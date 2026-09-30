/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AIProviderHealth {
  providerName: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'DISABLED';
  latencyMs: number;
  details?: string;
  isPrimary?: boolean;
}

export interface AIResponse {
  text: string;
  providerUsed: string;
  latencyMs: number;
  confidenceScore?: number;
  extractedLead?: {
    name?: string;
    email?: string;
    phone?: string;
    service?: string;
    urgency?: 'HIGH' | 'MEDIUM' | 'LOW';
    preferredDate?: string;
    preferredTime?: string;
  };
  requiresHandoff?: boolean;
  handoffReason?: string;
}

export interface AIProvider {
  name: string;
  generate(prompt: string, context?: {
    systemInstruction?: string;
    knowledgeChunks?: string[];
    clinicName?: string;
  }): Promise<string>;
  healthCheck(): Promise<AIProviderHealth>;
}
