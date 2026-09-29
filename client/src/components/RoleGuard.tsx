import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Button, Paper, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAppSelector } from '../app/hooks';
import { usePermission } from '../hooks/usePermission';
import PageLoader from './PageLoader';
import type { PermissionPair } from '../types';

const AccessDenied = ({ message }: { message: string }) => (
  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
    <Paper sx={{ p: 4, maxWidth: 520, textAlign: 'center' }}>
      <LockOutlinedIcon color="error" sx={{ fontSize: 48, mb: 1 }} />
      <Typography variant="h6" gutterBottom>
        Access denied
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {message}
      </Typography>
      <Button variant="contained" href="/">
        Back to dashboard
      </Button>
    </Paper>
  </Box>
);

interface RoleGuardProps {
  permissions?: readonly PermissionPair[];
  requireAll?: boolean;
  children?: ReactNode;
  fallback?: ReactNode;
}

/**
 * Route level authorisation.
 *
 * Requires an authenticated session and, optionally, a set of module:action
 * permissions. Permission driven throughout - a role name is never inspected.
 */
export default function RoleGuard({ permissions = [], requireAll = false, children, fallback = null }: RoleGuardProps) {
  const location = useLocation();
  const { user, initialising } = useAppSelector((state) => state.auth);
  const { can } = usePermission();

  if (initialising) return <PageLoader label="Restoring your session…" />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (permissions.length) {
    const granted = requireAll
      ? permissions.every((p) => can(p[0], p[1]))
      : permissions.some((p) => can(p[0], p[1]));

    if (!granted) {
      return (
        fallback ?? (
          <AccessDenied message="Your account does not have the required permission for this screen." />
        )
      );
    }
  }

  return children;
}
