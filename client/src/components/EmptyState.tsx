import type { ElementType, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

interface EmptyStateProps {
  title?: string;
  description?: ReactNode;
  icon?: ElementType;
  action?: ReactNode;
}

export default function EmptyState({
  title = 'Nothing here yet',
  description,
  icon: Icon = InboxOutlinedIcon,
  action,
}: EmptyStateProps) {
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <Icon sx={{ fontSize: 46, color: 'text.disabled', mb: 1 }} />
      <Typography variant="h6" color="text.secondary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 480, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
