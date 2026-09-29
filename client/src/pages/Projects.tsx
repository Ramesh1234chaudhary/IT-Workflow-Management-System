import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';

import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { PriorityChip, StatusChip } from '../components/StatusChip';
import PermissionGate from '../components/PermissionGate';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useDebounce } from '../hooks/useDebounce';
import { formatDate } from '../utils/format';
import { PROJECT_STATUS, PRIORITY_VALUES } from '../utils/constants';
import { fetchProjects, setFilters } from '../features/projects/projectsSlice';

export default function Projects() {
  const dispatch = useAppDispatch();
  const { items, pagination, filters, status } = useAppSelector((state) => state.projects);
  const [search, setSearch] = useState(filters.search || '');
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    dispatch(fetchProjects({ ...filters, search: debouncedSearch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, filters.page, filters.limit, filters.status, filters.priority, debouncedSearch]);

  return (
    <Box>
      <PageHeader
        title="Projects"
        subtitle="Every project keeps the SOP version it was generated from, even after newer versions are published."
        action={
          <PermissionGate module="project" action="create">
            <Button component={RouterLink} to="/projects/new" variant="contained" startIcon={<AddIcon />}>
              New project
            </Button>
          </PermissionGate>
        }
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              placeholder="Search by name, code or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ maxWidth: 360 }}
            />
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filters.status}
                onChange={(e) => dispatch(setFilters({ status: e.target.value, page: 1 }))}
              >
                <MenuItem value="">All statuses</MenuItem>
                {Object.values(PROJECT_STATUS).map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                label="Priority"
                value={filters.priority}
                onChange={(e) => dispatch(setFilters({ priority: e.target.value, page: 1 }))}
              >
                <MenuItem value="">All priorities</MenuItem>
                {PRIORITY_VALUES.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {pagination.total} project{pagination.total === 1 ? '' : 's'}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {status === 'loading' && (
        <Grid container spacing={2}>
          {[1, 2, 3].map((n) => (
            <Grid item xs={12} md={6} lg={4} key={n}>
              <Card sx={{ height: 210 }} />
            </Grid>
          ))}
        </Grid>
      )}

      {status === 'succeeded' && items.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              icon={FolderOutlinedIcon}
              title="No projects found"
              description="Adjust the filters, or create a project from a published SOP template."
              action={
                <PermissionGate module="project" action="create">
                  <Button component={RouterLink} to="/projects/new" variant="contained" size="small">
                    Create project
                  </Button>
                </PermissionGate>
              }
            />
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        {items.map((project) => (
          <Grid item xs={12} md={6} lg={4} key={project.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {project.code}
                    </Typography>
                    <Typography variant="h6" noWrap title={project.name}>
                      {project.name}
                    </Typography>
                  </Box>
                  <StatusChip status={project.status} />
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }} noWrap>
                  {project.description || 'No description'}
                </Typography>

                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Progress
                    </Typography>
                    <Typography variant="caption" fontWeight={700}>
                      {project.progressPercent || 0}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={project.progressPercent || 0}
                    color={project.progressPercent === 100 ? 'success' : 'primary'}
                    sx={{ height: 7, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {project.completedStageCount}/{project.stageCount} stages completed
                  </Typography>
                </Box>

                <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                  <Chip size="small" variant="outlined" label={`SOP v${project.sopVersion ?? '—'}`} />
                  <PriorityChip priority={project.priority} />
                  <Chip size="small" variant="outlined" label={`Target ${formatDate(project.targetEndDate)}`} />
                </Stack>
              </CardContent>

              <Box sx={{ px: 2, pb: 2 }}>
                <Button component={RouterLink} to={`/projects/${project.id}`} variant="outlined" size="small" fullWidth>
                  Open project
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {pagination.totalPages > 1 && (
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 3 }}>
          <Button disabled={pagination.page <= 1} onClick={() => dispatch(setFilters({ page: pagination.page - 1 }))}>
            Previous
          </Button>
          <Typography variant="body2" sx={{ alignSelf: 'center' }}>
            Page {pagination.page} of {pagination.totalPages}
          </Typography>
          <Button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => dispatch(setFilters({ page: pagination.page + 1 }))}
          >
            Next
          </Button>
        </Stack>
      )}
    </Box>
  );
}
