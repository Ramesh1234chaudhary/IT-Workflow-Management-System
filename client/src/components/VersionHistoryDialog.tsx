import {
  Box,
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
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import { VisibilityChip } from './StatusChip';
import { formatDateTime } from '../utils/format';
import EmptyState from './EmptyState';
import type { SopVersion } from '../types';

interface VersionHistoryDialogProps {
  open: boolean;
  versions?: SopVersion[];
  templateName?: string;
  loading?: boolean;
  onClose: () => void;
}

/** Immutable SOP version history for the SOP Builder. */
export default function VersionHistoryDialog({
  open,
  versions = [],
  templateName,
  loading,
  onClose,
}: VersionHistoryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          Version history
          {templateName && (
            <Typography variant="body2" color="text.secondary">
              {templateName}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Publishing creates an immutable snapshot. Projects keep the version they were created from, so a new version
          never changes an existing project.
        </Typography>

        {loading ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            Loading versions…
          </Typography>
        ) : versions.length === 0 ? (
          <EmptyState icon={HistoryIcon} title="No published versions yet" description="Publish the template to create version 1." />
        ) : (
          <Stack spacing={2}>
            {versions.map((version) => (
              <Box key={version.id} sx={{ border: '1px solid #e3e7ef', borderRadius: 1.5, overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.5, bgcolor: '#f7f9fc', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Chip color="primary" label={`v${version.version}`} />
                  <Typography variant="body2">{formatDateTime(version.publishedAt)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    by {version.publishedBy?.name || 'System'}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Chip size="small" variant="outlined" label={`${version.stages?.length ?? version.stageCount ?? 0} stages`} />
                  <Chip size="small" variant="outlined" color="success" label="Immutable" />
                </Box>
                {version.changeNote && (
                  <Typography variant="body2" sx={{ px: 2, py: 1 }}>
                    {version.changeNote}
                  </Typography>
                )}
                <Divider />
                <TableContainer sx={{ maxHeight: 260 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width={60}>#</TableCell>
                        <TableCell>Stage</TableCell>
                        <TableCell>Key</TableCell>
                        <TableCell>Visibility</TableCell>
                        <TableCell>Depends on</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(version.stages || []).map((stage, index) => (
                        <TableRow key={stage.id || stage.key || index} hover>
                          <TableCell>{stage.order}</TableCell>
                          <TableCell>{stage.name}</TableCell>
                          <TableCell>
                            <Chip size="small" label={stage.key} />
                          </TableCell>
                          <TableCell>
                            <VisibilityChip clientVisible={stage.clientVisible} />
                          </TableCell>
                          <TableCell>{stage.dependsOn?.length ? stage.dependsOn.join(', ') : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>

      <Divider />
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Typography variant="caption" color="text.secondary">
          Versions are append-only and cannot be edited or deleted.
        </Typography>
      </Box>
    </Dialog>
  );
}
