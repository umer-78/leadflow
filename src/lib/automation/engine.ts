/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AutomationActionType,
  AutomationRule,
  AutomationRun,
  AutomationTrigger,
  Lead,
} from '../types/index.ts';

export interface AutomationExecutionResult {
  run: AutomationRun;
  updatedLead?: Partial<Lead>;
  clientNotification?: {
    type: 'LEAD_URGENT' | 'HANDOFF' | 'APPOINTMENT' | 'AUTOMATION_ALERT';
    title: string;
    message: string;
  };
}

export class AutomationEngine {
  private executedSignatures = new Set<string>();

  /**
   * Evaluates rules against an event and lead
   */
  evaluateEvent(
    trigger: AutomationTrigger,
    lead: Lead,
    rules: AutomationRule[]
  ): AutomationExecutionResult[] {
    const results: AutomationExecutionResult[] = [];

    // Safety: If lead is opted out or marked DO_NOT_CONTACT, stop all outbound actions
    if (lead.optedOut || lead.status === 'DO_NOT_CONTACT') {
      return [
        {
          run: {
            id: `run-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            ruleId: 'safety-rule',
            ruleName: 'Opt-Out & Do Not Contact Enforcement',
            organizationId: lead.organizationId,
            targetLeadId: lead.id,
            targetLeadName: lead.name,
            status: 'SKIPPED',
            actionTaken: 'Suppressed automation: Lead opted out or set to DO_NOT_CONTACT',
            timestamp: new Date().toISOString(),
            details: 'Zero unwanted communication rule enforced.',
          },
        },
      ];
    }

    const applicableRules = rules.filter(
      (r) => r.enabled && r.organizationId === lead.organizationId && r.trigger === trigger
    );

    for (const rule of applicableRules) {
      // Evaluate condition
      const conditionPassed = this.checkCondition(rule.condition, lead);
      if (!conditionPassed) {
        continue;
      }

      for (const action of rule.actions) {
        // Prevent duplicate action runs for the same lead + rule + action + follow-up count
        const signature = `${lead.id}-${rule.id}-${action.type}-${lead.followupCount}`;
        if (this.executedSignatures.has(signature)) {
          results.push({
            run: {
              id: `run-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              ruleId: rule.id,
              ruleName: rule.name,
              organizationId: lead.organizationId,
              targetLeadId: lead.id,
              targetLeadName: lead.name,
              status: 'SKIPPED',
              actionTaken: `Duplicate prevention: Action ${action.type} already executed for this stage`,
              timestamp: new Date().toISOString(),
            },
          });
          continue;
        }

        this.executedSignatures.add(signature);
        const execResult = this.executeAction(action.type, action.params, lead, rule);
        results.push(execResult);
      }
    }

    return results;
  }

  private checkCondition(conditionStr: string, lead: Lead): boolean {
    if (!conditionStr || conditionStr === 'always') return true;

    try {
      if (conditionStr.includes('status == NEW')) {
        return lead.status === 'NEW';
      }
      if (conditionStr.includes('score.tier == HIGH')) {
        return lead.score.tier === 'HIGH';
      }
      if (conditionStr.includes('status == QUALIFIED')) {
        return lead.status === 'QUALIFIED';
      }
      if (conditionStr.includes('has_phone')) {
        return Boolean(lead.phone && lead.phone.length > 5);
      }
      return true;
    } catch {
      return true;
    }
  }

  private executeAction(
    type: AutomationActionType,
    params: Record<string, any>,
    lead: Lead,
    rule: AutomationRule
  ): AutomationExecutionResult {
    const runId = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    switch (type) {
      case 'send_initial_response': {
        const nextFollowup = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        return {
          run: {
            id: runId,
            ruleId: rule.id,
            ruleName: rule.name,
            organizationId: lead.organizationId,
            targetLeadId: lead.id,
            targetLeadName: lead.name,
            status: 'SUCCESS',
            actionTaken: `Dispatched instant SMS/Email acknowledgement to ${lead.phone || lead.email}`,
            timestamp: new Date().toISOString(),
            details: `Template: Initial Clinical Response. Follow-up sequence initiated.`,
          },
          updatedLead: {
            status: lead.status === 'NEW' ? 'CONTACTED' : lead.status,
            lastContactedAt: new Date().toISOString(),
            followupScheduledAt: nextFollowup,
            followupCount: (lead.followupCount || 0) + 1,
          },
        };
      }

      case 'schedule_followup': {
        const delayDays = params?.delayDays || 1;
        const scheduledTime = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString();
        return {
          run: {
            id: runId,
            ruleId: rule.id,
            ruleName: rule.name,
            organizationId: lead.organizationId,
            targetLeadId: lead.id,
            targetLeadName: lead.name,
            status: 'SUCCESS',
            actionTaken: `Scheduled Step ${lead.followupCount + 1} Automated Follow-up for +${delayDays}d`,
            timestamp: new Date().toISOString(),
            details: `Scheduled date: ${scheduledTime}`,
          },
          updatedLead: {
            followupScheduledAt: scheduledTime,
          },
        };
      }

      case 'notify_client': {
        return {
          run: {
            id: runId,
            ruleId: rule.id,
            ruleName: rule.name,
            organizationId: lead.organizationId,
            targetLeadId: lead.id,
            targetLeadName: lead.name,
            status: 'SUCCESS',
            actionTaken: `Sent high-priority alert to clinic staff dashboard`,
            timestamp: new Date().toISOString(),
            details: `Triggered alert: High value opportunity (${lead.serviceRequested})`,
          },
          clientNotification: {
            type: lead.score.tier === 'HIGH' ? 'LEAD_URGENT' : 'APPOINTMENT',
            title: `High Priority Lead: ${lead.name}`,
            message: `Lead scored ${lead.score.score} pts (${lead.score.tier}) for ${lead.serviceRequested}. Direct contact: ${lead.phone}`,
          },
        };
      }

      case 'update_lead': {
        const newStatus = params?.status || 'QUALIFIED';
        return {
          run: {
            id: runId,
            ruleId: rule.id,
            ruleName: rule.name,
            organizationId: lead.organizationId,
            targetLeadId: lead.id,
            targetLeadName: lead.name,
            status: 'SUCCESS',
            actionTaken: `Updated lead status to ${newStatus}`,
            timestamp: new Date().toISOString(),
          },
          updatedLead: {
            status: newStatus,
          },
        };
      }

      case 'create_appointment_request': {
        return {
          run: {
            id: runId,
            ruleId: rule.id,
            ruleName: rule.name,
            organizationId: lead.organizationId,
            targetLeadId: lead.id,
            targetLeadName: lead.name,
            status: 'SUCCESS',
            actionTaken: `Logged appointment slot reservation in clinic queue`,
            timestamp: new Date().toISOString(),
          },
          updatedLead: {
            status: 'APPOINTMENT_REQUESTED',
          },
          clientNotification: {
            type: 'APPOINTMENT',
            title: `Appointment Requested by ${lead.name}`,
            message: `Requested service: ${lead.serviceRequested} on ${lead.preferredDate || 'next open slot'}.`,
          },
        };
      }

      default:
        return {
          run: {
            id: runId,
            ruleId: rule.id,
            ruleName: rule.name,
            organizationId: lead.organizationId,
            targetLeadId: lead.id,
            targetLeadName: lead.name,
            status: 'SKIPPED',
            actionTaken: `Unknown action type: ${type}`,
            timestamp: new Date().toISOString(),
          },
        };
    }
  }
}

export const automationEngine = new AutomationEngine();
