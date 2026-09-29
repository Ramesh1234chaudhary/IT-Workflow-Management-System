import bcrypt from 'bcryptjs';
import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import env from '../config/env';
import type { IUser } from '../types/models';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 120 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    passwordChangedAt: { type: Date },

    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },

    jobTitle: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    team: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    avatarColor: { type: String, trim: true, default: '#1976d2' },

    isActive: { type: Boolean, default: true },
    deactivatedAt: { type: Date, default: null },
    deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deactivationReason: { type: String, trim: true, default: '' },

    lastLoginAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, env.security.bcryptSaltRounds);
  this.passwordChangedAt = new Date();
  return next();
});

userSchema.methods.comparePassword = function comparePassword(this: { password: string }, candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform(_doc, ret) {
    const out = ret as unknown as Record<string, unknown>;
    out.id = String(out._id);
    delete out._id;
    delete out.__v;
    delete out.password;
    delete out.passwordChangedAt;
    return out;
  },
});

export type UserDoc = HydratedDocument<IUser>;
export const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;
