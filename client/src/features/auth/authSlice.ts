import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { authApi, type ChangePasswordPayload, type LoginPayload } from '../../api/api';
import { createApiThunk, type NormalisedApiError } from '../../api/createApiThunk';
import { setAccessToken } from '../../api/httpClient';
import type { LoginResponse, User } from '../../types';

const USER_KEY = 'itwf.user';

const readCachedUser = (): User | null => {
  try {
    return (JSON.parse(localStorage.getItem(USER_KEY) as string) as User | null) ?? null;
  } catch {
    return null;
  }
};

export const login = createApiThunk<LoginResponse, LoginPayload>('auth/login', (payload) => authApi.login(payload));

/**
 * Called once on app start. The access token lives in memory only, so a page
 * reload silently rotates the httpOnly refresh cookie to obtain a new one.
 */
export const restoreSession = createApiThunk<{ user: User }>('auth/restore', async () => {
  await authApi.refresh();
  return authApi.me();
});

// Even if the server call fails the slice still clears the local session.
export const logout = createApiThunk<{ message: string }>('auth/logout', () => authApi.logout());

export const changePassword = createApiThunk<{ message: string }, ChangePasswordPayload>(
  'auth/changePassword',
  (payload) => authApi.changePassword(payload),
);

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous' | 'failed';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: AuthStatus;
  error: string | null;
  initialising: boolean;
  logoutReason: string | null;
}

const initialState: AuthState = {
  user: readCachedUser(),
  accessToken: null,
  status: 'idle',
  error: null,
  initialising: true,
  logoutReason: null,
};

const clearSession = (state: AuthState) => {
  state.user = null;
  state.accessToken = null;
  state.status = 'anonymous';
  setAccessToken(null);
  localStorage.removeItem(USER_KEY);
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionExpired(state, action: PayloadAction<string | undefined>) {
      state.user = null;
      state.accessToken = null;
      state.status = 'anonymous';
      state.logoutReason = action.payload || 'Your session has expired. Please sign in again.';
      localStorage.removeItem(USER_KEY);
    },
    clearLogoutReason(state) {
      state.logoutReason = null;
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload));
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.logoutReason = null;
        setAccessToken(action.payload.accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user));
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as NormalisedApiError | undefined)?.message ?? 'Login failed';
      })
      .addCase(restoreSession.pending, (state) => {
        state.initialising = true;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.status = 'authenticated';
        state.initialising = false;
        localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user));
      })
      .addCase(restoreSession.rejected, (state, action) => {
        state.user = null;
        state.accessToken = null;
        state.status = 'anonymous';
        state.initialising = false;
        const payload = action.payload as NormalisedApiError | undefined;
        if (payload?.status !== 401) {
          state.error = payload?.message ?? 'Could not restore your session';
        }
      })
      .addCase(logout.fulfilled, clearSession)
      .addCase(logout.rejected, clearSession)
      .addCase(changePassword.fulfilled, clearSession);
  },
});

export const { sessionExpired, clearLogoutReason, setUser } = authSlice.actions;
export default authSlice.reducer;
