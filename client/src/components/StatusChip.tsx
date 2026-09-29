import type { SxProps, Theme } from '@mui/material';
import { Chip } from '@mui/material';
import { STATUS_COLOR, PRIORITY_COLOR, SOP_STATUS_COLOR, type StageStatus, type StatusColor } from '../utils/constants';

/** Maps project and SOP statuses onto the five stage statuses the palette knows. */
const STATUS_ALIAS: Record<string, StageStatus> = {
  'Not Started': 'Not Started',
  'In Progress': 'In Progress',
  'On Hold': 'On Hold',
  Blocked: 'Blocked',
  Completed: 'Completed',
};

type ChipSize = 'small' | 'medium';
type ChipVariant = 'filled' | 'outlined';

interface StatusChipProps {
  status: string;
  size?: ChipSize;
  variant?: ChipVariant;
  sx?: SxProps<Theme>;
}

export function StatusChip({ status, size = 'small', variant = 'filled', sx }: StatusChipProps) {
  const key = STATUS_ALIAS[status];
  const color: StatusColor = (key && STATUS_COLOR[key]) || SOP_STATUS_COLOR[status as keyof typeof SOP_STATUS_COLOR] || PRIORITY_COLOR[status as keyof typeof PRIORITY_COLOR] || 'default';
  return <Chip label={status} size={size} color={color} variant={variant} sx={sx} />;
}

interface PriorityChipProps {
  priority: string;
  size?: ChipSize;
}

export function PriorityChip({ priority, size = 'small' }: PriorityChipProps) {
  return <Chip label={priority} size={size} color={PRIORITY_COLOR[priority as keyof typeof PRIORITY_COLOR] || 'default'} variant="outlined" />;
}

interface VisibilityChipProps {
  clientVisible: boolean;
  size?: ChipSize;
}

export function VisibilityChip({ clientVisible, size = 'small' }: VisibilityChipProps) {
  return (
    <Chip
      size={size}
      color={clientVisible ? 'success' : 'default'}
      variant="outlined"
      label={clientVisible ? 'Client visible' : 'Internal only'}
    />
  );
}
