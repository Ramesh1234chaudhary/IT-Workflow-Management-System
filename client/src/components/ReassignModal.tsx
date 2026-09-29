import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { deactivateUser, fetchReassignTargets, reassignUser } from '../features/users/usersSlice';
import { fetchUserAssignments } from '../features/users/usersSlice';
import { StatusChip } from './StatusChip';
import { formatDate } from '../utils/format';

interface ReassignModalProps {
  open: boolean;
  onClose: () => void;
  onReassigned?: (payload: unknown) => void;
  targetUser: { id: string; name: string } | null;
}

/**
 * Deactivation -> 409 -> reassign flow.
 *
 * The API refuses to deactivate a user who still owns active stage assignments.
 * This dialog is opened automatically in that case: the admin must move every
 * listed stage to another user before deactivation becomes possible again.
 */
export default function ReassignModal({ open, onClose, onReassigned, targetUser }: ReassignModalProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const assignments = useAppSelector((state) => state.users.assignments);
  const { users: reassignUsers = [], projects: scopeProjects = [] } = useAppSelector(
    (state) => state.users.reassignTargets,
  );
  const actionStatus = useAppSelector((state) => state.users.actionStatus);
  const actionError = useAppSelector((state) => state.users.actionError);

  const [newOwnerId, setNewOwnerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [note, setNote] = useState('');
  const [deactivating, setDeactivating] = useState(false);

  const busy = actionStatus === 'loading';

  useEffect(() => {
    if (open && targetUser) {
      setNewOwnerId('');
      setProjectId('');
      setNote('');
      setDeactivating(false);
      dispatch(fetchUserAssignments(targetUser.id));
      dispatch(fetchReassignTargets());
    }
  }, [open, targetUser, dispatch]);

  if (!targetUser) return null;

  const handleReassign = async () => {
    if (!newOwnerId) {
      enqueueSnackbar('Select the user who will take over these stages', { variant: 'warning' });
      return;
    }
    const result = await dispatch(
      reassignUser({
        id: targetUser.id,
        body: { newOwnerId, projectIds: projectId ? [projectId] : [], note: note.trim() },
      }),
    );

    if (reassignUser.fulfilled.match(result)) {
      enqueueSnackbar(result.payload.message, { variant: 'success' });
      onReassigned?.(result.payload);
      onClose();
      return;
    }
    enqueueSnackbar(result.payload?.message || 'Reassignment failed', { variant: 'error' });
  };

  const handleDeactivateNow = async () => {
    setDeactivating(true);
    const result = await dispatch(deactivateUser({ id: targetUser.id, body: { reason: note.trim() } }));
    setDeactivating(false);

    if (deactivateUser.fulfilled.match(result)) {
      enqueueSnackbar(result.payload.message, { variant: 'success' });
      onClose();
      navigate('/users');
      return;
    }
    enqueueSnackbar(result.payload?.message || 'Deactivation failed', { variant: 'error' });
  };

  const assignmentStages = assignments?.stages ?? [];
  const filtered = projectId ? assignmentStages.filter((s) => s.project?.id === projectId) : assignmentStages;
  const remaining = assignments?.count ?? 0;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        Reassign stages before deactivating
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Alert severity="warning">
            <strong>{targetUser.name}</strong> owns {remaining} active stage assignment
            {remaining === 1 ? '' : 's'}. The API returned <code>409 Conflict</code>; move every stage to another
            user first. Stage statuses are never changed by a reassignment.
          </Alert>

          {actionError && <Alert severity="error">{actionError}</Alert>}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormControl size="small">
              <InputLabel id="reassign-owner-label">Reassign to *</InputLabel>
              <Select
                labelId="reassign-owner-label"
                label="Reassign to *"
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
              >
                {reassignUsers
                  .filter((u) => u.id !== targetUser.id)
                  .map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name} — {u.role?.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            <FormControl size="small">
              <InputLabel id="reassign-project-label">Limit to project</InputLabel>
              <Select
                labelId="reassign-project-label"
                label="Limit to project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <MenuItem value="">All projects ({assignmentStages.length})</MenuItem>
                {scopeProjects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TextField
            label="Note (optional)"
            placeholder="Recorded in the audit trail"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <Divider />

          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="subtitle2">
                Active assignments ({filtered.length} of {assignmentStages.length})
              </Typography>
              {remaining > 0 && <Chip size="small" color="error" label={`${remaining} blocking`} />}
            </Stack>

            <Box sx={{ maxHeight: 260, overflow: 'auto', border: '1px solid #e3e7ef', borderRadius: 1 }}>
              {filtered.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  No active assignments to show.
                </Typography>
              ) : (
                filtered.map((stage) => (
                  <Box
                    key={stage.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      p: 1.5,
                      borderBottom: '1px solid #f0f2f7',
                      '&:last-of-type': { borderBottom: 0 },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {stage.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {stage.project?.name} · due {formatDate(stage.dueDate)}
                      </Typography>
                    </Box>
                    <StatusChip status={stage.status} />
                  </Box>
                ))
              )}
            </Box>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          Cancel
        </Button>
        <Button variant="outlined" onClick={handleReassign} disabled={busy || filtered.length === 0}>
          {busy ? 'Working…' : `Reassign ${filtered.length} stage${filtered.length === 1 ? '' : 's'}`}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDeactivateNow}
          disabled={busy || remaining > 0 || deactivating}
          title={remaining > 0 ? 'Reassign every active stage first' : ''}
        >
          {deactivating ? 'Deactivating…' : 'Deactivate user'}
        </Button>
      </DialogActions>

      {remaining > 0 && (
        <Box sx={{ px: 3, pb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Deactivation stays disabled until all {remaining} active assignment{remaining === 1 ? ' is' : 's are'} moved.
          </Typography>
        </Box>
      )}
    </Dialog>
  );
}
