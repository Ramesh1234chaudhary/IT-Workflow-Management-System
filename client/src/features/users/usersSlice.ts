import { createSlice, type PayloadAction, type UnknownAction } from '@reduxjs/toolkit';
import {
  usersApi,
  type ActionResult,
  type CreateUserPayload,
  type DeactivatePayload,
  type ListParams,
  type ReassignPayload,
  type ReassignTargets,
  type UpdateUserPayload,
} from '../../api/api';
import { createApiThunk, type NormalisedApiError } from '../../api/createApiThunk';
import type { Paginated, User, UserAssignments, UserSummary } from '../../types';

export const fetchUsers = createApiThunk<Paginated<User>, ListParams>('users/fetch', (params) => usersApi.list(params));
export const fetchAssignableUsers = createApiThunk<{ items: UserSummary[] }>('users/assignable', () =>
  usersApi.assignable(),
);
export const fetchReassignTargets = createApiThunk<ReassignTargets>('users/reassignTargets', () => usersApi.reassignTargets());
export const fetchUserAssignments = createApiThunk<UserAssignments, string>('users/assignments', (id) =>
  usersApi.assignments(id),
);
export const fetchDeactivationPreview = createApiThunk<{ user: User; assignments: UserAssignments }, string>(
  'users/deactivationPreview',
  (id) => usersApi.deactivationPreview(id),
);
export const createUser = createApiThunk<ActionResult & { user: User }, CreateUserPayload>('users/create', (body) => usersApi.create(body));
export const updateUser = createApiThunk<ActionResult & { user: User }, { id: string; body: UpdateUserPayload }>(
  'users/update',
  ({ id, body }) => usersApi.update(id, body),
);
export const deleteUser = createApiThunk<ActionResult, string>('users/delete', (id) => usersApi.remove(id));
export const reactivateUser = createApiThunk<ActionResult & { user: User }, string>('users/reactivate', (id) => usersApi.reactivate(id));
export const reassignUser = createApiThunk<ActionResult & { user: User; reassigned: number }, { id: string; body: ReassignPayload }>(
  'users/reassign',
  ({ id, body }) => usersApi.reassign(id, body),
);
export const deactivateUser = createApiThunk<ActionResult & { user: User }, { id: string; body: DeactivatePayload }>(
  'users/deactivate',
  ({ id, body }) => usersApi.deactivate(id, body),
);

export interface UserFilters {
  search: string;
  role: string;
  isActive: string;
  page: number;
  limit: number;
}

export interface DeactivationBlock {
  userId: string;
  reason: string;
  projects?: { id: string; name: string; code?: string }[];
  stages?: { id: string; name: string; projectId?: string; projectName?: string }[];
}

export interface UsersState {
  items: User[];
  pagination: import('../../types').Pagination;
  filters: UserFilters;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  actionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  actionError: string | null;
  /** Populated when the API answers 409 for a deactivation attempt. */
  deactivationBlock: DeactivationBlock | null;
  assignable: UserSummary[];
  reassignTargets: ReassignTargets;
  assignments: UserAssignments;
  deactivationPreview: { user: User; assignments: UserAssignments } | null;
}

/** Thunks that only read, so they must never claim the shared action flag. */
const READ_ONLY_USER_THUNKS = [
  'users/fetch',
  'users/assignable',
  'users/assignments',
  'users/reassignTargets',
  'users/deactivationPreview',
];

const isUserWrite = (type: string): boolean => {
  const name = type.replace(/\/(pending|fulfilled|rejected)$/, '');
  return type.startsWith('users/') && !READ_ONLY_USER_THUNKS.includes(name);
};

const initialState: UsersState = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
  filters: { search: '', role: '', isActive: '', page: 1, limit: 20 },
  status: 'idle',
  actionStatus: 'idle',
  error: null,
  actionError: null,
  deactivationBlock: null,
  assignable: [],
  reassignTargets: { users: [], projects: [] },
  assignments: { count: 0, stages: [] },
  deactivationPreview: null,
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<UserFilters>>) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearDeactivationBlock(state) {
      state.deactivationBlock = null;
    },
    clearActionError(state) {
      state.actionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.items;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      .addCase(fetchAssignableUsers.fulfilled, (state, action) => {
        state.assignable = action.payload.items;
      })
      .addCase(fetchReassignTargets.fulfilled, (state, action) => {
        state.reassignTargets = action.payload;
      })
      .addCase(fetchUserAssignments.fulfilled, (state, action) => {
        state.assignments = action.payload;
      })
      .addCase(fetchDeactivationPreview.fulfilled, (state, action) => {
        state.deactivationPreview = action.payload;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.items.unshift(action.payload.user);
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        const idx = state.items.findIndex((u) => u.id === action.payload.user.id);
        if (idx >= 0) state.items[idx] = action.payload.user;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.items = state.items.filter((u) => u.id !== action.meta.arg);
      })
      .addCase(reactivateUser.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        const idx = state.items.findIndex((u) => u.id === action.payload.user.id);
        if (idx >= 0) state.items[idx] = action.payload.user;
      })
      .addCase(reassignUser.fulfilled, (state) => {
        state.actionStatus = 'succeeded';
        state.deactivationBlock = null;
      })
      .addCase(deactivateUser.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.deactivationBlock = null;
        const idx = state.items.findIndex((u) => u.id === action.payload.user.id);
        if (idx >= 0) state.items[idx] = action.payload.user;
      })
      .addCase(deactivateUser.rejected, (state, action) => {
        state.actionStatus = 'failed';
        const payload = action.payload as NormalisedApiError | undefined;
        state.actionError = payload?.message ?? null;
        if (payload?.status === 409 && payload?.code === 'USER_HAS_ACTIVE_ASSIGNMENTS') {
          state.deactivationBlock = {
            userId: action.meta.arg.id,
            reason: action.meta.arg.body?.reason || '',
          };

          // The conflict response already includes the authoritative assignment
          // snapshot. Hydrate it immediately so the modal does not briefly show
          // zero/stale assignments while its follow-up request is in flight.
          const details = payload.details as { assignments?: UserAssignments } | null | undefined;
          if (details?.assignments) state.assignments = details.assignments;
        } else {
          state.deactivationBlock = null;
        }
      })
      .addMatcher(
        // Read thunks must not touch actionStatus. The users page loads its list
        // on mount, and every action button there is gated on this flag, so
        // without this the list request would leave Deactivate, Reactivate,
        // Delete and the whole user dialog disabled for the rest of the session.
        (action) => isUserWrite(action.type) && action.type.endsWith('/pending'),
        (state) => {
          state.actionStatus = 'loading';
          state.actionError = null;
        },
      )
      .addMatcher(
        (action) =>
          [
            'users/create/rejected',
            'users/update/rejected',
            'users/delete/rejected',
            'users/reactivate/rejected',
            'users/reassign/rejected',
          ].includes(action.type),
        (state, action: UnknownAction & { payload?: NormalisedApiError }) => {
          state.actionStatus = 'failed';
          state.actionError = action.payload?.message ?? null;
        },
      );
  },
});

export const { setFilters, clearDeactivationBlock, clearActionError } = usersSlice.actions;
export default usersSlice.reducer;
