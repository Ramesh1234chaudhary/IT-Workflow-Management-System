export const STAGE_STATUS = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
} as const;

/** Union of every legal stage status, so `keyof` lookups and switches stay closed. */
export type StageStatus = (typeof STAGE_STATUS)[keyof typeof STAGE_STATUS];

/** MUI Chip colours used across the app for status and priority pills. */
export type StatusColor = 'default' | 'primary' | 'info' | 'warning' | 'error' | 'success';

export const STAGE_STATUS_VALUES: readonly StageStatus[] = Object.values(STAGE_STATUS);

/** Mirrors the backend STATUS_RULES table so the UI can drive conditional fields. */
export const STATUS_REQUIRED_FIELDS: Partial<Record<StageStatus, readonly string[]>> = {
  [STAGE_STATUS.BLOCKED]: ['blocker'],
  [STAGE_STATUS.ON_HOLD]: ['holdReason'],
  [STAGE_STATUS.COMPLETED]: ['completionDate'],
};

export const STATUS_COLOR: Record<StageStatus, StatusColor> = {
  [STAGE_STATUS.NOT_STARTED]: 'default',
  [STAGE_STATUS.IN_PROGRESS]: 'primary',
  [STAGE_STATUS.ON_HOLD]: 'warning',
  [STAGE_STATUS.BLOCKED]: 'error',
  [STAGE_STATUS.COMPLETED]: 'success',
};

export const PROJECT_STATUS = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

export const PRIORITY_VALUES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type Priority = (typeof PRIORITY_VALUES)[number];

export const PRIORITY_COLOR: Record<Priority, StatusColor> = {
  Low: 'default',
  Medium: 'info',
  High: 'warning',
  Critical: 'error',
};

export const SOP_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type SopStatus = (typeof SOP_STATUS)[keyof typeof SOP_STATUS];

export const SOP_STATUS_COLOR: Record<SopStatus, StatusColor> = {
  draft: 'warning',
  published: 'success',
  archived: 'default',
};

export const ENTITY_TYPES = [
  'User',
  'Role',
  'Permission',
  'SOPTemplate',
  'SOPVersion',
  'Project',
  'ProjectWorkflowStage',
  'StageStatusHistory',
  'Document',
  'Auth',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const AUDIT_ACTION_COLOR: Record<string, StatusColor> = {
  created: 'success',
  updated: 'info',
  deleted: 'error',
  status_changed: 'primary',
  published: 'success',
  assigned: 'info',
  reassigned: 'warning',
  deactivated: 'error',
  activated: 'success',
  login: 'default',
  logout: 'default',
  token_refreshed: 'default',
  document_uploaded: 'info',
  document_deleted: 'error',
  remark_added: 'default',
};

/** Route a freshly authenticated user lands on. Uses permissions, not role names. */
export const DEFAULT_ROUTE_PERMISSIONS: readonly { permission: string; path: string }[] = [
  { permission: 'sop:publish', path: '/sop' },
  { permission: 'project:create', path: '/projects' },
  { permission: 'stage:updateStatus', path: '/board' },
  { permission: 'project:read', path: '/client' },
];
