import { useEffect, useMemo } from 'react';
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
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import FolderIcon from '@mui/icons-material/Folder';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HistoryIcon from '@mui/icons-material/History';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { StatusChip } from '../components/StatusChip';
import PermissionGate from '../components/PermissionGate';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useAuth } from '../hooks/useAuth';
import { usePermission } from '../hooks/usePermission';
import { formatDate, formatDateTime } from '../utils/format';
import { STAGE_STATUS, type StageStatus } from '../utils/constants';
import { fetchBoard } from '../features/workflow/workflowSlice';
import { fetchProjects } from '../features/projects/projectsSlice';
import { fetchAuditLogs } from '../features/audit/auditSlice';
import { fetchNotifications } from '../features/notifications/notificationsSlice';
import type { Stage } from '../types';

const Kpis = [
  { key: 'projects', label: 'Projects', icon: FolderIcon, to: '/projects', permission: ['project', 'read'] },
  { key: 'stages', label: 'Open stages', icon: ViewKanbanIcon, to: '/board', permission: ['stage', 'read'] },
  { key: 'blocked', label: 'Blocked', icon: WarningAmberIcon, to: '/board', permission: ['stage', 'read'] },
  { key: 'overdue', label: 'Overdue', icon: HistoryIcon, to: '/board', permission: ['stage', 'read'] },
  { key: 'audit', label: 'Recent changes', icon: DescriptionIcon, to: '/audit', permission: ['audit', 'read'] },
] as const;

type KpiKey = (typeof Kpis)[number]['key'];

interface StageCounts {
  total: number;
  blocked: number;
  onHold: number;
  inProgress: number;
  completed: number;
  overdue: number;
  unassigned: number;
}

/** The board carries a populated project ref; project detail carries a bare id. */
const projectIdOf = (project: Stage['project']): string =>
  typeof project === 'string' ? project : (project?.id ?? '');

const projectNameOf = (project: Stage['project']): string =>
  typeof project === 'string' ? '' : `${project?.name || ''}${project?.code ? ` (${project.code})` : ''}`;

