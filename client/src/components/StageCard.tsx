import type { ReactNode } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import HistoryIcon from '@mui/icons-material/History';
import { StatusChip, VisibilityChip } from './StatusChip';
import { formatDate, initials, isOverdue } from '../utils/format';
import type { Project, Stage } from '../types';
import type { StageStatus } from '../utils/constants';

const PROGRESS: Record<StageStatus, number> = {
  'Not Started': 0,
  'In Progress': 50,
  'On Hold': 25,
  Blocked: 25,
  Completed: 100,
};

interface StageCardProps {
  stage: Stage;
  project?: Pick<Project, 'id' | 'code' | 'name'> | null;
  canUpdateStatus?: boolean;
  readOnly?: boolean;
  onUpdateStatus?: (stage: Stage) => void;
  onShowHistory?: (stage: Stage) => void;
  actions?: ReactNode;
}

/** Stage card used on the workflow board and in the project detail timeline. */
export default function StageCard({
  stage,
  project,
  canUpdateStatus = false,
  readOnly = false,
  onUpdateStatus,
  onShowHistory,
  actions,
}: StageCardProps) {
  const owner = stage.owner;
  const overdue = isOverdue(stage.dueDate, stage.status);

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1, flexGrow: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {project ? `${project.code} · ` : ''}Stage {stage.order}
            </Typography>
            <Typography variant="subtitle1" fontWeight={600} noWrap title={stage.name}>
              {stage.name}
            </Typography>
          </Box>
          <StatusChip status={stage.status} />
        </Stack>

        {stage.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {stage.description}
          </Typography>
        )}

        <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.75 }}>
          <Chip
            size="small"
            variant="outlined"
            color={overdue ? 'error' : 'default'}
            label={overdue ? `Overdue · ${formatDate(stage.dueDate)}` : `Due ${formatDate(stage.dueDate)}`}
          />
          {stage.clientVisible !== undefined && <VisibilityChip clientVisible={stage.clientVisible} />}
          {stage.dependsOn?.length ? (
            <Tooltip title={`Depends on: ${stage.dependsOn.join(', ')}`}>
              <Chip size="small" variant="outlined" color="info" label={`Deps: ${stage.dependsOn.length}`} />
            </Tooltip>
          ) : null}
        </Stack>

        {stage.status === 'Blocked' && stage.blocker && (
          <Box sx={{ mt: 1.5, p: 1, borderRadius: 1, bgcolor: 'error.light', color: 'error.dark' }}>
            <Typography variant="caption" fontWeight={700} display="block">
              Blocker
            </Typography>
            <Typography variant="body2">{stage.blocker}</Typography>
          </Box>
        )}

        {stage.status === 'On Hold' && stage.holdReason && (
          <Box sx={{ mt: 1.5, p: 1, borderRadius: 1, bgcolor: 'warning.light', color: 'warning.dark' }}>
            <Typography variant="caption" fontWeight={700} display="block">
              On hold
            </Typography>
            <Typography variant="body2">{stage.holdReason}</Typography>
          </Box>
        )}

        <Box sx={{ mt: 2 }}>
          <LinearProgress variant="determinate" value={PROGRESS[stage.status] ?? 0} sx={{ height: 6, borderRadius: 3 }} />
        </Box>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 1.5, pt: 0, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          {owner ? (
            <>
              <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: owner.avatarColor || 'primary.main' }}>
                {initials(owner.name)}
              </Avatar>
              <Typography variant="caption" noWrap>
                {owner.name}
              </Typography>
            </>
          ) : (
            <Chip size="small" variant="outlined" label="Unassigned" />
          )}
        </Stack>

        <Stack direction="row" spacing={0.5}>
          {onShowHistory && (
            <Tooltip title="Status history">
              <IconButton size="small" onClick={() => onShowHistory(stage)}>
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canUpdateStatus && !readOnly && (
            <Button size="small" variant="outlined" onClick={() => onUpdateStatus?.(stage)}>
              Update
            </Button>
          )}
          {actions ?? <MoreHorizIcon fontSize="small" sx={{ color: 'text.disabled', ml: 0.5 }} />}
        </Stack>
      </CardActions>
    </Card>
  );
}
