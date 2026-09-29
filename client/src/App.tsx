import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import RoleGuard from './components/RoleGuard';
import PageLoader from './components/PageLoader';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { restoreSession } from './features/auth/authSlice';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SOPBuilder from './pages/SOPBuilder';
import UserManagement from './pages/UserManagement';
import RolesPermissions from './pages/RolesPermissions';
import Projects from './pages/Projects';
import CreateProject from './pages/CreateProject';
import ProjectDetail from './pages/ProjectDetail';
import WorkflowBoard from './pages/WorkflowBoard';
import ClientView from './pages/ClientView';
import AuditLog from './pages/AuditLog';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

export default function App() {
  const dispatch = useAppDispatch();
  const initialising = useAppSelector((state) => state.auth.initialising);

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  if (initialising) return <PageLoader label="Starting IT Workflow Manager…" minHeight="100vh" />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <RoleGuard>
            <Layout />
          </RoleGuard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/board" element={<RoleGuard permissions={[['stage', 'read'] as const]}><WorkflowBoard /></RoleGuard>} />
        <Route path="/client" element={<RoleGuard permissions={[['project', 'read'] as const]}><ClientView /></RoleGuard>} />
        <Route path="/projects" element={<RoleGuard permissions={[['project', 'read'] as const]}><Projects /></RoleGuard>} />
        <Route path="/projects/new" element={<RoleGuard permissions={[['project', 'create'] as const]}><CreateProject /></RoleGuard>} />
        <Route path="/projects/:id" element={<RoleGuard permissions={[['project', 'read'] as const]}><ProjectDetail /></RoleGuard>} />
        <Route path="/sop" element={<RoleGuard permissions={[['sop', 'read'] as const]}><SOPBuilder /></RoleGuard>} />
        <Route path="/users" element={<RoleGuard permissions={[['user', 'read'] as const]}><UserManagement /></RoleGuard>} />
        <Route path="/roles" element={<RoleGuard permissions={[['role', 'read'] as const]}><RolesPermissions /></RoleGuard>} />
        <Route path="/audit" element={<RoleGuard permissions={[['audit', 'read'] as const]}><AuditLog /></RoleGuard>} />
        <Route path="/reports" element={<RoleGuard permissions={[['report', 'read'] as const]}><Reports /></RoleGuard>} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/403" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
