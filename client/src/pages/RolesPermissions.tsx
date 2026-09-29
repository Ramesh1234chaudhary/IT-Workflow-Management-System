import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import ConfirmDialog from '../components/ConfirmDialog';
import PermissionGate from '../components/PermissionGate';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { createRole, deleteRole, fetchPermissionMatrix, fetchPermissions, fetchRoles, updateRole } from '../features/roles/rolesSlice';
import type { RolePayload } from '../api/api';
import type { Permission, Role } from '../types';

const ACCESS_SCOPES = ['all', 'assigned', 'own', 'client'];

/** `publicRole()` always sends these, and adds the permission count the table shows. */
type RoleRow = Role & {
  key: string;
  description: string | null;
  isClientScoped: boolean;
  canSeeInternalData: boolean;
  isActive: boolean;
  permissions: string[];
  permissionCount: number;
};

/** The matrix endpoint decorates each role with its scope flag and granted keys. */
type MatrixRole = { id: string; name: string; key?: string; isClientScoped?: boolean; permissionKeys?: string[] };

interface RoleForm {
  /** Only set when the editor opened on an existing role. */
  id?: string;
  name: string;
  key: string;
  description: string;
  accessScope: string;
  isClientScoped: boolean;
  canSeeInternalData: boolean;
  isActive: boolean;
  permissions: string[];
}

const EMPTY_FORM: RoleForm = {
  name: '',
  key: '',
  description: '',
  accessScope: 'assigned',
  isClientScoped: false,
  canSeeInternalData: true,
  isActive: true,
  permissions: [],
};

/** Group permissions by module so the dialog reads as a checklist, not a wall. */
const groupByModule = (permissions: Permission[]): Record<string, Permission[]> =>
  permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    acc[p.module] = acc[p.module] || [];
    acc[p.module].push(p);
    return acc;
  }, {});

/** The two thunks return different payloads; only the failure flag and message are read. */
type DispatchOutcome = { error?: unknown; payload?: { message?: string } };

