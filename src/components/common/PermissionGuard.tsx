/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock } from 'lucide-react';
import { appStore } from '../../lib/store/app-store.ts';
import { hasPermission, Permission } from '../../lib/auth/auth-service.ts';

interface PermissionGuardProps {
  permission: Permission;
  children: React.ReactNode;
  fallbackText?: string;
  showDisabledWithBadge?: boolean;
}

export function PermissionGuard({
  permission,
  children,
  fallbackText = 'Requires elevated role',
  showDisabledWithBadge = true,
}: PermissionGuardProps) {
  const currentUser = appStore.getState().currentUser;
  const isAllowed = hasPermission(currentUser.role, permission);

  if (isAllowed) {
    return <>{children}</>;
  }

  if (showDisabledWithBadge) {
    return (
      <div className="relative inline-flex items-center group cursor-not-allowed">
        <div className="opacity-50 pointer-events-none select-none">{children}</div>
        <div className="ml-1.5 px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded text-[10px] font-semibold flex items-center gap-1 shrink-0">
          <Lock className="w-3 h-3 text-amber-400" />
          <span>{currentUser.role} Lock</span>
        </div>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-slate-950 text-slate-200 text-[10px] px-2.5 py-1 rounded shadow-xl border border-slate-800 whitespace-nowrap z-30">
          {fallbackText} (Current: {currentUser.role})
        </div>
      </div>
    );
  }

  return null;
}
