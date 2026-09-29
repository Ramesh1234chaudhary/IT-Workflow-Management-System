import { createSlice, type UnknownAction } from '@reduxjs/toolkit';
import { rolesApi, type RolePayload } from '../../api/api';
import { createApiThunk, type NormalisedApiError } from '../../api/createApiThunk';
import type { Permission, PermissionMatrix, Role } from '../../types';

export const fetchRoles = createApiThunk<{ items: Role[] }>('roles/fetch', () => rolesApi.list());
export const fetchPermissions = createApiThunk<{ items: Permission[]; modules: string[] }>(
  'roles/permissions',
  () => rolesApi.permissions(),
);
export const fetchPermissionMatrix = createApiThunk<PermissionMatrix>('roles/matrix', () => rolesApi.matrix());
export const createRole = createApiThunk<{ role: Role }, RolePayload>('roles/create', (body) => rolesApi.create(body));
export const updateRole = createApiThunk<{ role: Role }, { id: string; body: RolePayload }>(
  'roles/update',
  ({ id, body }) => rolesApi.update(id, body),
);
export const deleteRole = createApiThunk<{ message: string }, string>('roles/delete', (id) => rolesApi.remove(id));

export interface RolesState {
  items: Role[];
  permissions: Permission[];
  modules: string[];
  matrix: PermissionMatrix | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  actionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  actionError: string | null;
}

const initialState: RolesState = {
  items: [],
  permissions: [],
  modules: [],
  matrix: null,
  status: 'idle',
  actionStatus: 'idle',
  error: null,
  actionError: null,
};

type RejectedAction = UnknownAction & { payload?: NormalisedApiError };

const rolesSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    clearRoleError(state) {
      state.actionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.items;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        state.permissions = action.payload.items;
        state.modules = action.payload.modules;
      })
      .addCase(fetchPermissionMatrix.fulfilled, (state, action) => {
        state.matrix = action.payload;
      })
      .addCase(createRole.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.items.push(action.payload.role);
      })
      .addCase(updateRole.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        const idx = state.items.findIndex((r) => r.id === action.payload.role.id);
        if (idx >= 0) state.items[idx] = action.payload.role;
      })
      .addCase(deleteRole.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.items = state.items.filter((r) => r.id !== action.meta.arg);
      })
      .addMatcher(
        (a) => ['roles/create/pending', 'roles/update/pending', 'roles/delete/pending'].includes(a.type),
        (state) => {
          state.actionStatus = 'loading';
          state.actionError = null;
        },
      )
      .addMatcher(
        (a) => ['roles/create/rejected', 'roles/update/rejected', 'roles/delete/rejected'].includes(a.type),
        (state, action: RejectedAction) => {
          state.actionStatus = 'failed';
          state.actionError = action.payload?.message ?? null;
        },
      );
  },
});

export const { clearRoleError } = rolesSlice.actions;
export default rolesSlice.reducer;
