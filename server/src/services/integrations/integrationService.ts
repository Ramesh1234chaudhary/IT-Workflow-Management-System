import env from '../../config/env';
import { openProjectAdapter } from './openProject';
import { timesheetAdapter } from './timesheet';

export { openProjectAdapter, timesheetAdapter };

export const integrationStatus = () => ({
  enabled: env.integrations.enabled,
  adapters: [openProjectAdapter.status, timesheetAdapter.status],
});

interface StageStatusChangedInput {
  stage: { stageKey?: string };
  project: unknown;
  fromStatus: string;
  toStatus: string;
}

/** Fire-and-forget hook invoked after a manual status change. Never throws. */
export async function onStageStatusChanged({ stage, project, toStatus }: StageStatusChangedInput) {
  try {
    await openProjectAdapter.pushStatus({ stage, project, toStatus } as Parameters<
      typeof openProjectAdapter.pushStatus
    >[0]);
  } catch {
    // integrations must never break the primary transaction
  }
}

export default { openProjectAdapter, timesheetAdapter, integrationStatus, onStageStatusChanged };