export default function RolesPermissions() {
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const { items, permissions, matrix, status, actionStatus, actionError } = useAppSelector((state) => state.roles);

  const roles = items as RoleRow[];
  const matrixRoles = (matrix?.roles || []) as MatrixRole[];

  const [editor, setEditor] = useState<{ open: boolean; role: RoleRow | null }>({ open: false, role: null });
  const [form, setForm] = useState<RoleForm>(EMPTY_FORM);
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState<{ open: boolean; role: RoleRow | null }>({ open: false, role: null });

  useEffect(() => {
    dispatch(fetchRoles());
    dispatch(fetchPermissions());
    dispatch(fetchPermissionMatrix());
  }, [dispatch]);

  const grouped = useMemo(() => groupByModule(permissions), [permissions]);

  const errors = useMemo(() => {
    const next: Partial<Record<'name' | 'key' | 'canSeeInternalData', string>> = {};
    if (form.name.trim().length < 2) next.name = 'Role name is required';
    if (!/^[a-z0-9_]+$/.test(form.key)) next.key = 'Lowercase letters, numbers and underscores only';
    else if (roles.some((r) => r.key === form.key && r.id !== form.id)) next.key = 'This key is already in use';
    if (form.isClientScoped && form.canSeeInternalData) {
      next.canSeeInternalData = 'A client-scoped role must not see internal data';
    }
    return next;
  }, [form, roles]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setTouched(false);
    setEditor({ open: true, role: null });
  };

  const openEdit = (role: RoleRow) => {
    setForm({
      name: role.name,
      key: role.key,
      description: role.description || '',
      accessScope: role.accessScope,
      isClientScoped: role.isClientScoped,
      canSeeInternalData: role.canSeeInternalData,
      isActive: role.isActive,
      permissions: [...(role.permissions || [])],
    });
    setTouched(false);
    setEditor({ open: true, role });
  };

  const togglePermission = (key: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((k) => k !== key)
        : [...prev.permissions, key],
    }));
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (Object.keys(errors).length) return;

    // The checklist holds permission keys, but the API stores permission
    // references, so translate keys to ids before saving.
    const idByKey = new Map(permissions.map((p) => [p.key, p.id]));

    const body: RolePayload = {
      name: form.name.trim(),
      key: form.key.trim(),
      description: form.description,
      accessScope: form.accessScope === 'all' ? 'all' : 'assigned',
      isClientScoped: form.isClientScoped,
      canSeeInternalData: form.canSeeInternalData,
      permissions: form.permissions.map((key) => idByKey.get(key)).filter((id): id is string => Boolean(id)),
    };

    const result = editor.role
      ? await dispatch(updateRole({ id: editor.role.id, body }))
      : await dispatch(createRole(body));

    if (createRole.rejected.match(result) || updateRole.rejected.match(result)) {
      enqueueSnackbar(result.payload?.message || 'Could not save the role', { variant: 'error' });
      return;
    }
    enqueueSnackbar(editor.role ? 'Role updated' : 'Role created', { variant: 'success' });
    setEditor({ open: false, role: null });
    dispatch(fetchPermissionMatrix());
  };

  const handleDelete = async () => {
    const result = (await dispatch(deleteRole(confirm.role!.id))) as unknown as DispatchOutcome;
    setConfirm({ open: false, role: null });
    if (result.error) {
      enqueueSnackbar(result.payload?.message || 'Could not delete the role', { variant: 'error' });
    } else {
      enqueueSnackbar('Role deleted', { variant: 'success' });
      dispatch(fetchPermissionMatrix());
    }
  };

  if (status === 'loading') return <PageLoader label="Loading roles…" />;

  return (
    <Box>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Authorisation is database driven. The client only compares permission keys, never role names."
        action={
          <PermissionGate module="role" action="create">
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              New role
            </Button>
          </PermissionGate>
        }
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        A role marked <strong>client scoped</strong> can never have <code>canSeeInternalData</code>. The API rejects
        that combination, and the API additionally strips restricted fields from every response.
      </Alert>

      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}

      <Card sx={{ mb: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Role</TableCell>
                <TableCell>Scope</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Internal data</TableCell>
                <TableCell align="center">Permissions</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={700}>
                        {role.name}
                      </Typography>
                      {role.isSystem && <Chip size="small" label="System" variant="outlined" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      <code>{role.key}</code>
                      {role.description ? ` · ${role.description}` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={role.accessScope} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={role.isClientScoped ? 'warning' : 'primary'}
                      label={role.isClientScoped ? 'Client scoped' : 'Internal'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={role.canSeeInternalData ? 'success' : 'default'}
                      label={role.canSeeInternalData ? 'Yes' : 'No'}
                    />
                  </TableCell>
                  <TableCell align="center">{role.permissionCount}</TableCell>
                  <TableCell>
                    <Chip size="small" color={role.isActive ? 'success' : 'default'} label={role.isActive ? 'Active' : 'Disabled'} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <PermissionGate module="role" action="update">
                        <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(role)}>
                          Edit
                        </Button>
                      </PermissionGate>
                      <PermissionGate module="role" action="delete">
                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          disabled={role.isSystem}
                          onClick={() => setConfirm({ open: true, role })}
                        >
                          Delete
                        </Button>
                      </PermissionGate>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {matrix && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Permission matrix
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {matrixRoles.length} roles × {permissions.length} permissions. A tick means the role grants it.
            </Typography>
            <TableContainer sx={{ maxHeight: 460 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 220 }}>Permission</TableCell>
                    {matrixRoles.map((role) => (
                      <TableCell key={role.key} align="center" sx={{ minWidth: 110 }}>
                        <Typography variant="caption" fontWeight={700}>
                          {role.name}
                        </Typography>
                        {role.isClientScoped && (
                          <Typography variant="caption" display="block" color="warning.main">
                            client
                          </Typography>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {permissions.map((permission) => (
                    <TableRow key={permission.key} hover>
                      <TableCell>
                        <Typography variant="body2">{permission.key}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {permission.description}
                        </Typography>
                      </TableCell>
                      {matrixRoles.map((role) => (
                        <TableCell key={role.key} align="center">
                          {role.permissionKeys?.includes(permission.key) ? (
                            <Chip size="small" color="success" label="✓" sx={{ minWidth: 28 }} />
                          ) : (
                            <Typography variant="caption" color="text.disabled">
                              —
                            </Typography>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------ Role editor ------------------------------ */}
      <Dialog open={editor.open} onClose={() => setEditor({ open: false, role: null })} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <AdminPanelSettingsIcon />
            {editor.role ? `Edit ${editor.role.name}` : 'Create role'}
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Grid2>
              <TextField
                label="Name *"
                fullWidth
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                error={touched && Boolean(errors.name)}
                helperText={touched && errors.name}
              />
              <TextField
                label="Key *"
                fullWidth
                value={form.key}
                disabled={Boolean(editor.role?.isSystem)}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toLowerCase() }))}
                error={touched && Boolean(errors.key)}
                helperText={touched ? errors.key || 'Used by the API and audit trail' : 'e.g. project_manager'}
              />
            </Grid2>

            <TextField
              label="Description"
              fullWidth
              multiline
              minRows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Project access scope</InputLabel>
              <Select
                label="Project access scope"
                value={form.accessScope}
                onChange={(e) => setForm((f) => ({ ...f, accessScope: e.target.value }))}
              >
                {ACCESS_SCOPES.map((scope) => (
                  <MenuItem key={scope} value={scope}>
                    {scope}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {form.accessScope === 'all'
                  ? 'Every project is visible'
                  : form.accessScope === 'assigned'
                    ? 'Only projects where the user is client, manager or member'
                    : form.accessScope === 'own'
                      ? 'Only projects the user manages'
                      : 'Only projects where the user is the client'}
              </FormHelperText>
            </FormControl>

            <Stack>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.isClientScoped}
                    onChange={(e) => {
                      const isClientScoped = e.target.checked;
                      setForm((f) => ({
                        ...f,
                        isClientScoped,
                        canSeeInternalData: isClientScoped ? false : f.canSeeInternalData,
                      }));
                    }}
                  />
                }
                label="Client scoped (Operations)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.canSeeInternalData}
                    disabled={form.isClientScoped}
                    onChange={(e) => setForm((f) => ({ ...f, canSeeInternalData: e.target.checked }))}
                  />
                }
                label="Can see internal stages, remarks and documents"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                }
                label="Active"
              />
              {touched && errors.canSeeInternalData && <FormHelperText error>{errors.canSeeInternalData}</FormHelperText>}
            </Stack>

            <Divider />

            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Permissions ({form.permissions.length})
                </Typography>
                <Button
                  size="small"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      permissions: permissions.map((p) => p.key),
                    }))
                  }
                >
                  Select all
                </Button>
              </Stack>

              {Object.keys(grouped).map((moduleName) => (
                <Box key={moduleName} sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    {moduleName}
                  </Typography>
                  <Grid2>
                    {grouped[moduleName].map((permission) => (
                      <FormControlLabel
                        key={permission.key}
                        control={
                          <Checkbox
                            size="small"
                            checked={form.permissions.includes(permission.key)}
                            onChange={() => togglePermission(permission.key)}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">{permission.action}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {permission.description}
                            </Typography>
                          </Box>
                        }
                      />
                    ))}
                  </Grid2>
                </Box>
              ))}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditor({ open: false, role: null })} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={actionStatus === 'loading'} startIcon={actionStatus === 'loading' ? <CircularProgress size={16} /> : null}>
            {editor.role ? 'Save changes' : 'Create role'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirm.open}
        title="Delete role"
        message={`Delete "${confirm.role?.name}"? Users still assigned to this role must be reassigned first.`}
        confirmLabel="Delete"
        color="error"
        onConfirm={handleDelete}
        onClose={() => setConfirm({ open: false, role: null })}
      />
    </Box>
  );
}

/** Two-column responsive row used by the editor form. */
function Grid2({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>{children}</Box>
  );
}
