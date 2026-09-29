import { useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import ReplayIcon from '@mui/icons-material/Replay';
import { Form, Formik, type FormikHelpers } from 'formik';
import * as Yup from 'yup';

import PageHeader from '../components/PageHeader';
import ReassignModal from '../components/ReassignModal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import PermissionGate from '../components/PermissionGate';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { usePermission } from '../hooks/usePermission';
import { useDebounce } from '../hooks/useDebounce';
import { initials } from '../utils/format';
import type { DeactivationBlock, UpdateUserPayload } from '../api/api';
import {
  createUser,
  deactivateUser,
  deleteUser,
  fetchAssignableUsers,
  fetchUsers,
  reactivateUser,
  setFilters,
  updateUser,
  clearDeactivationBlock,
} from '../features/users/usersSlice';
import { fetchRoles as fetchAllRoles } from '../features/roles/rolesSlice';
import type { User } from '../types';

interface FormValues {
  name: string;
  email: string;
  password: string;
  role: string;
  jobTitle: string;
  department: string;
  team: string;
  phone: string;
}

/** The users list adds the open-assignment count the table renders. */
type UserRow = User & { activeAssignments: number };

const userSchema = Yup.object({
  name: Yup.string().trim().min(2, 'Name must be at least 2 characters').required('Name is required'),
  email: Yup.string().trim().email('Enter a valid email').required('Email is required'),
  password: Yup.string().min(8, 'Minimum 8 characters').required('Password is required'),
  role: Yup.string().required('Role is required'),
  jobTitle: Yup.string(),
  department: Yup.string(),
  team: Yup.string(),
  phone: Yup.string(),
});

export default function UserManagement() {
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const { can } = usePermission();

  const { items, pagination, filters, status, actionStatus, actionError, deactivationBlock } = useAppSelector(
    (state) => state.users,
  );
  const roles = useAppSelector((state) => state.roles.items);

  const [search, setSearch] = useState(filters.search || '');
  const debouncedSearch = useDebounce(search, 400);

  const [userDialog, setUserDialog] = useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null });
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [reassignTarget, setReassignTarget] = useState<UserRow | null>(null);

  const users = items as UserRow[];

  const busy = actionStatus === 'loading';
  const canReassign = can('user', 'reassign');

  useEffect(() => {
    dispatch(fetchAllRoles());
    dispatch(fetchAssignableUsers());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchUsers({ ...filters, search: debouncedSearch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, filters.page, filters.limit, filters.role, filters.isActive, debouncedSearch]);

  /* The API answered 409 for a deactivation attempt: open the reassign modal. */
  useEffect(() => {
    if (!deactivationBlock) return;
    const user = users.find((u) => u.id === deactivationBlock.userId);
    if (user) setReassignTarget(user);
  }, [deactivationBlock, users]);

  // The slice only keeps `userId` and `reason` on the block, so the count reads 0.
  const activeBlock = useMemo(
    () =>
      deactivationBlock
        ? (deactivationBlock as DeactivationBlock & { activeAssignments?: number }).activeAssignments || 0
        : 0,
    [deactivationBlock],
  );

  const handleSaveUser = async (values: FormValues, { setSubmitting, resetForm }: FormikHelpers<FormValues>) => {
    const body: UpdateUserPayload = {
      ...values,
      email: values.email.toLowerCase().trim(),
      jobTitle: values.jobTitle || '',
      department: values.department || '',
      team: values.team || '',
      phone: values.phone || '',
    };
    if (userDialog.user) delete body.password;

    const result = userDialog.user
      ? await dispatch(updateUser({ id: userDialog.user.id, body }))
      : await dispatch(createUser(body as Parameters<typeof createUser>[0]));

    setSubmitting(false);

    if (createUser.fulfilled.match(result) || updateUser.fulfilled.match(result)) {
      enqueueSnackbar(userDialog.user ? 'User updated' : 'User created', { variant: 'success' });
      setUserDialog({ open: false, user: null });
      resetForm();
      dispatch(fetchUsers({ ...filters, search: debouncedSearch }));
    } else {
      enqueueSnackbar((result.payload as { message?: string } | undefined)?.message || 'Could not save the user', {
        variant: 'error',
      });
    }
  };

  /**
   * Deactivation attempt. A 409 response is captured by the slice which sets
   * `deactivationBlock`, and the effect above opens the Reassign modal.
   */
  const handleDeactivate = async (user: UserRow) => {
    const result = await dispatch(deactivateUser({ id: user.id, body: { reason: '' } }));
    if (deactivateUser.fulfilled.match(result)) {
      // The controller also answers with a confirmation `message`.
      enqueueSnackbar((result.payload as { user: User; message?: string }).message, { variant: 'success' });
    } else if (result.payload?.status !== 409) {
      enqueueSnackbar(result.payload?.message || 'Could not deactivate the user', { variant: 'error' });
    }
  };

  const handleReactivate = async (user: UserRow) => {
    const result = await dispatch(reactivateUser(user.id));
    if (reactivateUser.fulfilled.match(result))
      enqueueSnackbar((result.payload as { user: User; message?: string }).message, { variant: 'success' });
    else enqueueSnackbar(result.payload?.message || 'Could not reactivate', { variant: 'error' });
  };

  const handleDelete = async () => {
    const result = await dispatch(deleteUser(deleteTarget!.id));
    if (deleteUser.fulfilled.match(result)) enqueueSnackbar('User deleted', { variant: 'success' });
    else enqueueSnackbar(result.payload?.message || 'Could not delete the user', { variant: 'error' });
    setDeleteTarget(null);
  };

  return (
    <Box>
      <PageHeader
        title="User Management"
        subtitle="Create accounts, assign roles and safely deactivate users without stranding stage assignments."
        action={
          <PermissionGate module="user" action="create">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setUserDialog({ open: true, user: null })}
            >
              New user
            </Button>
          </PermissionGate>
        }
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              placeholder="Search by name, email, team…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ maxWidth: 360 }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Role</InputLabel>
              <Select
                label="Role"
                value={filters.role}
                onChange={(e) => dispatch(setFilters({ role: e.target.value, page: 1 }))}
              >
                <MenuItem value="">All roles</MenuItem>
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filters.isActive}
                onChange={(e) => dispatch(setFilters({ isActive: e.target.value, page: 1 }))}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Active</MenuItem>
                <MenuItem value="false">Deactivated</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {pagination.total} user{pagination.total === 1 ? '' : 's'}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {deactivationBlock && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => dispatch(clearDeactivationBlock())}>
          <strong>{activeBlock}</strong> active stage assignment{activeBlock === 1 ? '' : 's'} blocked the deactivation
          (HTTP 409). Reassign them to continue.
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Team</TableCell>
                <TableCell align="center">Active stages</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {status === 'loading' && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      Loading users…
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {status === 'succeeded' && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState title="No users match your filters" description="Try a different search or role." />
                  </TableCell>
                </TableRow>
              )}

              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          bgcolor: user.avatarColor || 'primary.main',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {initials(user.name)}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {user.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {user.email}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={user.role?.name || '—'} />
                  </TableCell>
                  <TableCell>{user.team || '—'}</TableCell>
                  <TableCell align="center">
                    {user.activeAssignments > 0 ? (
                      <Chip size="small" color="warning" label={user.activeAssignments} />
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        0
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={user.isActive ? 'success' : 'default'}
                      label={user.isActive ? 'Active' : 'Deactivated'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <PermissionGate module="user" action="update">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => setUserDialog({ open: true, user })}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </PermissionGate>

                      {user.isActive ? (
                        <PermissionGate module="user" action="deactivate">
                          <Tooltip title="Deactivate">
                            <IconButton size="small" color="error" onClick={() => handleDeactivate(user)} disabled={busy}>
                              <BlockOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </PermissionGate>
                      ) : (
                        <PermissionGate module="user" action="update">
                          <Tooltip title="Reactivate">
                            <IconButton size="small" color="success" onClick={() => handleReactivate(user)} disabled={busy}>
                              <ReplayIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </PermissionGate>
                      )}

                      {user.activeAssignments > 0 && canReassign && (
                        <Tooltip title="Reassign active stages">
                          <IconButton size="small" color="warning" onClick={() => setReassignTarget(user)}>
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}

                      <PermissionGate module="user" action="delete">
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(user)} disabled={busy}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </PermissionGate>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider />
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              disabled={pagination.page <= 1}
              onClick={() => dispatch(setFilters({ page: pagination.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              size="small"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => dispatch(setFilters({ page: pagination.page + 1 }))}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      </Card>

      {/* ----------------------------- create / edit ---------------------------- */}
      <Dialog
        open={userDialog.open}
        onClose={busy ? undefined : () => setUserDialog({ open: false, user: null })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{userDialog.user ? 'Edit user' : 'New user'}</DialogTitle>
        <Formik
          initialValues={
            {
              name: userDialog.user?.name || '',
              email: userDialog.user?.email || '',
              password: '',
              role: userDialog.user?.role?.id || '',
              jobTitle: userDialog.user?.jobTitle || '',
              department: userDialog.user?.department || '',
              team: userDialog.user?.team || '',
              phone: userDialog.user?.phone || '',
            } satisfies FormValues
          }
          enableReinitialize
          validationSchema={userSchema}
          onSubmit={handleSaveUser}
        >
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form noValidate>
              <DialogContent dividers>
                <Grid container spacing={2} sx={{ pt: 0.5 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Full name *"
                      name="name"
                      value={values.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Email *"
                      name="email"
                      type="email"
                      value={values.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.email && Boolean(errors.email)}
                      helperText={touched.email && errors.email}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small" error={touched.role && Boolean(errors.role)}>
                      <InputLabel>Role *</InputLabel>
                      <Select label="Role *" name="role" value={values.role} onChange={handleChange} onBlur={handleBlur}>
                        {roles.map((role) => (
                          <MenuItem key={role.id} value={role.id}>
                            {role.name} · {role.accessScope === 'all' ? 'full scope' : 'assigned scope'}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label={userDialog.user ? 'New password (optional)' : 'Password *'}
                      name="password"
                      type="password"
                      value={values.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.password && Boolean(errors.password)}
                      helperText={touched.password && errors.password}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Job title" name="jobTitle" value={values.jobTitle} onChange={handleChange} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Team" name="team" value={values.team} onChange={handleChange} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Department" name="department" value={values.department} onChange={handleChange} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Phone" name="phone" value={values.phone} onChange={handleChange} />
                  </Grid>
                </Grid>
                {actionError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {actionError}
                  </Alert>
                )}
              </DialogContent>
              <DialogActions sx={{ px: 3, py: 2 }}>
                <Button color="inherit" onClick={() => setUserDialog({ open: false, user: null })} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained" disabled={isSubmitting || busy}>
                  {isSubmitting ? 'Saving…' : 'Save user'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      <ReassignModal
        open={Boolean(reassignTarget)}
        targetUser={reassignTarget}
        onClose={() => {
          setReassignTarget(null);
          dispatch(clearDeactivationBlock());
          dispatch(fetchUsers({ ...filters, search: debouncedSearch }));
        }}
        onReassigned={() => {
          dispatch(clearDeactivationBlock());
          dispatch(fetchUsers({ ...filters, search: debouncedSearch }));
          enqueueSnackbar('Assignments moved. You can now deactivate this user.', { variant: 'info' });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this user?"
        message={`${deleteTarget?.name} will be permanently removed. Users with active stage assignments cannot be deleted (the API returns 409).`}
        confirmLabel="Delete"
        color="error"
        loading={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}
