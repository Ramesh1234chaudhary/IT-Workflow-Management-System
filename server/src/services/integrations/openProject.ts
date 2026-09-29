import env from '../../config/env';
import logger from '../../utils/logger';

/**
 * Phase 2 integration stub - OpenProject.
 *
 * The adapter is intentionally inert unless INTEGRATIONS_ENABLED=true and a base
 * URL is configured. Nothing here is allowed to mutate workflow status: it only
 * mirrors state outwards.
 */
export class OpenProjectAdapter {
  public readonly name: string;
  public readonly baseUrl: string;
  public readonly apiToken: string;
  public readonly enabled: boolean;

  constructor(config = env.integrations.openProject) {
    this.name = 'openproject';
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

  async upsertWorkPackage({ stage }: { project: unknown; stage: { stageKey?: string } | null }) {
    if (!this.enabled) {
      logger.debug(`[integration:openproject] skipped (disabled) stage=${stage?.stageKey}`);
      return { skipped: true, reason: 'integration_disabled' };
    }
    // Phase 2 implementation point: POST /api/v3/work_packages
    return { skipped: true, reason: 'not_implemented' };
  }

  async pushStatus({ stage, toStatus }: { stage: { stageKey?: string } | null; toStatus: string }) {
    if (!this.enabled) {
      logger.debug(`[integration:openproject] status push skipped stage=${stage?.stageKey} -> ${toStatus}`);
      return { skipped: true, reason: 'integration_disabled' };
    }
    return { skipped: true, reason: 'not_implemented' };
  }
}

export const openProjectAdapter = new OpenProjectAdapter();
export default openProjectAdapter;