import { Notification } from '../models/index';
import { integrationStatus } from '../services/integrations/integrationService';
import { publicNotification } from '../utils/serializers';
import { HTTP_STATUS } from '../utils/constants';
import { asyncHandler } from '../utils/helpers';
import type { AuthUser } from '../types/domain.js';
import type { Request, Response } from 'express';

const requireUser = (req: Request): AuthUser => {
  if (!req.user) throw new Error('Authentication required');
  return req.user;
};

/** GET /api/notifications */
export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const [items, unread] = await Promise.all([
    Notification.find({ recipient: user.id }).sort({ createdAt: -1 }).limit(50).lean(),
    Notification.countDocuments({ recipient: user.id, isRead: false }),
  ]);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    items: items.map(n => publicNotification(n as Record<string, unknown>)),
    unread,
  });
});

/** PATCH /api/notifications/:id/read */
export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: user.id },
    { $set: { isRead: true } },
    { new: true },
  );
  if (!item) return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Notification not found' });
  return res
    .status(HTTP_STATUS.OK)
    .json({ success: true, notification: publicNotification(item as unknown as Record<string, unknown>) });
});

/** PATCH /api/notifications/read-all */
export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const result = await Notification.updateMany({ recipient: user.id, isRead: false }, { $set: { isRead: true } });
  return res.status(HTTP_STATUS.OK).json({ success: true, updated: result.modifiedCount });
});

/** GET /api/meta/integrations - Phase 2 adapter status */
export const integrations = asyncHandler(async (_req: Request, res: Response) => {
  return res.status(HTTP_STATUS.OK).json({ success: true, ...integrationStatus() });
});

/** GET /api/meta/health */
export const health = asyncHandler(async (_req: Request, res: Response) => {
  return res.status(HTTP_STATUS.OK).json({ success: true, status: 'ok', uptime: process.uptime() });
});

export default { listNotifications, markRead, markAllRead, integrations, health };
