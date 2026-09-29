import { createSlice, type UnknownAction } from '@reduxjs/toolkit';
import { sopApi, type ListParams, type StagePayload } from '../../api/api';
import { createApiThunk, type NormalisedApiError } from '../../api/createApiThunk';
import type { Paginated, SopTemplate, SopVersion } from '../../types';

export const fetchTemplates = createApiThunk<Paginated<SopTemplate>, ListParams>('sop/fetchAll', (params) =>
  sopApi.list(params),
);
export const fetchTemplate = createApiThunk<{ template: SopTemplate }, string>('sop/fetchOne', (id) => sopApi.get(id));
export const fetchVersions = createApiThunk<{ items: SopVersion[] }, string>('sop/versions', (id) => sopApi.versions(id));
export const createTemplate = createApiThunk<{ template: SopTemplate }, Partial<SopTemplate>>(
  'sop/create',
  (body) => sopApi.create(body),
);
export const updateTemplate = createApiThunk<{ template: SopTemplate }, { id: string; body: Partial<SopTemplate> }>(
  'sop/update',
  ({ id, body }) => sopApi.update(id, body),
);
export const deleteTemplate = createApiThunk<{ message: string }, string>('sop/delete', (id) => sopApi.remove(id));
export const addStage = createApiThunk<{ template: SopTemplate }, { id: string; body: StagePayload }>(
  'sop/addStage',
  ({ id, body }) => sopApi.addStage(id, body),
);
export const updateStage = createApiThunk<
  { template: SopTemplate },
  { id: string; stageId: string; body: Partial<StagePayload> }
>('sop/updateStage', ({ id, stageId, body }) => sopApi.updateStage(id, stageId, body));
export const deleteStage = createApiThunk<{ template: SopTemplate }, { id: string; stageId: string }>(
  'sop/deleteStage',
  ({ id, stageId }) => sopApi.deleteStage(id, stageId),
);
export const reorderStages = createApiThunk<{ template: SopTemplate }, { id: string; stageIds: string[] }>(
  'sop/reorder',
  ({ id, stageIds }) => sopApi.reorderStages(id, stageIds),
);
export const publishTemplate = createApiThunk<
  { template: SopTemplate; version: SopVersion },
  { id: string; body: { changeNote?: string } }
>('sop/publish', ({ id, body }) => sopApi.publish(id, body));
export const createDraft = createApiThunk<{ template: SopTemplate }, string>('sop/draft', (id) => sopApi.createDraft(id));

export interface SopState {
  items: SopTemplate[];
  current: SopTemplate | null;
  versions: SopVersion[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  actionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  actionError: string | null;
  lastPublished: SopVersion | null;
}

const initialState: SopState = {
  items: [],
  current: null,
  versions: [],
  status: 'idle',
  actionStatus: 'idle',
  error: null,
  actionError: null,
  lastPublished: null,
};

const upsertTemplate = (state: SopState, template: SopTemplate) => {
  const idx = state.items.findIndex((t) => t.id === template.id);
  if (idx >= 0) state.items[idx] = template;
  else state.items.unshift(template);
  state.current = template;
};

/** Thunks that only read, so they must never claim the shared action flag. */
const READ_ONLY_SOP_THUNKS = ['sop/fetchAll', 'sop/fetchOne', 'sop/versions'];

const isSopWrite = (type: string): boolean => {
  const name = type.replace(/\/(pending|fulfilled|rejected)$/, '');
  return type.startsWith('sop/') && !READ_ONLY_SOP_THUNKS.includes(name);
};

const sopSlice = createSlice({
  name: 'sop',
  initialState,
  reducers: {
    clearSopError(state) {
      state.actionError = null;
    },
    clearCurrentTemplate(state) {
      state.current = null;
      state.versions = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.items;
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      .addCase(fetchTemplate.fulfilled, (state, action) => {
        upsertTemplate(state, action.payload.template);
      })
      .addCase(fetchVersions.fulfilled, (state, action) => {
        state.versions = action.payload.items;
      })
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        upsertTemplate(state, action.payload.template);
      })
      .addCase(updateTemplate.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        upsertTemplate(state, action.payload.template);
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.items = state.items.filter((t) => t.id !== action.meta.arg);
        if (state.current?.id === action.meta.arg) state.current = null;
      })
      .addCase(addStage.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        upsertTemplate(state, action.payload.template);
      })
      .addCase(updateStage.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        upsertTemplate(state, action.payload.template);
      })
      .addCase(deleteStage.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        upsertTemplate(state, action.payload.template);
      })
      .addCase(reorderStages.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        upsertTemplate(state, action.payload.template);
      })
      .addCase(publishTemplate.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.lastPublished = action.payload.version;
        upsertTemplate(state, action.payload.template);
        state.versions = [action.payload.version, ...state.versions];
      })
      .addCase(createDraft.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        upsertTemplate(state, action.payload.template);
      })
      .addMatcher(
        // Reads must not claim the shared action flag. The rejected matcher
        // below already exempts the read thunks, but the pending one did not,
        // so listing templates on mount left actionStatus on 'loading' with
        // nothing in flight — and every SOP button is gated on it, Publish
        // included.
        (a) => isSopWrite(a.type) && a.type.endsWith('/pending'),
        (state) => {
          state.actionStatus = 'loading';
          state.actionError = null;
        },
      )
      .addMatcher(
        (a) => isSopWrite(a.type) && a.type.endsWith('/rejected'),
        (state, action: UnknownAction & { payload?: NormalisedApiError }) => {
          state.actionStatus = 'failed';
          state.actionError = action.payload?.message ?? null;
        },
      );
  },
});

export const { clearSopError, clearCurrentTemplate } = sopSlice.actions;
export default sopSlice.reducer;