export default function Dashboard() {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { can } = usePermission();

  const board = useAppSelector((state) => state.workflow.board);
  const boardStatus = useAppSelector((state) => state.workflow.boardStatus);
  const projects = useAppSelector((state) => state.projects.items);
  const projectsStatus = useAppSelector((state) => state.projects.status);
  const audit = useAppSelector((state) => state.audit);
  const notifications = useAppSelector((state) => state.notifications);

  const canReadBoard = can('stage', 'read');
  const canReadProjects = can('project', 'read');
  const canReadAudit = can('audit', 'read');

  useEffect(() => {
    if (canReadBoard) dispatch(fetchBoard());
    if (canReadProjects) dispatch(fetchProjects({ limit: 6 }));
    if (canReadAudit) dispatch(fetchAuditLogs({ limit: 8 }));
    dispatch(fetchNotifications());
  }, [dispatch, canReadBoard, canReadProjects, canReadAudit]);

  const stages = useMemo(() => board?.stages || [], [board]);
  const summary = useMemo(() => board?.summary || {}, [board]);

  const counts = useMemo<StageCounts>(
    () => ({
      total: stages.length,
      blocked: stages.filter((s) => s.status === STAGE_STATUS.BLOCKED).length,
      onHold: stages.filter((s) => s.status === STAGE_STATUS.ON_HOLD).length,
      inProgress: stages.filter((s) => s.status === STAGE_STATUS.IN_PROGRESS).length,
      completed: stages.filter((s) => s.status === STAGE_STATUS.COMPLETED).length,
      overdue: stages.filter(
        (s) => s.dueDate && s.status !== STAGE_STATUS.COMPLETED && new Date(s.dueDate) < new Date(),
      ).length,
      unassigned: stages.filter((s) => !s.owner).length,
    }),
    [stages],
  );

  const needsAttention = useMemo(
    () =>
      stages
        .filter((s) => s.status === STAGE_STATUS.BLOCKED || (s.dueDate && new Date(s.dueDate) < new Date() && s.status !== STAGE_STATUS.COMPLETED))
        .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
        .slice(0, 6),
    [stages],
  );

  const kpiValues: Record<KpiKey, number> = {
    projects: projects.length,
    stages: counts.total - counts.completed,
    blocked: counts.blocked,
    overdue: counts.overdue,
    audit: audit.items.length,
  };

  const loading = boardStatus === 'loading' || projectsStatus === 'loading';

  return (
    <Box>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'}`}
        subtitle="Everything below is scoped to the projects your role can see. Values come straight from the API, never from a client-side count."
        action={
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to="/board" variant="outlined" startIcon={<ViewKanbanIcon />}>
              Open board
            </Button>
            <PermissionGate module="project" action="create">
              <Button component={RouterLink} to="/projects/new" variant="contained">
                New project
              </Button>
            </PermissionGate>
          </Stack>
        }
      />

      {loading && <PageLoader label="Loading your dashboard…" minHeight="30vh" />}

      {!loading && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {Kpis.filter((kpi) => can(kpi.permission[0], kpi.permission[1])).map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Grid item xs={6} md={4} lg={2.4} key={kpi.key}>
                  <Card
                    component={RouterLink}
                    to={kpi.to}
                    sx={{ display: 'block', textDecoration: 'none', height: '100%', transition: 'transform .15s', '&:hover': { transform: 'translateY(-2px)' } }}
                  >
                    <CardContent>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Icon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {kpi.label}
                        </Typography>
                      </Stack>
                      <Typography variant="h4">{kpiValues[kpi.key] ?? 0}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">Needs attention</Typography>
                    <Button component={RouterLink} to="/board" size="small" endIcon={<ArrowForwardIcon />}>
                      View all
                    </Button>
                  </Stack>

                  {!canReadBoard ? (
                    <Alert severity="info">Your role does not grant <code>stage:read</code>, so stage data is not loaded.</Alert>
                  ) : needsAttention.length === 0 ? (
                    <EmptyState
                      icon={TrendingUpIcon}
                      title="Nothing is blocked or overdue"
                      description="Every stage in your scope is on track."
                    />
                  ) : (
                    <Stack spacing={1.5}>
                      {needsAttention.map((stage) => {
                        const overdue =
                          stage.dueDate && stage.status !== STAGE_STATUS.COMPLETED && new Date(stage.dueDate) < new Date();
                        return (
                          <Box
                            key={stage.id}
                            component={RouterLink}
                            to={`/projects/${projectIdOf(stage.project)}`}
                            sx={{
                              p: 1.5,
                              border: '1px solid',
                              borderColor: overdue ? 'error.light' : 'divider',
                              borderRadius: 1.5,
                              textDecoration: 'none',
                              color: 'inherit',
                              display: 'block',
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>
                                  {stage.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {projectNameOf(stage.project) || 'Project'} · due {formatDate(stage.dueDate)}
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={0.5}>
                                {overdue && <Chip size="small" color="error" label="Overdue" />}
                                <StatusChip status={stage.status} />
                              </Stack>
                            </Stack>
                            {stage.blocker && (
                              <Typography variant="caption" color="error.dark" display="block" sx={{ mt: 0.5 }}>
                                {stage.blocker}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={5}>
              <Stack spacing={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Pipeline
                    </Typography>
                    {STAGE_STATUS_ORDER.map((status) => {
                      const value = summary[status] ?? COUNT_BY_STATUS[status]?.(counts) ?? 0;
                      const pct = counts.total ? Math.round((value / counts.total) * 100) : 0;
                      return (
                        <Box key={status} sx={{ mb: 1.5 }}>
                          <Stack direction="row" justifyContent="space-between">
                            <StatusChip status={status} />
                            <Typography variant="body2" fontWeight={600}>
                              {value}
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            color={STATUS_BAR_COLOR[status]}
                            sx={{ height: 6, borderRadius: 3, mt: 0.75 }}
                          />
                        </Box>
                      );
                    })}
                    <Divider sx={{ my: 1.5 }} />
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {counts.unassigned > 0 && <Chip size="small" variant="outlined" label={`${counts.unassigned} unassigned`} />}
                      {counts.onHold > 0 && <Chip size="small" color="warning" variant="outlined" label={`${counts.onHold} on hold`} />}
                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Latest notifications
                    </Typography>
                    {notifications.items.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Nothing new.
                      </Typography>
                    ) : (
                      <List dense disablePadding>
                        {notifications.items.slice(0, 5).map((n) => (
                          <ListItem key={n.id} disableGutters sx={{ alignItems: 'flex-start' }}>
                            <ListItemAvatar sx={{ minWidth: 34 }}>
                              {n.isRead ? (
                                <TrendingDownIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                              ) : (
                                <TrendingUpIcon fontSize="small" color="primary" />
                              )}
                            </ListItemAvatar>
                            <ListItemText
                              primary={n.title}
                              secondary={
                                <>
                                  <Typography variant="body2" component="span" display="block">
                                    {n.message}
                                  </Typography>
                                  <Typography variant="caption" component="span" color="text.secondary">
                                    {formatDateTime(n.createdAt)}
                                  </Typography>
                                </>
                              }
                              primaryTypographyProps={{ fontWeight: n.isRead ? 400 : 700, variant: 'body2' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>
              </Stack>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">Recent projects</Typography>
                    <Button component={RouterLink} to="/projects" size="small" endIcon={<ArrowForwardIcon />}>
                      All projects
                    </Button>
                  </Stack>

                  {!canReadProjects ? (
                    <Alert severity="info">Your role does not grant <code>project:read</code>.</Alert>
                  ) : projects.length === 0 ? (
                    <EmptyState icon={FolderIcon} title="No projects yet" description="Create the first project from a published SOP." />
                  ) : (
                    <Grid container spacing={2}>
                      {projects.map((project) => (
                        <Grid item xs={12} sm={6} lg={4} key={project.id}>
                          <Box
                            component={RouterLink}
                            to={`/projects/${project.id}`}
                            sx={{ display: 'block', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, textDecoration: 'none', color: 'inherit' }}
                          >
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {project.name}
                              </Typography>
                              <StatusChip status={project.status} />
                            </Stack>
                            <LinearProgress variant="determinate" value={project.progressPercent || 0} sx={{ height: 6, borderRadius: 3, my: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                              {project.completedStageCount}/{project.stageCount} stages · target {formatDate(project.targetEndDate)}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {canReadAudit && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="h6">Recent activity</Typography>
                      <Button component={RouterLink} to="/audit" size="small" endIcon={<ArrowForwardIcon />}>
                        Audit log
                      </Button>
                    </Stack>
                    {audit.items.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No activity recorded yet.
                      </Typography>
                    ) : (
                      <List dense disablePadding>
                        {audit.items.map((entry) => (
                          <ListItem key={entry.id} disableGutters divider>
                            <ListItemText
                              primary={
                                <Typography variant="body2">
                                  <strong>{entry.actorName || 'System'}</strong> · {entry.action} ·{' '}
                                  {entry.entityLabel || entry.entityType}
                                </Typography>
                              }
                              secondary={formatDateTime(entry.createdAt)}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </>
      )}

      {boardStatus === 'failed' && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Could not load the board data.
        </Alert>
      )}
    </Box>
  );
}

const STAGE_STATUS_ORDER: StageStatus[] = [
  STAGE_STATUS.NOT_STARTED,
  STAGE_STATUS.IN_PROGRESS,
  STAGE_STATUS.ON_HOLD,
  STAGE_STATUS.BLOCKED,
  STAGE_STATUS.COMPLETED,
];

/** Locally counted stage totals, keyed the same way the API summary is. */
const COUNT_BY_STATUS: Partial<Record<StageStatus, (c: StageCounts) => number>> = {
  [STAGE_STATUS.IN_PROGRESS]: (c) => c.inProgress,
  [STAGE_STATUS.ON_HOLD]: (c) => c.onHold,
  [STAGE_STATUS.BLOCKED]: (c) => c.blocked,
  [STAGE_STATUS.COMPLETED]: (c) => c.completed,
};

const STATUS_BAR_COLOR: Record<StageStatus, 'inherit' | 'primary' | 'warning' | 'error' | 'success'> = {
  [STAGE_STATUS.NOT_STARTED]: 'inherit',
  [STAGE_STATUS.IN_PROGRESS]: 'primary',
  [STAGE_STATUS.ON_HOLD]: 'warning',
  [STAGE_STATUS.BLOCKED]: 'error',
  [STAGE_STATUS.COMPLETED]: 'success',
};
