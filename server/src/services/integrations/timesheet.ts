import env from '../../config/env';
import logger from '../../utils/logger';

/**
 * Phase 2 integration stub - Timesheet system.
 * Reporting-only adapter; it never writes back into the workflow.
 */
export class TimesheetAdapter {
  public readonly name: string;
  public readonly baseUrl: string;
  public readonly apiToken: string;
  public readonly enabled: boolean;

  constructor(config = env.integrations.timesheet) {
    this.name = 'timesheet';
    this.baseUrl = config.baseUrl;
    this.apiToken = config.apiToken;
    this.enabled = env.integrations.enabled && Boolean(this.baseUrl && this.apiToken);
  }

  get status() {
    return {
      name: this.name,
      enabled: this.enabled,
      configured: Boolean(this.baseUrl && this.apiToken),
      baseUrl: this.baseUrl || null,
    };
  }

  async createEntry({
    stage,
  }: {
    user: unknown;
    stage: { stageKey?: string } | null;
    hours: number;
    date: Date | string;
  }) {
    if (!this.enabled) {
      logger.debug(`[integration:timesheet] entry skipped stage=${stage?.stageKey}`);
      return { skipped: true, reason: 'integration_disabled' };
    }
    return { skipped: true, reason: 'not_implemented' };
  }

  async fetchTimesheet(_range: { user: unknown; from: Date | string; to: Date | string }) {
    if (!this.enabled) return { skipped: true, reason: 'integration_disabled' };
    return { skipped: true, reason: 'not_implemented' };
  }
}

export const timesheetAdapter = new TimesheetAdapter();
export default timesheetAdapter;