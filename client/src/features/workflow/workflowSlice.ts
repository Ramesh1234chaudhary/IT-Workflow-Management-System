import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { documentsApi, workflowApi, type AssignStagePayload, type ListParams, type RemarkPayload, type StatusUpdatePayload } from '../../api/api';
import { createApiThunk, type NormalisedApiError } from '../../api/createApiThunk';
import { toApiError } from '../../api/httpClient';
import { STAGE_STATUS, type StageStatus } from '../../utils/constants';
import type { BoardPayload } from '../../api/api';
import type {
  Paginated,
  Project,
  ProjectDocument,
  Stage,
  StatusHistoryEntry,
  WorkflowBoard,
} from '../../types';

export const fetchBoard = createApiThunk<BoardPayload, void>('workflow/board', () => workflowApi.board());
export const fetchStages = createApiThunk<{ stages: Stage[]; project?: Project }, { projectId: string; params: ListParams }>(
  'workflow/stages',
  ({ projectId, params }) => workflowApi.stages(projectId, params),
);
export const fetchStageHistory = createApiThunk<Paginated<StatusHistoryEntry>, { projectId: string; stageId: string; params: ListParams }>(
  'workflow/statusHistory',
  ({ projectId, stageId, params }) => workflowApi.statusHistory(projectId, stageId, params),
);
export const fetchProjectHistory = createApiThunk<Paginated<StatusHistoryEntry>, { projectId: string; params: ListParams }>(
  'workflow/projectHistory',
  ({ projectId, params }) => workflowApi.projectHistory(projectId, params),
);
export const addStageRemark = createApiThunk<{ stage: Stage }, { projectId: string; stageId: string; body: RemarkPayload }>(
  'workflow/addRemark',
  ({ projectId, stageId, body }) => workflowApi.addRemark(projectId, stageId, body),
);
export const assignStage = createApiThunk<{ stage: Stage }, { projectId: string; stageId: string; body: AssignStagePayload }>(
  'workflow/assignStage',
  ({ projectId, stageId, body }) => workflowApi.assignStage(projectId, stageId, body),
);

export interface UpdateStatusArgs {
  projectId: string;
  stageId: string;
  body: StatusUpdatePayload;
  /** Applied instantly on `pending` so the board feels instant. */
  optimistic: Partial<Stage>;
  /** Exact pre-change snapshot, restored on `rejected`. */
  rollback?: Partial<Stage>;
}

interface UpdateStatusResult extends StatusUpdatePayloadResult {
  projectId: string;
  stageId: string;
}

interface StatusUpdatePayloadResult {
  stage: Stage;
  history: StatusHistoryEntry & { pending?: boolean };
  message?: string;
}

type UpdateStatusError = NormalisedApiError & {
  projectId: string;
  stageId: string;
  optimistic: Partial<Stage>;
};

/**
 * Manual status change. The pending reducer applies `optimistic` immediately and
 * the rejected reducer restores `rollback` if the API refuses the transition.
 */
export const updateStageStatus = createAsyncThunk<
  UpdateStatusResult,
  UpdateStatusArgs,
  { rejectValue: UpdateStatusError }
>('workflow/updateStatus', async ({ projectId, stageId, body, optimistic }, { rejectWithValue }) => {
  try {
    const { data } = await workflowApi.updateStatus(projectId, stageId, body);
    return { ...data, projectId, stageId };
  } catch (err) {
    return rejectWithValue({ ...toApiError(err), projectId, stageId, optimistic });
  }
});

export const fetchDocuments = createApiThunk<Paginated<ProjectDocument>, { projectId: string; params: ListParams }>(
  'documents/list',
  ({ projectId, params }) => documentsApi.list(projectId, params),
);
export const uploadDocument = createApiThunk<{ document: ProjectDocument }, { projectId: string; formData: FormData }>(
  'documents/upload',
  ({ projectId, formData }) => documentsApi.upload(projectId, formData),
);
export const deleteDocument = createApiThunk<{ message: string }, string>('documents/delete', (documentId) =>
  documentsApi.remove(documentId),
);

const applyStagePatch = (stages: Stage[], stageId: string, patch: Partial<Stage>): Stage[] =>
  stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s));

const emptyBoard: WorkflowBoard = { projects: [], stages: [], summary: {} } as unknown as WorkflowBoard;

export interface BoardFilters {
  mine: boolean;
  status: string;
  projectId: string;
}

export interface WorkflowState {
  board: WorkflowBoard;
  boardStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  boardFilters: BoardFilters;
  stages: Stage[];
  stagesStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  history: StatusHistoryEntry[];
  historyStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  documents: ProjectDocument[];
  documentsStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  pendingStatusIds: string[];
  actionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  actionError: string | null;
}

