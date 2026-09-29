import type { ReactNode } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { usePermission } from '../hooks/usePermission';
import type { PermissionInput } from '../types';

interface PermissionGateProps {
  module?: string;
  action?: string;
  /** Single `module:action` key, e.g. "sop:publish". */
  permission?: string;
  requireAll?: boolean;
  /** Several permissions at once, as keys or [module, action] tuples. */
  permissions?: readonly PermissionInput[];
  children?: ReactNode;
  fallback?: ReactNode;
  mode?: 'hide' | 'disabled';
}

/**
 * Inline permission gate.
 *
 * Renders `fallback` (or nothing) when the user's role does not grant the
 * permission. Authorisation comes purely from the DB-driven permission list.
 */
export default function PermissionGate({
  module,
  action,
  permission,
  requireAll = false,
  permissions = [],
  children,
  fallback = null,
  mode = 'hide',
}: PermissionGateProps) {
  const { can, canAny, canAll } = usePermission();

  const granted = permission
    ? can(permission.split(':')[0], permission.split(':')[1])
    : permissions.length
      ? requireAll
        ? canAll(...permissions)
        : canAny(...permissions)
      : can(module ?? '', action ?? '');

  if (granted) return children;
  if (mode === 'disabled' && children) {
    return (
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <Box sx={{ pointerEvents: 'none', opacity: 0.45, filter: 'grayscale(1)' }}>{children}</Box>
      </Box>
    );
  }
  return fallback;
}

export function PermissionDeniedHint({ children }: { children?: ReactNode }) {
  return (
    <Paper sx={{ p: 3, textAlign: 'center' }}>
      <LockOutlinedIcon color="disabled" sx={{ fontSize: 40, mb: 1 }} />
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
      <Button size="small" sx={{ mt: 1 }} href="/">
        Go back
      </Button>
    </Paper>
  );
}
