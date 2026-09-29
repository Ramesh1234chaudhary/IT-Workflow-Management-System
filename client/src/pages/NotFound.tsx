import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Paper, Typography } from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff';

export default function NotFound() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <Paper sx={{ p: 5, maxWidth: 520, textAlign: 'center' }}>
        <SearchOffIcon color="disabled" sx={{ fontSize: 56, mb: 1 }} />
        <Typography variant="h4" gutterBottom>
          404
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          That page does not exist, or it is outside the scope your role can reach.
        </Typography>
        <Button component={RouterLink} to="/" variant="contained">
          Back to dashboard
        </Button>
      </Paper>
    </Box>
  );
}
