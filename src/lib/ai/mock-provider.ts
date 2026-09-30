/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider, AIProviderHealth } from './types.ts';

export class MockAIProvider implements AIProvider {
  name = 'Mock AI (Local Deterministic)';

  async healthCheck(): Promise<AIProviderHealth> {
    return {
      providerName: this.name,
      status: 'HEALTHY',
      latencyMs: 12,
      details: 'In-memory deterministic fallback active ($0 capital, offline-safe)',
      isPrimary: false,
    };
  }

  async generate(
    prompt: string,
    context?: {
      systemInstruction?: string;
      knowledgeChunks?: string[];
      clinicName?: string;
    }
  ): Promise<string> {
    const lower = prompt.toLowerCase();
    const clinic = context?.clinicName || 'our clinic';
    const chunks = context?.knowledgeChunks || [];

    // Medical diagnosis refusal check
    if (
      lower.includes('diagnos') ||
      lower.includes('is it cancer') ||
      lower.includes('is my tooth infected') ||
      lower.includes('what disease') ||
      lower.includes('swollen lymph')
    ) {
      return `For your health and safety, I cannot provide medical diagnoses or clinical evaluations. Our licensed practitioners at ${clinic} would need to evaluate you in person. Would you like me to request an in-clinic consultation for you? If so, please provide your name, phone number, and preferred day.`;
    }

    // Legal advice check
    if (lower.includes('sue') || lower.includes('lawsuit') || lower.includes('legal liability')) {
      return `I cannot provide legal counsel. For clinical inquiries or scheduling with ${clinic}, I am happy to help connect you with our team directly.`;
    }

    // Pricing inquiries
    if (
      lower.includes('price') ||
      lower.includes('cost') ||
      lower.includes('how much') ||
      lower.includes('fee')
    ) {
      // Find relevant knowledge chunk
      const priceChunk = chunks.find(
        (c) => c.toLowerCase().includes('price') || c.toLowerCase().includes('$')
      );
      if (priceChunk) {
        return `${priceChunk}\n\nPlease note that exact pricing depends on your individual clinical assessment. Would you like to share your phone number so our treatment coordinator can verify your insurance or discuss financing options?`;
      }
      return `Our treatment fees at ${clinic} depend on your specific clinical requirements following an examination. We offer transparent pricing, 0% interest payment plans, and complimentary consultation reviews for select cosmetic treatments. Would you like to share your name and phone number so we can send our current fee guide?`;
    }

    // Appointment / Booking requests
    if (
      lower.includes('appointment') ||
      lower.includes('book') ||
      lower.includes('schedule') ||
      lower.includes('consultation') ||
      lower.includes('slot')
    ) {
      return `We'd love to arrange a consultation for you at ${clinic}! To organize this, please provide:\n1. Your full name\n2. Your best contact phone number\n3. The treatment or service you are interested in (e.g., Teeth Whitening, Clear Aligners, Dental Implants, Porcelain Veneers)\n4. Your preferred day of the week and morning/afternoon preference.\n\nOur team will contact you promptly to confirm your exact appointment slot.`;
    }

    // Hours and Location
    if (
      lower.includes('hour') ||
      lower.includes('open') ||
      lower.includes('where') ||
      lower.includes('location') ||
      lower.includes('address')
    ) {
      const locChunk = chunks.find(
        (c) =>
          c.toLowerCase().includes('hour') ||
          c.toLowerCase().includes('monday') ||
          c.toLowerCase().includes('address')
      );
      if (locChunk) {
        return locChunk;
      }
      return `${clinic} is open Monday through Friday from 8:00 AM to 6:00 PM, and Saturdays from 9:00 AM to 2:00 PM. We are conveniently located with patient parking available. Would you like our exact directions or to book a visit?`;
    }

    // Human Handoff / Complex / Uncertainty
    if (
      lower.includes('speak to human') ||
      lower.includes('real person') ||
      lower.includes('manager') ||
      lower.includes('complaint') ||
      lower.includes('emergency')
    ) {
      return `I understand you would like to connect with a staff member directly. I have marked this conversation for priority staff review. Please leave your name and phone number, and our clinic manager or duty receptionist will reach out immediately during business hours. For immediate medical emergencies, please call emergency services.`;
    }

    // Contact details provided (e.g. user submitted email or phone)
    if (
      prompt.match(/[\w.-]+@[\w.-]+\.\w+/) ||
      prompt.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
    ) {
      return `Thank you! I have received your contact details. Our team at ${clinic} has been notified and will reach out shortly to review your request and confirm your appointment. Is there anything specific about your smile or dental health you'd like us to note beforehand?`;
    }

    // Default polite service inquiry
    return `Hello! Welcome to ${clinic}. We specialize in high-quality general, cosmetic, and restorative dental care. Whether you have a question about treatments like Clear Aligners, Porcelain Veneers, or Dental Implants, or want to check consultation availability, I am here to help. How can we support you today?`;
  }
}
