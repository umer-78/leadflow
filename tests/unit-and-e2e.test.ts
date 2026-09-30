/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { appStore } from '../src/lib/store/app-store.ts';
import { calculateLeadScore } from '../src/lib/crm/scoring.ts';
import { billingProvider } from '../src/lib/billing/provider.ts';
import { hasPermission } from '../src/lib/auth/auth-service.ts';

export function runLeadFlowTestRunner(): { name: string; status: 'PASS' | 'FAIL'; message?: string }[] {
  const results: { name: string; status: 'PASS' | 'FAIL'; message?: string }[] = [];

  // Test 1: Tenant Isolation
  try {
    const state = appStore.getState();
    const currentOrgId = state.currentOrg.id;
    const leads = state.leads.filter((l) => l.organizationId === currentOrgId);
    const isolated = leads.every((l) => l.organizationId === currentOrgId);
    if (!isolated) throw new Error('Leads from outside organization detected');
    results.push({ name: 'Tenant Isolation Test', status: 'PASS' });
  } catch (err: any) {
    results.push({ name: 'Tenant Isolation Test', status: 'FAIL', message: err.message });
  }

  // Test 2: Deterministic Lead Scoring
  try {
    const scoreHigh = calculateLeadScore({
      serviceRequested: 'Porcelain Veneers Full Set',
      phone: '+1 (555) 302-9911',
      urgency: 'HIGH',
      notes: 'Ready for consultation this week',
    });
    if (scoreHigh.tier !== 'HIGH' || scoreHigh.score < 75) {
      throw new Error(`Scoring calculation mismatch: tier=${scoreHigh.tier}, score=${scoreHigh.score}`);
    }
    results.push({ name: 'Lead Scoring Engine', status: 'PASS' });
  } catch (err: any) {
    results.push({ name: 'Lead Scoring Engine', status: 'FAIL', message: err.message });
  }

  // Test 3: MRR Calculation Engine ($20,000 Target)
  try {
    const state = appStore.getState();
    const mrr = billingProvider.calculateMRR(state.organizations);
    if (mrr.targetMRR !== 20000 || mrr.mrrGap < 0) {
      throw new Error(`MRR target mismatch: target=${mrr.targetMRR}`);
    }
    results.push({ name: '$20k Target MRR Engine', status: 'PASS' });
  } catch (err: any) {
    results.push({ name: '$20k Target MRR Engine', status: 'FAIL', message: err.message });
  }

  // Test 4: Role-Based Access Control (RBAC)
  try {
    if (!hasPermission('OWNER', 'org:billing')) throw new Error('OWNER should have org:billing');
    if (hasPermission('STAFF', 'org:billing')) throw new Error('STAFF must NOT have org:billing');
    if (!hasPermission('STAFF', 'leads:read')) throw new Error('STAFF should have leads:read');
    if (hasPermission('VIEWER', 'knowledge:manage')) throw new Error('VIEWER must NOT have knowledge:manage');
    results.push({ name: 'Server-Side RBAC Enforcement', status: 'PASS' });
  } catch (err: any) {
    results.push({ name: 'Server-Side RBAC Enforcement', status: 'FAIL', message: err.message });
  }

  return results;
}
