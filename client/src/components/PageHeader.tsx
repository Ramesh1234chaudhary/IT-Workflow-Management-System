import type { ReactNode } from 'react';
import { Box, Breadcrumbs, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: Crumb[];
  action?: ReactNode;
  backTo?: string;
  backLabel?: string;
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  action,
  backTo,
  backLabel = 'Back',
}: PageHeaderProps) {
  return (
    <Box
      sx={{
        mb: 3,
        animation: 'riseIn 320ms cubic-bezier(0.2, 0, 0.2, 1) both',
      }}
    >
      {breadcrumbs.length > 0 && (
        <Breadcrumbs sx={{ mb: 1 }} aria-label="breadcrumb">
          {breadcrumbs.map((crumb) =>
            crumb.to ? (
              <Typography
                key={crumb.label}
                component={RouterLink}
                to={crumb.to}
                variant="body2"
                sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {crumb.label}
              </Typography>
            ) : (
              <Typography key={crumb.label} variant="body2" color="text.primary">
                {crumb.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          {backTo && (
            <Button
              component={RouterLink}
              to={backTo}
              size="small"
              startIcon={<ArrowBackIcon />}
              sx={{ mb: 0.5, ml: -1 }}
            >
              {backLabel}
            </Button>
          )}
          <Typography variant="h5" gutterBottom>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && <Box>{action}</Box>}
      </Stack>
    </Box>
  );
}
