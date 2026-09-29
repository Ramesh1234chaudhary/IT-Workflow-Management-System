import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { STAGE_STATUS, STAGE_STATUS_VALUES, type StageStatus } from '../utils/constants';
import { toLocalInputValue } from '../utils/format';
import type { Stage } from '../types';

interface StatusModalProps {
  open: boolean;
  stage: Stage | null;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: { status: StageStatus; note?: string; blocker?: string; holdReason?: string; completionDate?: string }) => void;
}

/**
 * Status change dialog with conditional required fields.
 *
 *   Blocked   -> blocker        (required)
 *   On Hold   -> reason         (required)
 *   Completed -> completionDate (required)
 *
 * The same rules are enforced again by the API - this is UX, not security.
 */
export default function StatusModal({ open, stage, saving = false, error, onClose, onSubmit }: StatusModalProps) {
  const [status, setStatus] = useState<StageStatus>(STAGE_STATUS.IN_PROGRESS);
  const [blocker, setBlocker] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(stage?.status === STAGE_STATUS.NOT_STARTED ? STAGE_STATUS.IN_PROGRESS : stage?.status || STAGE_STATUS.IN_PROGRESS);
    setBlocker(stage?.blocker || '');
    setHoldReason(stage?.holdReason || '');
    setCompletionDate(toLocalInputValue(stage?.completionDate) || '');
    setNote('');
    setTouched(false);
  }, [open, stage]);

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    if (status === STAGE_STATUS.BLOCKED && !blocker.trim()) next.blocker = 'A blocker description is required when the stage is Blocked.';
    if (status === STAGE_STATUS.ON_HOLD && !holdReason.trim()) next.holdReason = 'A reason is required when the stage is On Hold.';
    if (status === STAGE_STATUS.COMPLETED && !completionDate) next.completionDate = 'A completion date is required when the stage is Completed.';
    return next;
  }, [status, blocker, holdReason, completionDate]);

  const handleSubmit = () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    const payload: { status: StageStatus; note?: string; blocker?: string; holdReason?: string; completionDate?: string } = { status, note: note.trim() || undefined };
    if (status === STAGE_STATUS.BLOCKED) payload.blocker = blocker.trim();
    if (status === STAGE_STATUS.ON_HOLD) payload.holdReason = holdReason.trim();
    if (status === STAGE_STATUS.COMPLETED) payload.completionDate = new Date(completionDate).toISOString();
    onSubmit(payload);
  };

  const showError = (field: string) => (touched ? errors[field] : '');

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm" TransitionProps={{ onExited: () => setTouched(false) }}>
      <DialogTitle>
        Update status
        {stage && (
          <Typography variant="body2" color="text.secondary">
            {stage.name}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Alert severity="info" icon={<WarningAmberIcon fontSize="inherit" />}>
            Status changes are always manual. Uploading a document or adding a remark never changes a stage status.
          </Alert>

          <FormControl fullWidth size="small">
            <InputLabel id="status-modal-label">New status</InputLabel>
            <Select
              labelId="status-modal-label"
              label="New status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StageStatus)}
            >
              {STAGE_STATUS_VALUES.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {status === STAGE_STATUS.BLOCKED && (
            <TextField
              label="Blocker *"
              placeholder="Describe what is blocking this stage"
              value={blocker}
              onChange={(e) => setBlocker(e.target.value)}
              error={Boolean(showError('blocker'))}
              helperText={showError('blocker') || 'Required for the Blocked status'}
              multiline
              minRows={2}
            />
          )}

          {status === STAGE_STATUS.ON_HOLD && (
            <TextField
              label="Reason for hold *"
              placeholder="Why is the stage on hold?"
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              error={Boolean(showError('holdReason'))}
              helperText={showError('holdReason') || 'Required for the On Hold status'}
              multiline
              minRows={2}
            />
          )}

          {status === STAGE_STATUS.COMPLETED && (
            <TextField
              label="Completion date *"
              type="datetime-local"
              InputLabelProps={{ shrink: true }}
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
              error={Boolean(showError('completionDate'))}
              helperText={showError('completionDate') || 'Required for the Completed status'}
            />
          )}

          <TextField
            label="Change note (optional)"
            placeholder="Anything the team should know about this transition"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">
          Cancel
        </Button>
        <Box>
          <Button onClick={handleSubmit} variant="contained" disabled={saving}>
            {saving ? 'Saving…' : 'Update status'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
