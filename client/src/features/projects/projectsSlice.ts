import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  projectsApi,
  type CreateProjectPayload,
  type ListParams,
  type ProjectOptions,
} from '../../api/api';
import { createApiThunk, type NormalisedApiError } from '../../api/createApiThunk';
import type { Paginated, Project, SopStageDefinition } from '../../types';

export const fetchProjects = createApiThunk<Paginated<Project>, ListParams>('projects/fetchAll', (params) =>
  projectsApi.list(params),
);
export const fetchProjectOptions = createApiThunk<{ items: ProjectOptions[] }>('projects/options', () =>
  projectsApi.options(),
);
export const fetchProject = createApiThunk<{ project: Project; meta: { filtered: boolean; scope: string } }, string>(
  'projects/fetchOne',
  (id) => projectsApi.get(id),
);
export const createProject = createApiThunk<{ project: Project; message?: string }, CreateProjectPayload>(
  'projects/create',
  (body) => projectsApi.create(body),
);
export const updateProject = createApiThunk<{ project: Project }, { id: string; body: Partial<CreateProjectPayload> }>(
  'projects/update',
  ({ id, body }) => projectsApi.update(id, body),
);
export const deleteProject = createApiThunk<{ message: string }, string>('projects/delete', (id) => projectsApi.remove(id));
export const previewStages = createApiThunk<
  { stages: SopStageDefinition[] },
  { sopTemplate: string; startDate?: string; targetEndDate?: string | null }
>('projects/preview', (body) => projectsApi.preview(body));

export const assignStages = createApiThunk<
  { project: Project },
  { id: string; assignments: { stageId: string; owner: string | null; dueDate?: string | null }[] }
>('projects/assign', ({ id, assignments }) => projectsApi.assignStages(id, assignments));
export interface ProjectFilters {
  search: string;
  status: string;
  priority: string;
  page: number;
  limit: number;
}

export interface ProjectsState {
  items: Project[];
  current: Project | null;
  currentMeta: { filtered: boolean; scope: string } | null;
  options: ProjectOptions[];
  pagination: import('../../types').Pagination;
  filters: ProjectFilters;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  actionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  actionError: string | null;
  preview: { stages: SopStageDefinition[] } | null;
  lastCreated: { project: Project; message?: string } | null;
}

const initialState: ProjectsState = {
  items: [],
  current: null,
  currentMeta: null,
  options: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
  filters: { search: '', status: '', priority: '', page: 1, limit: 12 },
  status: 'idle',
  actionStatus: 'idle',
  error: null,
  actionError: null,
  preview: null,
  lastCreated: null,
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<ProjectFilters>>) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearProjectError(state) {
      state.actionError = null;
    },
    clearPreview(state) {
      state.preview = null;
    },
    clearCurrent(state) {
      state.current = null;
      state.currentMeta = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.items;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      .addCase(fetchProjectOptions.fulfilled, (state, action) => {
        state.options = action.payload.items;
      })
      .addCase(fetchProject.fulfilled, (state, action) => {
        state.current = action.payload.project;
        state.currentMeta = action.payload.meta;
      })
      .addCase(previewStages.pending, (state) => {
        state.actionStatus = 'loading';
        state.actionError = null;
      })
      .addCase(previewStages.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.preview = action.payload;
      })
      .addCase(previewStages.rejected, (state, action) => {
        state.actionStatus = 'failed';
        state.actionError = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      .addCase(createProject.pending, (state) => {
        state.actionStatus = 'loading';
        state.actionError = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.lastCreated = action.payload;
        state.items.unshift(action.payload.project);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.actionStatus = 'failed';
        state.actionError = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      .addCase(updateProject.pending, (state) => {
        state.actionStatus = 'loading';
        state.actionError = null;
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.current = action.payload.project;
        const idx = state.items.findIndex((p) => p.id === action.payload.project.id);
        if (idx >= 0) state.items[idx] = action.payload.project;
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.actionStatus = 'failed';
        state.actionError = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      .addCase(deleteProject.pending, (state) => {
        state.actionStatus = 'loading';
        state.actionError = null;
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.items = state.items.filter((p) => p.id !== action.meta.arg);
        if (state.current?.id === action.meta.arg) state.current = null;
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.actionStatus = 'failed';
        state.actionError = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      .addCase(assignStages.pending, (state) => {
        state.actionStatus = 'loading';
        state.actionError = null;
      })
      .addCase(assignStages.fulfilled, (state) => {
        state.actionStatus = 'succeeded';
      })
      .addCase(assignStages.rejected, (state, action) => {
        state.actionStatus = 'failed';
        state.actionError = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      });
  },
});

export const { setFilters, clearProjectError, clearPreview, clearCurrent } = projectsSlice.actions;
export default projectsSlice.reducer;