const initialState: WorkflowState = {
  board: emptyBoard,
  boardStatus: 'idle',
  boardFilters: { mine: false, status: '', projectId: '' },
  stages: [],
  stagesStatus: 'idle',
  history: [],
  historyStatus: 'idle',
  documents: [],
  documentsStatus: 'idle',
  pendingStatusIds: [],
  actionStatus: 'idle',
  error: null,
  actionError: null,
};

/** Derives the board summary from the current stage list. */
const summarise = (stages: Stage[]): WorkflowBoard['summary'] => {
  const counts: Partial<Record<StageStatus, number>> = {};
  stages.forEach((s) => {
    counts[s.status] = (counts[s.status] ?? 0) + 1;
  });
  return { ...counts, total: stages.length } as WorkflowBoard['summary'];
};

const workflowSlice = createSlice({
  name: 'workflow',
  initialState,
  reducers: {
    setBoardFilters(state, action: PayloadAction<Partial<BoardFilters>>) {
      state.boardFilters = { ...state.boardFilters, ...action.payload };
    },
    clearWorkflowError(state) {
      state.actionError = null;
    },
    resetWorkflowState() {
      return initialState;
    },
    clearHistory(state) {
      state.history = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoard.pending, (state) => {
        state.boardStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchBoard.fulfilled, (state, action) => {
        state.boardStatus = 'succeeded';
        state.board = action.payload as unknown as WorkflowBoard;
      })
      .addCase(fetchBoard.rejected, (state, action) => {
        state.boardStatus = 'failed';
        state.error = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      .addCase(fetchStages.pending, (state) => {
        state.stagesStatus = 'loading';
      })
      .addCase(fetchStages.fulfilled, (state, action) => {
        state.stagesStatus = 'succeeded';
        state.stages = action.payload.stages;
      })
      .addCase(fetchStages.rejected, (state, action) => {
        state.stagesStatus = 'failed';
        state.error = (action.payload as NormalisedApiError | undefined)?.message ?? null;
      })
      /* ---- optimistic update: applied immediately on `updateStageStatus.pending` ---- */
      .addCase(updateStageStatus.pending, (state, action) => {
        const { stageId, optimistic } = action.meta.arg;
        state.pendingStatusIds.push(stageId);
        state.actionStatus = 'loading';
        state.actionError = null;
        state.board.stages = applyStagePatch(state.board.stages, stageId, optimistic);
        state.stages = applyStagePatch(state.stages, stageId, optimistic);
      })
      .addCase(updateStageStatus.fulfilled, (state, action) => {
        const { stage, history } = action.payload;
        state.pendingStatusIds = state.pendingStatusIds.filter((id) => id !== stage.id);
        state.actionStatus = 'succeeded';
        state.board.stages = applyStagePatch(state.board.stages, stage.id, {
          ...stage,
          progressPercent: stage.status === STAGE_STATUS.COMPLETED ? 100 : stage.status === STAGE_STATUS.IN_PROGRESS ? 50 : 0,
        });
        state.stages = applyStagePatch(state.stages, stage.id, stage);
        state.history.unshift({ ...history, pending: false });
        state.board.summary = summarise(state.board.stages);
      })
      /* ---- rollback: restore the exact snapshot taken before the optimistic patch ---- */
      .addCase(updateStageStatus.rejected, (state, action) => {
        const { stageId, rollback, optimistic } = action.meta.arg;
        const patch = rollback ?? optimistic;
        state.pendingStatusIds = state.pendingStatusIds.filter((id) => id !== stageId);
        state.actionStatus = 'failed';
        state.actionError = (action.payload as UpdateStatusError | undefined)?.message ?? null;
        state.board.stages = applyStagePatch(state.board.stages, stageId, patch);
        state.stages = applyStagePatch(state.stages, stageId, patch);
      })
      .addCase(fetchStageHistory.pending, (state) => {
        state.historyStatus = 'loading';
      })
      .addCase(fetchStageHistory.fulfilled, (state, action) => {
        state.historyStatus = 'succeeded';
        state.history = action.payload.items;
      })
      .addCase(fetchProjectHistory.fulfilled, (state, action) => {
        state.historyStatus = 'succeeded';
        state.history = action.payload.items;
      })
      .addCase(addStageRemark.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        const { id, status, internalRemarks } = action.payload.stage;
        state.stages = applyStagePatch(state.stages, id, { status, internalRemarks });
      })
      .addCase(assignStage.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        const stage = action.payload.stage;
        state.stages = applyStagePatch(state.stages, stage.id, stage);
      })
      .addCase(fetchDocuments.pending, (state) => {
        state.documentsStatus = 'loading';
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.documentsStatus = 'succeeded';
        state.documents = action.payload.items;
      })
      .addCase(uploadDocument.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.documents.unshift(action.payload.document);
        // Uploading a document must never touch `status` - intentionally omitted.
      })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        state.documents = state.documents.filter((d) => d.id !== action.meta.arg);
      });
  },
});

export const { setBoardFilters, clearWorkflowError, resetWorkflowState, clearHistory } = workflowSlice.actions;
export default workflowSlice.reducer;
