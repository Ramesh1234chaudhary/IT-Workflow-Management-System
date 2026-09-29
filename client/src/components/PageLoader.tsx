import { Box, CircularProgress, Typography } from '@mui/material';

interface PageLoaderProps {
  label?: string;
  minHeight?: string;
}

export default function PageLoader({ label = 'Loading…', minHeight = '60vh' }: PageLoaderProps) {
  return (
    <Box
      sx={{
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <CircularProgress size={38} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
