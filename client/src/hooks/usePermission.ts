import { useCallback, useMemo } from 'react';
import { useAppSelector } from '../app/hooks';
import type { PermissionInput, PermissionKey } from '../types';

/**
 * The single source of truth for authorisation in the UI.
 *
 *   const { can } = usePermission();
 *   if (can('sop', 'publish')) ...
 *
 * Permissions come from the API (`user.permissions`, populated from the
 * database-driven Role). Role names are never compared anywhere in the client.
 */
export function usePermission() {
  const permissions = useAppSelector((state) => state.auth.user?.permissions ?? []);

  const permissionSet = useMemo(() => new Set<string>(permissions), [permissions]);

  const can = useCallback((module: string, action: string) => permissionSet.has(`${module}:${action}`), [permissionSet]);

  const has = useCallback(
    (pair: PermissionInput) =>
      typeof pair === 'string' ? permissionSet.has(pair) : permissionSet.has(`${pair[0]}:${pair[1]}`),
    [permissionSet],
  );

  const canAny = useCallback((...pairs: PermissionInput[]) => pairs.some(has), [has]);

  const canAll = useCallback((...pairs: PermissionInput[]) => pairs.every(has), [has]);

  return { can, canAny, canAll, has, permissions };
}

/** Convenience wrapper for a single module:action pair. */
export function useCan(module: string, action: string): boolean {
  const { can } = usePermission();
  return can(module, action);
}

export type { PermissionKey };
export default usePermission;
