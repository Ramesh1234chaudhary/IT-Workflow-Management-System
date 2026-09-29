import type { Request } from 'express';
import type { Types } from 'mongoose';
import { Permission, Role, User } from '../models/index';
import type { RoleDoc } from '../models/Role';
import ApiError from '../utils/ApiError';
import { publicPermission } from '../utils/serializers';
import { AUDIT_ACTIONS, ENTITY_TYPES, ACCESS_SCOPE } from '../utils/constants';
import { recordAudit, type AuditActor } from './auditService';
import type { AccessScope } from '../types/domain';
import type { IPermission, IRolePopulated, ListQuery } from '../types/models';

type Id = Types.ObjectId | string;

interface AuditContext {
  actor?: AuditActor | null;
  req?: Request | null;
}

interface RolePayload {
  name?: string;
  key?: string;
  description?: string;
  accessScope?: AccessScope;
  isClientScoped?: boolean;
  canSeeInternalData?: boolean;
  permissions?: Id[];
}

export async function listRoles(query: ListQuery = {}) {
  const filter: Record<string, unknown> = {};
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  return Role.find(filter)
    .populate('permissions', 'module action key description')
    .sort({ name: 1 })
    .lean() as unknown as Promise<IRolePopulated[]>;
}

export async function getRole(id: Id): Promise<IRolePopulated> {
  const role = (await Role.findById(id)
    .populate('permissions', 'module action key description')
    .lean()) as unknown as IRolePopulated | null;
  if (!role) throw ApiError.notFound('Role not found');
  return role;
}

export async function listPermissions(query: ListQuery = {}): Promise<IPermission[]> {
  const filter: Record<string, unknown> = {};
  if (query.module) filter.module = query.module;
  return Permission.find(filter).sort({ module: 1, action: 1 }).lean() as unknown as Promise<IPermission[]>;
}

export async function createRole(payload: RolePayload, { actor, req }: AuditContext) {
  const permissions = await Permission.find({ _id: { $in: payload.permissions || [] }, isActive: true });
  const name = String(payload.name).trim();
  const existing = await Role.findOne({ name });
  if (existing) throw ApiError.conflict('A role with this name already exists');

  const role = await Role.create({
    name,
    key: String(payload.key || name).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    description: payload.description || '',
    accessScope: payload.accessScope || ACCESS_SCOPE.ASSIGNED,
    isClientScoped: Boolean(payload.isClientScoped),
    canSeeInternalData: payload.canSeeInternalData !== false,
    permissions: permissions.map((p) => p._id),
  });

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.ROLE,
    entityId: role._id,
    entityLabel: role.name,
    action: AUDIT_ACTIONS.CREATED,
    newValue: {
      name: role.name,
      accessScope: role.accessScope,
      isClientScoped: role.isClientScoped,
      permissionCount: permissions.length,
    },
    req,
  });
  return role;
}

export async function updateRole(id: Id, payload: RolePayload, { actor, req }: AuditContext) {
  const role: RoleDoc | null = await Role.findById(id);
  if (!role) throw ApiError.notFound('Role not found');

  const before = {
    name: role.name,
    accessScope: role.accessScope,
    isClientScoped: role.isClientScoped,
    canSeeInternalData: role.canSeeInternalData,
    permissionCount: role.permissions.length,
  };

  if (role.isSystem && payload.permissions) {
    throw ApiError.conflict('Permissions of a system role are managed by the seed script only', { code: 'SYSTEM_ROLE' });
  }
  if (payload.name) role.name = payload.name;
  if (payload.description !== undefined) role.description = payload.description;
  if (payload.accessScope) role.accessScope = payload.accessScope;
  if (payload.isClientScoped !== undefined) role.isClientScoped = Boolean(payload.isClientScoped);
  if (payload.canSeeInternalData !== undefined) role.canSeeInternalData = Boolean(payload.canSeeInternalData);
  if (payload.permissions) {
    const permissions = await Permission.find({ _id: { $in: payload.permissions }, isActive: true });
    role.permissions = permissions.map((p) => p._id);
  }
  await role.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.ROLE,
    entityId: role._id,
    entityLabel: role.name,
    action: AUDIT_ACTIONS.UPDATED,
    oldValue: before,
    newValue: {
      name: role.name,
      accessScope: role.accessScope,
      isClientScoped: role.isClientScoped,
      canSeeInternalData: role.canSeeInternalData,
      permissionCount: role.permissions.length,
    },
    req,
  });
  return role;
}

export async function deleteRole(id: Id, { actor, req }: AuditContext) {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Role not found');
  if (role.isSystem) throw ApiError.conflict('System roles cannot be deleted', { code: 'SYSTEM_ROLE' });

  const userCount = await User.countDocuments({ role: role._id });
  if (userCount > 0) {
    throw ApiError.conflict(`${userCount} user(s) are assigned to this role`, { code: 'ROLE_IN_USE' });
  }

  await Role.deleteOne({ _id: role._id });
  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.ROLE,
    entityId: role._id,
    entityLabel: role.name,
    action: AUDIT_ACTIONS.DELETED,
    oldValue: { name: role.name, key: role.key },
    req,
  });
  return true;
}

/** Used by the permission matrix screen. */
export async function permissionMatrix() {
  const [permissions, roles] = await Promise.all([listPermissions(), listRoles()]);
  const grouped = permissions.reduce<Record<string, IPermission[]>>((acc, p) => {
    acc[p.module] = acc[p.module] || [];
    acc[p.module].push(p);
    return acc;
  }, {});

  return {
    modules: Object.keys(grouped)
      .sort()
      // Serialised like /roles/permissions, so a matrix cell keyed on the
      // permission id resolves the same way the role form does.
      .map((module) => ({ module, actions: grouped[module].map((p) => publicPermission(p)!) })),
    roles: roles.map((r) => ({
      id: String(r._id),
      name: r.name,
      key: r.key,
      accessScope: r.accessScope,
      isClientScoped: r.isClientScoped,
      isSystem: r.isSystem,
      permissionKeys: (r.permissions || []).map((p) => p.key),
    })),
  };
}
