import { createSlice } from '@reduxjs/toolkit';
import { notificationsApi } from '../../api/api';
import { createApiThunk } from '../../api/createApiThunk';
import type { Notification } from '../../types';

export const fetchNotifications = createApiThunk<{ items: Notification[]; unread: number }>(
  'notifications/fetch',
  () => notificationsApi.list(),
);
export const markNotificationRead = createApiThunk<{ notification: Notification }, string>(
  'notifications/read',
  (id) => notificationsApi.markRead(id),
);
export const markAllNotificationsRead = createApiThunk<{ updated: number }>(
  'notifications/readAll',
  () => notificationsApi.markAllRead(),
);

export interface NotificationsState {
  items: Notification[];
  unread: number;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const initialState: NotificationsState = { items: [], unread: 0, status: 'idle' };

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    resetNotifications: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.items;
        state.unread = action.payload.unread;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const idx = state.items.findIndex((n) => n.id === action.payload.notification.id);
        if (idx >= 0 && !state.items[idx].isRead) {
          state.items[idx].isRead = true;
          state.unread = Math.max(0, state.unread - 1);
        }
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items = state.items.map((n) => ({ ...n, isRead: true }));
        state.unread = 0;
      });
  },
});

export const { resetNotifications } = notificationsSlice.actions;
export default notificationsSlice.reducer;
