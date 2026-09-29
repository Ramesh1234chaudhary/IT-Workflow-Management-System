import { createSlice } from '@reduxjs/toolkit';
import { reportsApi, type ListParams, type StageDistribution, type WorkloadReport } from '../../api/api';
import { createApiThunk, type NormalisedApiError } from '../../api/createApiThunk';
import type { ProgressTotals, ProjectProgressRow, SummaryReport } from '../../types';

export const fetchSummary = createApiThunk<SummaryReport>('reports/summary', () => reportsApi.summary());
export const fetchProjectProgress = createApiThunk<{ items: ProjectProgressRow[]; totals: ProgressTotals }, ListParams>(
  'reports/progress',
  (params) => reportsApi.projectProgress(params),
);
export const fetchStageDistribution = createApiThunk<StageDistribution>('reports/distribution', () =>
  reportsApi.stageDistribution(),
);
export const fetchWorkload = createApiThunk<WorkloadReport>('reports/workload', () => reportsApi.workload());

export interface ReportsState {
  summary: SummaryReport | null;
  progress: { items: ProjectProgressRow[]; totals: ProgressTotals } | null;
  distribution: StageDistribution | null;
  workload: WorkloadReport | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: ReportsState = {
  summary: null,
  progress: null,
  distribution: null,
  workload: null,
  status: 'idle',
  error: null,
};

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    resetReports: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSummary.fulfilled, (state, action) => {
        state.summary = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchProjectProgress.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchProjectProgress.fulfilled, (state, action) => {
        state.progress = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchProjectProgress.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      .addCase(fetchStageDistribution.fulfilled, (state, action) => {
        state.distribution = action.payload;
      })
      .addCase(fetchWorkload.fulfilled, (state, action) => {
        state.workload = action.payload;
      });
  },
});

export const { resetReports } = reportsSlice.actions;
export default reportsSlice.reducer;
