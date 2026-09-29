import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import ApiError from './ApiError';
import { HTTP_STATUS } from './constants';

export type JsonRecord = Record<string, unknown>;

export interface PageQuery {
  page?: string | number;
  limit?: string | number;
  [key: string]: unknown;
}

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** Wraps an async route handler so rejected promises reach the error handler. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const isValidObjectId = (value: unknown): boolean =>
  mongoose.Types.ObjectId.isValid(String(value ?? ''));

export function toObjectId(value: unknown, fieldName = 'id'): mongoose.Types.ObjectId {
  if (!isValidObjectId(value)) {
    throw ApiError.badRequest(`Invalid ${fieldName}: ${String(value)}`);
  }
  return new mongoose.Types.ObjectId(String(value));
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256(value: unknown): string {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function timingSafeEqual(a: unknown, b: unknown): boolean {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Flattens anything into a JSON-safe value so it can be written to the audit trail. */
export function toPlain(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return value;

  const candidate = value as { _id?: unknown; id?: unknown; toObject?: (opts?: object) => JsonRecord };
  if (candidate._id || candidate.id) {
    const plain =
      typeof candidate.toObject === 'function' ? candidate.toObject({ depopulate: true }) : (value as JsonRecord);
    const { _id, __v, ...rest } = plain;
    return { _id: String(_id ?? plain._id ?? plain.id), ...rest };
  }
  return JSON.parse(JSON.stringify(value));
}

export interface FieldChange {
  from: unknown;
  to: unknown;
}

export function diffObjects(before: JsonRecord = {}, after: JsonRecord = {}): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const from = before?.[key] ?? null;
    const to = after?.[key] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}

export function parsePagination(query: PageQuery = {}): Pagination {
  const page = Math.max(Number.parseInt(String(query.page ?? ''), 10) || 1, 1);
  const rawLimit = Number.parseInt(String(query.limit ?? ''), 10) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta({ page, limit, total }: Omit<PaginationMeta, 'totalPages' | 'hasNextPage' | 'hasPrevPage'>): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

export function buildPaginationResponse<T>(
  items: T[],
  { page, limit, total }: { page: number; limit: number; total: number },
  extra: JsonRecord = {},
) {
  return { items, pagination: buildMeta({ page, limit, total }), ...extra };
}

export function escapeRegExp(value: unknown = ''): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function startOfDay(date: Date | string | number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date | string | number): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date | string | number, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

export function paginatedList<T>(res: Response, payload: T[], { page, limit, total }: { page: number; limit: number; total: number }) {
  return res.status(HTTP_STATUS.OK).json(buildPaginationResponse(payload, { page, limit, total }));
}
