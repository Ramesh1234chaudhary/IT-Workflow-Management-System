import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import { StatusChip } from './StatusChip';
import { formatDateTime, initials } from '../utils/format';
import EmptyState from './EmptyState';
import type { Stage, StatusHistoryEntry } from '../types';

interface StatusHistoryDialogProps {
  open: boolean;
  stage?: Pick<Stage, 'id' | 'name'> | null;
  history?: StatusHistoryEntry[];
  loading?: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function StatusHistoryDialog({
  open,
  stage,
  history = [],
  loading = false,
  onClose,
  onRefresh,
}: StatusHistoryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          Status history
          {stage && (
            <Typography variant="body2" color="text.secondary">
              {stage.name}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={onRefresh} disabled={loading} size="small">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            Loading history…
          </Typography>
        ) : history.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No status changes recorded"
            description="A history entry is written on every manual status change."
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Change</TableCell>
                  <TableCell>Changed by</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.changedAt)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        {entry.fromStatus ? (
                          <StatusChip status={entry.fromStatus} variant="outlined" />
                        ) : (
                          <Chip size="small" label="—" />
                        )}
                        <Typography variant="body2">→</Typography>
                        <StatusChip status={entry.toStatus} />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            color: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {initials(entry.changedBy?.name)}
                        </Box>
                        <Box>
                          <Typography variant="body2">{entry.changedBy?.name || 'System'}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {entry.blocker && (
                        <>
                          <Typography variant="caption" color="text.secondary">
                            Blocker
                          </Typography>
                          <Typography variant="body2">{entry.blocker}</Typography>
                        </>
                      )}
                      {entry.holdReason && (
                        <>
                          <Typography variant="caption" color="text.secondary">
                            Reason
                          </Typography>
                          <Typography variant="body2">{entry.holdReason}</Typography>
                        </>
                      )}
                      {entry.completionDate && (
                        <>
                          <Typography variant="caption" color="text.secondary">
                            Completed
                          </Typography>
                          <Typography variant="body2">{formatDateTime(entry.completionDate)}</Typography>
                        </>
                      )}
                      {entry.note && (
                        <>
                          <Typography variant="caption" color="text.secondary">
                            Note
                          </Typography>
                          <Typography variant="body2">{entry.note}</Typography>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <Divider />
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </Box>
    </Dialog>
  );
}
