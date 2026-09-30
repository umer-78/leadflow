/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Organization, User, UserRole } from '../types/index.ts';

export interface AuthSession {
  token: string;
  user: User;
  organization: Organization;
  expiresAt: string;
}

export type Permission =
  | 'org:manage'
  | 'org:billing'
  | 'team:manage'
  | 'leads:read'
  | 'leads:write'
  | 'leads:delete'
  | 'automations:manage'
  | 'knowledge:manage'
  | 'appointments:manage'
  | 'prospects:manage'
  | 'system:admin';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: [
    'org:manage',
    'org:billing',
    'team:manage',
    'leads:read',
    'leads:write',
    'leads:delete',
    'automations:manage',
    'knowledge:manage',
    'appointments:manage',
    'prospects:manage',
    'system:admin',
  ],
  ADMIN: [
    'org:manage',
    'team:manage',
    'leads:read',
    'leads:write',
    'automations:manage',
    'knowledge:manage',
    'appointments:manage',
  ],
  STAFF: [
    'leads:read',
    'leads:write',
    'appointments:manage',
  ],
  VIEWER: [
    'leads:read',
  ],
};

export class TenantIsolationViolationError extends Error {
  constructor(attemptedOrgId: string, userOrgId: string) {
    super(
      `TENANT ISOLATION VIOLATION: User belonging to organization "${userOrgId}" attempted to access or mutate protected entity belonging to organization "${attemptedOrgId}". Access denied.`
    );
    this.name = 'TenantIsolationViolationError';
  }
}

export class PermissionDeniedError extends Error {
  constructor(requiredPermission: Permission, userRole: UserRole) {
    super(
      `PERMISSION DENIED: Role "${userRole}" lacks the required permission "${requiredPermission}".`
    );
    this.name = 'PermissionDeniedError';
  }
}

// In-memory / storage salt & hash simulation
export async function hashPassword(plain: string): Promise<string> {
  // Use Web Crypto API available natively in all modern environments
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`leadflow_salt_v1:${plain}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple hash for non-crypto runtime
  let hash = 0;
  for (let i = 0; i < plain.length; i++) {
    hash = (hash << 5) - hash + plain.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(16)}`;
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function assertPermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new PermissionDeniedError(permission, role);
  }
}

export function assertTenantAccess(
  currentUser: { organizationId: string; role: UserRole },
  targetEntityOrganizationId: string
): void {
  // Agency Master Owner can view system-wide data if role is OWNER and org is agency-root
  if (currentUser.organizationId === 'org-agency-root' && currentUser.role === 'OWNER') {
    return;
  }

  if (currentUser.organizationId !== targetEntityOrganizationId) {
    throw new TenantIsolationViolationError(
      targetEntityOrganizationId,
      currentUser.organizationId
    );
  }
}
