import type { Request } from 'express';
import type { Types } from 'mongoose';
import Notification from '../models/Notification';
import logger from '../utils/logger';
import { AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/constants';
import { recordAudit, type AuditActor } from './auditService';
import type { StageStatus } from '../types/domain';

type Id = Types.ObjectId | string;

interface NotifyPayload {
  recipient?: Id | null;
  title: string;
  message?: string;
  type?: string;
  entityType?: string;
  entityId?: Id | null;
}

interface StageRef {
  _id?: Id;
  name?: string;
  owner?: Id | null;
  previousOwner?: Id | null;
  dueDate?: Date | string | null;
}

interface ProjectRef {
  name?: string;
  projectManager?: Id | null;
  client?: Id | null;
}

/**
 * In-app notification scaffold. Notifications are purely advisory: they are
 * never allowed to mutate workflow state (manual status rule).
 */
export async function notify({ recipient, title, message = '', type = 'info', entityType = '', entityId = null }: NotifyPayload) {
  if (!recipient) return null;
  try {
    return await Notification.create({ recipient, title, message, type, entityType, entityId });
  } catch (err) {
    logger.error('Failed to create notification', err);
    return null;
  }
}

export const notifyMany = (recipients: Id[] = [], payload: Omit<NotifyPayload, 'recipient'>) =>
  Promise.all(recipients.filter(Boolean).map((r) => notify({ ...payload, recipient: r })));

export async function notifyStageAssignment({
  stage,
  project,
  actor,
  req,
}: {
  stage: StageRef;
  project?: ProjectRef | null;
  actor?: AuditActor | null;
  req?: Request | null;
}) {
  const created = await notify({
    recipient: stage.owner ?? null,
    title: 'New stage assigned to you',
    message: `Stage "${stage.name}" of project ${project?.name || ''} is now assigned to you.`,
    type: 'assignment',
    entityType: ENTITY_TYPES.PROJECT_WORKFLOW_STAGE,
    entityId: stage._id ?? null,
  });

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.PROJECT_WORKFLOW_STAGE,
    entityId: stage._id ?? null,
    entityLabel: `${project?.name || ''} / ${stage.name}`,
    action: AUDIT_ACTIONS.ASSIGNED,
    oldValue: { owner: stage.previousOwner ? String(stage.previousOwner) : null },
    newValue: { owner: String(stage.owner), dueDate: stage.dueDate },
    req,
  });

  return created;
}

export async function notifyStageStatusChange({
  stage,
  project,
  actor,
  fromStatus,
  toStatus,
}: {
  stage: StageRef;
  project?: ProjectRef | null;
  actor?: AuditActor | null;
  fromStatus?: StageStatus | null;
  toStatus?: StageStatus;
}) {
  const recipients = new Set<string>();
  if (project?.projectManager) recipients.add(String(project.projectManager));
  if (project?.client) recipients.add(String(project.client));
  if (actor?.id) recipients.delete(String(actor.id));

  await notifyMany([...recipients], {
    title: 'Stage status updated',
    message: `${project?.name || ''} / ${stage.name}: ${fromStatus || 'None'} → ${toStatus}`,
    type: 'status',
    entityType: ENTITY_TYPES.PROJECT_WORKFLOW_STAGE,
    entityId: stage._id ?? null,
  });
}

export default { notify, notifyMany, notifyStageAssignment, notifyStageStatusChange };
