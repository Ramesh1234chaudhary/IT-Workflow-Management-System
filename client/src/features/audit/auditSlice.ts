import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { auditApi, type ListParams } from '../../api/api';
import { createApiThunk, type NormalisedApiError } from '../../api/createApiThunk';
import type { AuditLogEntry } from '../../types';

export const fetchAuditLogs = createApiThunk<{ items: AuditLogEntry[]; pagination: import('../../types').Pagination }, ListParams>(
  'audit/fetch',
  (params) => auditApi.list(params),
);
export const fetchAuditFacets = createApiThunk<import('../../api/api').AuditFacets>('audit/facets', () => auditApi.facets());

export interface AuditFilters {
  page: number;
  limit: number;
  entityType: string;
  action: string;
  actor: string;
  from: string;
  to: string;
  search: string;
}

export const initialAuditFilters: AuditFilters = {
  page: 1,
  limit: 20,
  entityType: '',
  action: '',
  actor: '',
  from: '',
  to: '',
  search: '',
};

export interface AuditState {
  items: AuditLogEntry[];
  pagination: import('../../types').Pagination;
  filters: AuditFilters;
  facets: import('../../api/api').AuditFacets;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: AuditState = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
  filters: { ...initialAuditFilters },
  facets: { entityTypes: [], actions: [] },
  status: 'idle',
  error: null,
};

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {
    setAuditFilters(state, action: PayloadAction<Partial<AuditFilters>>) {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetAuditFilters(state) {
      state.filters = { ...initialAuditFilters };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLogs.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.items;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      .addCase(fetchAuditFacets.fulfilled, (state, action) => {
        state.facets = { entityTypes: action.payload.entityTypes, actions: action.payload.actions };
      });
  },
});

export const { setAuditFilters, resetAuditFilters } = auditSlice.actions;
export default auditSlice.reducer;
