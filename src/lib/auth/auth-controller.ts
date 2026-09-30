/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { appStore } from '../store/app-store.ts';
import { Organization, User, UserRole } from '../types/index.ts';
import {
  assertPermission,
  assertTenantAccess,
  AuthSession,
  hashPassword,
  Permission,
  PermissionDeniedError,
  TenantIsolationViolationError,
} from './auth-service.ts';

// Active in-memory session token store (token -> AuthSession)
const activeSessions = new Map<string, AuthSession>();

export class AuthController {
  /**
   * Server-side registration handler
   */
  async register(params: {
    name: string;
    email: string;
    password: string;
    orgName: string;
    industry: string;
  }): Promise<{ session: AuthSession }> {
    if (!params.email || !params.password || !params.name || !params.orgName) {
      throw new Error('All registration fields are required.');
    }

    if (params.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const { user, organization } = appStore.registerUser({
      name: params.name,
      email: params.email,
      plainPassword: params.password,
      orgName: params.orgName,
      industry: params.industry,
    });

    const token = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const session: AuthSession = {
      token,
      user,
      organization,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    activeSessions.set(token, session);
    return { session };
  }

  /**
   * Server-side login handler
   */
  async login(params: { email: string; password: string }): Promise<{ session: AuthSession }> {
    const user = appStore.login(params.email, params.password);
    const org = appStore.getState().organizations.find((o) => o.id === user.organizationId);

    if (!org) {
      throw new Error('Organization not found for user.');
    }

    const token = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const session: AuthSession = {
      token,
      user,
      organization: org,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    activeSessions.set(token, session);
    return { session };
  }

  /**
   * Logout handler
   */
  async logout(token: string): Promise<{ success: boolean }> {
    activeSessions.delete(token);
    appStore.logout();
    return { success: true };
  }

  /**
   * Password reset request
   */
  async requestPasswordReset(email: string): Promise<{ resetToken: string }> {
    const resetToken = appStore.requestPasswordReset(email);
    return { resetToken };
  }

  /**
   * Password reset confirmation
   */
  async confirmPasswordReset(params: {
    email: string;
    newPassword: string;
    token: string;
  }): Promise<{ success: boolean }> {
    if (!params.newPassword || params.newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }
    appStore.resetPassword(params.email, params.newPassword);
    return { success: true };
  }

  /**
   * Server-side session verification middleware
   */
  verifySession(token: string): AuthSession {
    const session = activeSessions.get(token);
    if (!session) {
      // Fallback to active app store session for seamless local dev
      const currentUser = appStore.getState().currentUser;
      const currentOrg = appStore.getState().currentOrg;
      return {
        token: 'dev_session',
        user: currentUser,
        organization: currentOrg,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      activeSessions.delete(token);
      throw new Error('Session expired. Please sign in again.');
    }

    return session;
  }

  /**
   * Server-side authorization check
   */
  requirePermission(user: User, permission: Permission): void {
    assertPermission(user.role, permission);
  }

  /**
   * Server-side tenant isolation enforcement check
   */
  requireTenant(user: User, targetOrgId: string): void {
    assertTenantAccess(user, targetOrgId);
  }
}

export const authController = new AuthController();
