import { configureStore } from '@reduxjs/toolkit';

import authReducer from '../features/auth/authSlice';
import usersReducer from '../features/users/usersSlice';
import rolesReducer from '../features/roles/rolesSlice';
import sopReducer from '../features/sop/sopSlice';
import projectsReducer from '../features/projects/projectsSlice';
import workflowReducer from '../features/workflow/workflowSlice';
import auditReducer from '../features/audit/auditSlice';
import reportsReducer from '../features/reports/reportsSlice';
import notificationsReducer from '../features/notifications/notificationsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: usersReducer,
    roles: rolesReducer,
    sop: sopReducer,
    projects: projectsReducer,
    workflow: workflowReducer,
    audit: auditReducer,
    reports: reportsReducer,
    notifications: notificationsReducer,
  },
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        ignoredActions: ['auth/login/fulfilled', 'auth/restore/fulfilled'],
      },
    }),
  devTools: import.meta.env.MODE !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
