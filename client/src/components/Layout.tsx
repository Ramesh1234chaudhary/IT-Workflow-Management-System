import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FolderIcon from '@mui/icons-material/Folder';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HistoryIcon from '@mui/icons-material/History';
import GroupIcon from '@mui/icons-material/Group';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BarChartIcon from '@mui/icons-material/BarChart';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useAuth } from '../hooks/useAuth';
import { usePermission } from '../hooks/usePermission';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../features/notifications/notificationsSlice';
import { resetWorkflowState } from '../features/workflow/workflowSlice';
import { initials, formatDateTime } from '../utils/format';
import type { PermissionInput, Notification } from '../types';

const DRAWER_WIDTH = 268;

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ fontSize?: 'small' | 'medium' | 'large' }>;
  permissions: PermissionInput[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/** Navigation is built from permissions, never from role names. */
const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: DashboardIcon, permissions: [] }],
  },
  {
    title: 'Workflow',
    items: [
      { label: 'My Board', to: '/board', icon: ViewKanbanIcon, permissions: [['stage', 'read']] },
      { label: 'Client View', to: '/client', icon: VisibilityIcon, permissions: [['project', 'read']] },
      { label: 'Projects', to: '/projects', icon: FolderIcon, permissions: [['project', 'read']] },
      { label: 'Create Project', to: '/projects/new', icon: AccountTreeIcon, permissions: [['project', 'create']] },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { label: 'SOP Builder', to: '/sop', icon: AccountTreeIcon, permissions: [['sop', 'read']] },
      { label: 'User Management', to: '/users', icon: GroupIcon, permissions: [['user', 'read']] },
      { label: 'Roles & Permissions', to: '/roles', icon: AdminPanelSettingsIcon, permissions: [['role', 'read']] },
    ],
  },
  {
    title: 'Governance',
    items: [
      { label: 'Reports', to: '/reports', icon: BarChartIcon, permissions: [['report', 'read']] },
      { label: 'Audit Log', to: '/audit', icon: HistoryIcon, permissions: [['audit', 'read']] },
    ],
  },
];

export default function Layout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, logoutReason } = useAuth();
  const { can, canAny } = usePermission();

  const { items: notifications = [], unread = 0 } = useAppSelector((state) => state.notifications);

  useEffect(() => {
    if (user) dispatch(fetchNotifications());
  }, [user, dispatch]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const visibleSections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.permissions.length || canAny(...item.permissions)),
      })).filter((section) => section.items.length),
    [canAny],
  );

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ gap: 1 }}>
        <AccountTreeIcon color="primary" />
        <Typography variant="h6" sx={{ fontSize: 17, fontWeight: 800 }}>
          IT Workflow
        </Typography>
      </Toolbar>
      <Divider />

      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1 }}>
        {visibleSections.map((section) => (
          <List
            key={section.title}
            dense
            subheader={
              <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '32px', fontWeight: 700 }}>
                {section.title}
              </ListSubheader>
            }
          >
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <ListItemButton
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  selected={location.pathname === item.to}
                  sx={{ mx: 1, borderRadius: 1.5, mb: 0.25 }}
                >
                  <ListItemIcon sx={{ minWidth: 38 }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
                </ListItemButton>
              );
            })}
          </List>
        ))}
      </Box>

      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Signed in as
        </Typography>
        <Typography variant="body2" fontWeight={700}>
          {user?.name}
        </Typography>
        <Chip size="small" sx={{ mt: 0.5 }} label={user?.role?.name} color="primary" variant="outlined" />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          {user?.permissions?.length || 0} permissions granted by role
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        color="inherit"
        sx={{
          borderBottom: '1px solid #e3e7ef',
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {!isDesktop && (
            <IconButton edge="start" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle navigation">
              <MenuIcon />
            </IconButton>
          )}

          <Typography variant="h6" sx={{ flexGrow: 1, fontSize: 18, display: { xs: 'none', sm: 'block' } }}>
            {import.meta.env.VITE_APP_NAME || 'IT Workflow Manager'}
          </Typography>

          <Tooltip title="Notifications">
            <IconButton onClick={(e) => setNotifAnchor(e.currentTarget)}>
              <Badge badgeContent={unread} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Account">
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: user?.avatarColor || 'primary.main', fontSize: 13 }}>
                {initials(user?.name)}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{user?.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.email}
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <Chip size="small" label={user?.role?.name} color="primary" variant="outlined" />
          </Box>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate('/profile');
          }}
        >
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          Profile & password
        </MenuItem>
        {can('user', 'update') && (
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              navigate('/users');
            }}
          >
            <ListItemIcon>
              <GroupIcon fontSize="small" />
            </ListItemIcon>
            User management
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          onClick={async () => {
            setAnchorEl(null);
            dispatch(resetWorkflowState());
            await signOut();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={notifAnchor}
        open={Boolean(notifAnchor)}
        onClose={() => setNotifAnchor(null)}
        slotProps={{ paper: { sx: { width: 380, maxHeight: 480 } } }}
      >
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Notifications</Typography>
          {unread > 0 && (
            <NavLink
              to="#"
              onClick={(e) => {
                e.preventDefault();
                dispatch(markAllNotificationsRead());
              }}
              style={{ fontSize: 12 }}
            >
              Mark all read
            </NavLink>
          )}
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              Nothing new
            </Typography>
          </MenuItem>
        ) : (
          (notifications as Notification[]).slice(0, 12).map((n) => (
            <MenuItem
              key={n.id}
              onClick={() => {
                if (!n.isRead) dispatch(markNotificationRead(n.id));
                setNotifAnchor(null);
              }}
              sx={{ whiteSpace: 'normal', alignItems: 'flex-start' }}
            >
              <Box>
                <Typography variant="body2" fontWeight={n.isRead ? 400 : 700}>
                  {n.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {n.message}
                </Typography>
                <Typography variant="caption" color="text.disabled" display="block">
                  {formatDateTime(n.createdAt)}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop ? true : mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid #e3e7ef' },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minWidth: 0,
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>

      <Snackbar
        open={Boolean(logoutReason)}
        autoHideDuration={4000}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" variant="filled">
          {logoutReason}
        </Alert>
      </Snackbar>
    </Box>
  );
}
