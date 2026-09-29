import { Types } from 'mongoose';
import { ACCESS_SCOPE } from '../utils/constants';
import ApiError from '../utils/ApiError';
import type { AccessScope } from '../types/domain';

/** All authorisation decisions flow through the DB-driven role attached to the user. */

type Id = Types.ObjectId | string;

/** A role arrives either as a populated document or as a bare ObjectId. */
interface RoleLike {
  id?: Id;
  _id?: Id;
  name?: string;
  permissions?: (Id | { key?: string })[];
  accessScope?: AccessScope;
  isClientScoped?: boolean;
  canSeeInternalData?: boolean;
}

/** Either a `req.user` identity, a Mongoose user doc, or something in between. */
interface UserLike {
  id?: Id;
  _id?: Id;
  name?: string;
  email?: string;
  role?: Id | RoleLike | null;
  roleSnapshot?: RoleLike | null;
  permissions?: string[];
  accessScope?: AccessScope;
  isClientScoped?: boolean;
  canSeeInternalData?: boolean;
}

export interface NormalizedUser {
  id: string;
  name?: string;
  email?: string;
  roleId: string;
  roleName?: string;
  permissions: string[];
  accessScope?: AccessScope;
  isClientScoped: boolean;
  canSeeInternalData: boolean;
}

/** Narrows a bare ObjectId out, leaving populated role documents. */
const asRole = (value: Id | RoleLike | null | undefined): RoleLike | null =>
  value && typeof value === 'object' && !(value instanceof Types.ObjectId) ? (value as RoleLike) : null;

/** Accepts a token payload (req.user) or a User document and returns a uniform shape. */
export function normalizeUser(user: UserLike | null | undefined): NormalizedUser | null {
  if (!user) return null;
  const role = user.roleSnapshot ?? asRole(user.role) ?? (user as RoleLike);
  return {
    id: String(user.id || user._id || ''),
    name: user.name,
    email: user.email,
    roleId: String(role?.id || role?._id || ''),
    roleName: role?.name,
    permissions:
      user.permissions ??
      role?.permissions
        ?.map((p) => (typeof p === 'object' && !(p instanceof Types.ObjectId) ? p.key ?? '' : String(p)))
        .filter(Boolean) ?? [],
    accessScope: user.accessScope ?? role?.accessScope,
    isClientScoped: Boolean(user.isClientScoped ?? role?.isClientScoped),
    canSeeInternalData: user.canSeeInternalData ?? role?.canSeeInternalData ?? true,
  };
}

export const permissionsOf = (user: UserLike | null | undefined): string[] => user?.permissions ?? [];

export const hasPermission = (user: UserLike | null | undefined, module: string, action: string): boolean =>
  permissionsOf(user).includes(`${module}:${action}`);

export const hasAnyPermission = (user: UserLike | null | undefined, ...keys: string[]): boolean =>
  keys.some((key) => permissionsOf(user).includes(key));

/** Client / Operations users: responses must be stripped by filterClientData. */
export const isClientScoped = (user: UserLike | null | undefined): boolean => Boolean(normalizeUser(user)?.isClientScoped);

export const canSeeInternalData = (user: UserLike | null | undefined): boolean =>
  normalizeUser(user)?.canSeeInternalData !== false;

/** 'all' roles see everything; 'assigned' roles only see projects they are attached to. */
export const hasFullProjectScope = (user: UserLike | null | undefined): boolean =>
  normalizeUser(user)?.accessScope === ACCESS_SCOPE.ALL;

/**
 * Mongo filter that limits a query to the projects a user is allowed to see.
 * IT Team Members and Client/Operations users only ever reach projects where
 * they are the client, the project manager, a member, or the owner of a stage.
 */
export function buildProjectScope(user: UserLike | null | undefined): Record<string, unknown> {
  if (hasFullProjectScope(user)) return {};
  const id = normalizeUser(user)?.id;
  return {
    $or: [{ client: id }, { projectManager: id }, { members: id }],
  };
}

/** Applied on top of buildProjectScope so a member only sees their own stages. */
export function buildStageScope(user: UserLike | null | undefined): Record<string, unknown> {
  if (hasFullProjectScope(user)) return {};
  return { owner: normalizeUser(user)?.id };
}

/** Reads an id off a value that may be a bare id, a doc, or a populated doc. */
const idOf = (value: Id | ({ id?: Id; _id?: Id } & Record<string, unknown>) | null | undefined): Id | null => {
  if (!value) return null;
  if (typeof value === 'object' && !(value instanceof Types.ObjectId)) {
    const doc = value as { id?: Id; _id?: Id };
    return doc._id ?? doc.id ?? null;
  }
  return value;
};

interface ProjectAccessShape {
  client?: Id | { id?: Id; _id?: Id } | null;
  projectManager?: Id | { id?: Id; _id?: Id } | null;
  members?: (Id | { id?: Id; _id?: Id })[];
}

export function canAccessProject(user: UserLike | null | undefined, project: ProjectAccessShape | null): boolean {
  if (!project) return false;
  if (hasFullProjectScope(user)) return true;
  const id = normalizeUser(user)?.id;
  const ids = [idOf(project.client), idOf(project.projectManager), ...(project.members ?? []).map(idOf)]
    .filter(Boolean)
    .map(String);
  return ids.includes(id as string);
}

export function assertProjectAccess<T extends ProjectAccessShape>(
  user: UserLike | null | undefined,
  project: T | null | undefined,
  { write = false }: { write?: boolean } = {},
): T {
  if (!project) throw ApiError.notFound('Project not found');
  if (!canAccessProject(user, project)) {
    throw ApiError.forbidden('You are not assigned to this project', { code: 'PROJECT_OUT_OF_SCOPE' });
  }
  if (write && isClientScoped(user)) {
    throw ApiError.forbidden('Client accounts have read-only access', { code: 'READ_ONLY_SCOPE' });
  }
  return project;
}

/** Client users must never receive a stage flagged clientVisible = false. */
export function filterStagesForUser<T extends { clientVisible?: boolean }>(
  stages: T[],
  user: UserLike | null | undefined,
): T[] {
  if (canSeeInternalData(user)) return stages;
  return stages.filter((stage) => stage.clientVisible === true);
}

/** Active (non-completed) stage assignments owned by a user. */
export function isActiveAssignment(stage: { status?: string } | null | undefined): boolean {
  return Boolean(stage) && stage?.status !== 'Completed';
}

export default {
  normalizeUser,
  permissionsOf,
  hasPermission,
  hasAnyPermission,
  isClientScoped,
  canSeeInternalData,
  hasFullProjectScope,
  buildProjectScope,
  buildStageScope,
  canAccessProject,
  assertProjectAccess,
  filterStagesForUser,
  isActiveAssignment,
};
