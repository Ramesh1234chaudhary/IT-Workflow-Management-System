import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type { INotification } from '../types/models';

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, default: 'info' },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    entityType: { type: String, default: '' },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: 'notifications' },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export type NotificationDoc = HydratedDocument<INotification>;
export const Notification: Model<INotification> = mongoose.model<INotification>('Notification', notificationSchema);
export default Notification;
