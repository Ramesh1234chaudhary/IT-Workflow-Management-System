import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { clearLogoutReason, login, logout } from '../features/auth/authSlice';
import { usePermission } from './usePermission';
import { DEFAULT_ROUTE_PERMISSIONS } from '../utils/constants';
import type { LoginPayload } from '../api/api';
import type { User } from '../types';

export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, status, error, initialising, logoutReason } = useAppSelector((state) => state.auth);
  const { can, canAny, permissions } = usePermission();

  const isAuthenticated = Boolean(user);

  const signIn = useCallback(
    async (credentials: LoginPayload): Promise<User | null> => {
      const result = await dispatch(login(credentials));
      return login.fulfilled.match(result) ? result.payload.user : null;
    },
    [dispatch],
  );

  const signOut = useCallback(async () => {
    await dispatch(logout());
    navigate('/login', { replace: true });
  }, [dispatch, navigate]);

  /** Role-agnostic landing route: the first screen the user's permissions allow. */
  const homePath = useCallback(() => {
    const match = DEFAULT_ROUTE_PERMISSIONS.find(({ permission }) => permissions.includes(permission));
    return match ? match.path : '/projects';
  }, [permissions]);

  const navigateToLogin = useCallback(
    () => navigate('/login', { state: { from: location.pathname }, replace: true }),
    [navigate, location.pathname],
  );

  useEffect(() => {
    if (!logoutReason) return undefined;
    // The snackbar host clears the reason once it has been shown.
    const timer = setTimeout(() => dispatch(clearLogoutReason()), 4000);
    return () => clearTimeout(timer);
  }, [logoutReason, dispatch]);

  return {
    user,
    status,
    error,
    initialising,
    logoutReason,
    isAuthenticated,
    permissions,
    can,
    canAny,
    signIn,
    signOut,
    homePath,
    navigateToLogin,
  };
}

export default useAuth;
