import type { NextFunction, Request, Response } from 'express';
import { CLIENT_FORBIDDEN_FIELDS, CLIENT_FORBIDDEN_KEYS } from '../utils/constants';

/**
 * ---------------------------------------------------------------------------
 * filterClientData - server side data protection for Client / Operations
 * ---------------------------------------------------------------------------
 *
 * The user is authorised by a DATABASE DRIVEN role flag (`role.isClientScoped`),
 * never by a hard coded role name.
 *
 * For those accounts this middleware intercepts every JSON response produced
 * downstream and removes, at the API boundary:
 *   - documents / document metadata
 *   - audit data and activity trails
 *   - internal remarks, blockers, hold reasons, escalation notes
 *   - any stage flagged clientVisible = false
 *   - security fields (password hashes, token material, refresh tokens)
 *
 * The data never leaves the server. Hiding tabs in the UI is a convenience on
 * top of this, not the control itself.
 */

const FORBIDDEN_FIELDS = new Set(CLIENT_FORBIDDEN_FIELDS);
const FORBIDDEN_KEYS = new Set(CLIENT_FORBIDDEN_KEYS);

/**
 * `isPlainObject` must be strict: BSON values (ObjectId, Decimal128) and class
 * instances are objects too, but they must be passed through untouched instead
 * of being rebuilt key by key.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const idOf = (value: unknown): string | null =>
  isPlainObject(value) && (value._id || value.id) ? String(value._id || value.id) : null;

/** Recognises a serialized workflow stage by shape, not by a magic marker. */
const looksLikeStage = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false;
  if (value.stageKey !== undefined && (value.status !== undefined || value.name !== undefined)) return true;
  if (value.clientVisible !== undefined && value.order !== undefined) return true;
  return false;
};

const looksLikeStageArray = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0 && value.every(looksLikeStage);

const scrubStage = (stage: Record<string, unknown>): Record<string, unknown> => {
  const out = { ...stage };
  if (out.owner && isPlainObject(out.owner)) {
    out.owner = { id: idOf(out.owner), name: out.owner.name ?? null, email: out.owner.email ?? null };
  }
  delete out.internalRemarks;
  delete out.blocker;
  delete out.holdReason;
  delete out.estimatedDays;
  delete out.requiredDocuments;
  delete out.dependsOn;
  delete out.documents;
  delete out.updatedBy;
  delete out.clientVisible;
  delete out.isClientVisible;
  return out;
};

interface StripOptions {
  isClientScoped: boolean;
  depth?: number;
}

/** Recursively strips restricted keys/fields from an arbitrary payload. */
export function stripRestrictedData(payload: unknown, { isClientScoped, depth = 0 }: StripOptions): unknown {
  if (!isClientScoped) return payload;
  if (depth > 12) return null;

  if (Array.isArray(payload)) {
    if (looksLikeStageArray(payload)) return payload.map(scrubStage);
    return payload.map((item) => stripRestrictedData(item, { isClientScoped, depth: depth + 1 }));
  }

  if (payload instanceof Date) return payload;
  if (!isPlainObject(payload)) return payload;
  // A single stage object
  if (looksLikeStage(payload)) return scrubStage(payload);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (FORBIDDEN_FIELDS.has(key) && key !== 'clientVisible') continue;
    if (key === 'clientVisible' || key === 'isClientVisible' || key === 'restricted') continue;

    // A container explicitly flagged as internal
    if (key === 'stages') {
      if (Array.isArray(value)) {
        out.stages = value.filter((s) => isPlainObject(s) && s.clientVisible === true).map(scrubStage);
      } else {
        out.stages = stripRestrictedData(value, { isClientScoped, depth: depth + 1 });
      }
      continue;
    }

    out[key] = stripRestrictedData(value, { isClientScoped, depth: depth + 1 });
  }
  return out;
}

/**
 * Express middleware. Wrap it on any route whose response may contain
 * project / stage / user data.
 */
export function filterClientData(req: Request, res: Response, next: NextFunction): void {
  const isClientScoped = Boolean(req.user?.isClientScoped);

  res.clientScope = {
    isClientScoped,
    canSeeInternalData: req.user?.canSeeInternalData !== false,
  };

  if (!isClientScoped) return next();

  const originalJson = res.json.bind(res) as (body?: unknown) => Response;
  res.json = (body?: unknown) => {
    if (body === undefined || body === null) return originalJson(body);
    return originalJson(stripRestrictedData(body, { isClientScoped: true }));
  };

  return next();
}

export default filterClientData;
