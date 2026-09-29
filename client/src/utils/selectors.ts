import { createSelector } from '@reduxjs/toolkit';
import { STAGE_STATUS, STAGE_STATUS_VALUES, SOP_STATUS, type StageStatus } from './constants';
import type { RootState } from '../app/store';
import type {
  AuditLogEntry,
  BoardStage,
  Project,
  ProjectDocument,
  Stage,
  SopTemplate,
  UserSummary,
} from '../types';

const STATUS_WEIGHT: Record<StageStatus, number> = {
  [STAGE_STATUS.NOT_STARTED]: 0,
  [STAGE_STATUS.IN_PROGRESS]: 50,
  [STAGE_STATUS.ON_HOLD]: 25,
  [STAGE_STATUS.BLOCKED]: 25,
  [STAGE_STATUS.COMPLETED]: 100,
};

const emptyByStatus = (): Record<StageStatus, Stage[]> =>
  STAGE_STATUS_VALUES.reduce((acc, status) => ({ ...acc, [status]: [] }), {} as Record<StageStatus, Stage[]>);

/* ------------------------------ Board selectors ----------------------------- */

export const selectBoardStages = (state: RootState): BoardStage[] => state.workflow.board.stages ?? [];
export const selectBoardProjects = (state: RootState): Project[] => state.workflow.board.projects ?? [];
export const selectBoardFilters = (state: RootState) => state.workflow.boardFilters;
export const selectPendingStatusIds = (state: RootState): string[] => state.workflow.pendingStatusIds;

/** `Stage.project` is a raw id on some endpoints and a populated ref on others. */
const projectIdOf = (stage: BoardStage): string =>
  typeof stage.project === 'string' ? stage.project : (stage.project?._id ?? stage.project?.id ?? '');

export const selectFilteredBoardStages = createSelector([selectBoardStages, selectBoardFilters], (stages, filters) => {
  let result = stages;
  if (filters.status) result = result.filter((s) => s.status === filters.status);
  if (filters.projectId) result = result.filter((s) => projectIdOf(s) === filters.projectId);
  if (filters.mine) result = result.filter((s) => s.isMine || String(s.ownerId ?? s.owner?.id) === String(s.ownerId));
  return result;
});

export const selectBoardStats = createSelector([selectFilteredBoardStages], (stages) => {
  const byStatus = STAGE_STATUS_VALUES.reduce(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as Record<StageStatus, number>,
  );
  let completed = 0;
  let overdue = 0;
  let unassigned = 0;

  stages.forEach((stage) => {
    byStatus[stage.status] = (byStatus[stage.status] ?? 0) + 1;
    if (stage.status === STAGE_STATUS.COMPLETED) completed += 1;
    if (stage.dueDate && stage.status !== STAGE_STATUS.COMPLETED && new Date(stage.dueDate) < new Date()) overdue += 1;
    if (!stage.owner) unassigned += 1;
  });

  const total = stages.length;
  const progressPercent = total
    ? Math.round(stages.reduce((sum, s) => sum + (STATUS_WEIGHT[s.status] ?? 0), 0) / total)
    : 0;

  return { total, byStatus, completed, overdue, unassigned, progressPercent };
});

export const selectStagesByStatus = createSelector([selectFilteredBoardStages], (stages) => {
  const grouped = emptyByStatus();
  stages.forEach((stage) => {
    grouped[stage.status]?.push(stage);
  });
  return grouped;
});

/* ----------------------------- Project selectors ---------------------------- */

export const selectProjectItems = (state: RootState): Project[] => state.projects.items;
export const selectProjectCurrent = (state: RootState): Project | null => state.projects.current;

export const selectProjectStages = createSelector([selectProjectCurrent], (project): Stage[] => project?.stages ?? []);

export const selectProjectStats = createSelector([selectProjectStages], (stages) => {
  const total = stages.length;
  const completed = stages.filter((s) => s.status === STAGE_STATUS.COMPLETED).length;
  const byStatus = STAGE_STATUS_VALUES.reduce(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as Record<StageStatus, number>,
  );
  stages.forEach((s) => {
    byStatus[s.status] += 1;
  });
  return {
    total,
    completed,
    remaining: total - completed,
    byStatus,
    progressPercent: total ? Math.round((completed / total) * 100) : 0,
  };
});

export const selectProjectDocuments = (state: RootState): ProjectDocument[] => state.workflow.documents;

/* --------------------------- User directory selectors ---------------------- */

export const selectAssignableUsers = (state: RootState): UserSummary[] => state.users.assignable;
export const selectInternalUsers = createSelector([selectAssignableUsers], (users) =>
  users.filter((u) => !u.role?.isClientScoped),
);
export const selectClientUsers = createSelector([selectAssignableUsers], (users) =>
  users.filter((u) => u.role?.isClientScoped),
);

/* ------------------------------ SOP selectors ------------------------------- */

export const selectSOPItems = (state: RootState): SopTemplate[] => state.sop.items;
export const selectCurrentTemplate = (state: RootState): SopTemplate | null => state.sop.current;
export const selectTemplateVersions = (state: RootState) => state.sop.versions;

export const selectTemplateStats = createSelector([selectCurrentTemplate], (template) => {
  const stages = template?.stages ?? [];
  return {
    total: stages.length,
    clientVisible: stages.filter((s) => s.clientVisible).length,
    internal: stages.filter((s) => !s.clientVisible).length,
    isDraft: template?.status === SOP_STATUS.DRAFT,
    version: template?.currentVersion || 0,
  };
});

/* ------------------------------ Audit selectors ----------------------------- */

export const selectAuditItems = (state: RootState): AuditLogEntry[] => state.audit.items;

export const selectAuditEntityBreakdown = createSelector([selectAuditItems], (items) => {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.entityType] = (acc[item.entityType] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([entityType, count]) => ({ entityType, count }))
    .sort((a, b) => b.count - a.count);
});
