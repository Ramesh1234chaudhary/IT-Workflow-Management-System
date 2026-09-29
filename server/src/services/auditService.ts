import type { Request } from 'express';
import type { Types } from 'mongoose';
import AuditLog from '../models/AuditLog';
import logger from '../utils/logger';
import { toPlain, type JsonRecord } from '../utils/helpers';
import type { AuditAction, EntityType } from '../types/domain';

/** Whatever the caller has to hand: a Mongoose doc, a `req.user`, or a plain id holder. */
export interface AuditActor {
  _id?: Types.ObjectId | string;
  id?: string;
  name?: string;
  email?: string;
  roleSnapshot?: { name?: string } | null;
  roleName?: string;
}

export interface RecordAuditInput {
  actor?: AuditActor | null;
  entityType: EntityType | string;
  entityId?: Types.ObjectId | string | null;
  entityLabel?: string;
  action: AuditAction | string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  req?: Request | null;
}

/**
 * Append-only audit writer. Never throws into the request lifecycle: a failed
 * audit write is logged but must not roll back the business transaction that
 * already succeeded.
 */
export async function recordAudit({
  actor = null,
  entityType,
  entityId = null,
  entityLabel = '',
  action,
  oldValue = null,
  newValue = null,
  metadata = null,
  req = null,
}: RecordAuditInput) {
  try {
    const [created] = await AuditLog.create([
      {
        actor: actor?._id || actor?.id || null,
        actorName: actor?.name || 'System',
        actorEmail: actor?.email || '',
        actorRole: actor?.roleSnapshot?.name || actor?.roleName || '',
        entityType,
        entityId: entityId || null,
        entityLabel: entityLabel || '',
        action,
        oldValue: toPlain(oldValue),
        newValue: toPlain(newValue),
        metadata: metadata ? toPlain(metadata) : null,
        ip: req?.ip || req?.socket?.remoteAddress || '',
        userAgent: req?.get?.('user-agent') || '',
      },
    ]);
    return created;
  } catch (err) {
    logger.error('Failed to write audit log entry', err);
    return null;
  }
}

export const auditFromRequest = (req?: Request | null): { actor: AuditActor | null; req: Request | null } =>
  req?.user
    ? {
        actor: {
          _id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          roleSnapshot: { name: req.user.roleName },
        },
        req,
      }
    : { actor: null, req: req ?? null };

export type { JsonRecord };
export default { recordAudit, auditFromRequest };
