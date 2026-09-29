import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';

import PageHeader from '../components/PageHeader';
import { StatusChip } from '../components/StatusChip';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { usePermission } from '../hooks/usePermission';
import { formatDate } from '../utils/format';
import { fetchProjects } from '../features/projects/projectsSlice';
import { STAGE_STATUS } from '../utils/constants';

/**
 * Client / Operations view.
 *
 * Strictly read-only. There is no Documents tab, no Audit tab, no remarks and no
 * status control - and the data itself is already stripped at the API by the
 * `filterClientData` middleware (hidden stages, documents, internal remarks and
 * audit data never reach this browser).
 */
export default function ClientView() {
  const dispatch = useAppDispatch();
  const { items, status, currentMeta } = useAppSelector((state) => state.projects);
  const { can } = usePermission();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  const readOnlyEnforced = !can('stage', 'updateStatus');

  useEffect(() => {
    dispatch(fetchProjects({ limit: 50 }));
  }, [dispatch]);

  const selected = useMemo(() => items.find((p) => p.id === selectedId) || items[0], [items, selectedId]);

  if (status === 'loading') return <PageLoader label="Loading your projects…" />;

  const stages = selected?.stages || [];
  const completed = stages.filter((s) => s.status === STAGE_STATUS.COMPLETED).length;
  const progress = stages.length ? Math.round((completed / stages.length) * 100) : 0;

  return (
    <Box>
      <PageHeader
        title="My Projects"
        subtitle="Read-only progress view. You see only the stages that have been marked client visible."
      />

      {readOnlyEnforced && (
        <Alert severity="info" icon={<ShieldOutlinedIcon fontSize="inherit" />} sx={{ mb: 3 }}>
          This account is read-only. Restricted data (internal stages, documents, internal remarks and the audit trail)
          is removed by the API before it reaches this page.
        </Alert>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={FolderOutlinedIcon}
              title="No projects assigned to you"
              description="Once an administrator creates a project with your account as the client, it will appear here."
            />
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Stack spacing={2}>
              {items.map((project) => (
                <Card
                  key={project.id}
                  sx={{
                    cursor: 'pointer',
                    borderColor: selected?.id === project.id ? 'primary.main' : undefined,
                    borderWidth: selected?.id === project.id ? 2 : 1,
                  }}
                  onClick={() => setSelectedId(project.id)}
                >
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                          {project.code}
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600} noWrap>
                          {project.name}
                        </Typography>
                      </Box>
                      <StatusChip status={project.status} />
                    </Stack>

                    <Box sx={{ mt: 1.5 }}>
                      <LinearProgress variant="determinate" value={project.progressPercent || 0} sx={{ height: 6, borderRadius: 3 }} />
                      <Typography variant="caption" color="text.secondary">
                        {project.progressPercent || 0}% complete · target {formatDate(project.targetEndDate)}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                      <Chip size="small" variant="outlined" label={`${project.stageCount} stages`} />
                      {project.priority && <Chip size="small" variant="outlined" label={project.priority} />}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Grid>

          <Grid item xs={12} md={8}>
            {selected && (
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box>
                      <Typography variant="h5">{selected.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selected.description}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={`SOP v${selected.sopVersion ?? '—'}`} variant="outlined" />
                        <Chip size="small" label={`Manager: ${selected.projectManager?.name || '—'}`} variant="outlined" />
                        <Chip
                          size="small"
                          label={`Target ${formatDate(selected.targetEndDate)}`}
                          variant="outlined"
                        />
                      </Stack>
                    </Box>
                    <Button
                      component={RouterLink}
                      to={`/projects/${selected.id}`}
                      variant="outlined"
                      size="small"
                      sx={{ flexShrink: 0 }}
                    >
                      Full details
                    </Button>
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5 }} />
                    </Box>
                    <Typography variant="h6" sx={{ minWidth: 56, textAlign: 'right' }}>
                      {progress}%
                    </Typography>
                  </Stack>

                  <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
                    <Tab label={`Stages (${stages.length})`} />
                    <Tab label="Read-only notice" />
                  </Tabs>

                  {tab === 0 ? (
                    stages.length === 0 ? (
                      <EmptyState
                        icon={VisibilityOutlinedIcon}
                        title="No client-visible stages"
                        description="The stages of this project have not been shared yet."
                      />
                    ) : (
                      <Stack spacing={1.5}>
                        {stages.map((stage) => (
                          <Box
                            key={stage.id}
                            sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, border: '1px solid #e3e7ef', borderRadius: 1.5 }}
                          >
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                bgcolor: stage.status === STAGE_STATUS.COMPLETED ? 'success.main' : '#eceff5',
                                color: stage.status === STAGE_STATUS.COMPLETED ? '#fff' : 'text.secondary',
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              {stage.order}
                            </Box>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {stage.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {stage.completionDate
                                  ? `Completed ${formatDate(stage.completionDate)}`
                                  : `Target ${formatDate(stage.dueDate)}`}
                              </Typography>
                            </Box>
                            <StatusChip status={stage.status} />
                          </Box>
                        ))}
                      </Stack>
                    )
                  ) : (
                    <Alert severity="info" icon={<LockOutlinedIcon fontSize="inherit" />}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        Why can I not see everything?
                      </Typography>
                      <Typography variant="body2">
                        Internal stages, uploaded documents, internal remarks and the audit trail are removed by the
                        server (<code>filterClientData</code> middleware) before the response is sent. Hiding elements in
                        the browser alone would not be a security control.
                      </Typography>
                      {currentMeta?.filtered && (
                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                          {(selected.stages || []).length} of{' '}
                          {selected.stageCount} stage{selected.stageCount === 1 ? '' : 's'} are client visible.
                        </Typography>
                      )}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
