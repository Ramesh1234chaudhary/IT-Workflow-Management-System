import { useEffect, useMemo, useState } from 'react';
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
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssessmentIcon from '@mui/icons-material/Assessment';
import GroupWorkIcon from '@mui/icons-material/GroupWork';

import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { StatusChip, PriorityChip } from '../components/StatusChip';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { formatDate, initials } from '../utils/format';
import { STAGE_STATUS_VALUES, STATUS_COLOR } from '../utils/constants';
import {
  fetchProjectProgress,
  fetchStageDistribution,
  fetchSummary,
  fetchWorkload,
  resetReports,
} from '../features/reports/reportsSlice';
import type { ProjectProgressRow, WorkloadRow } from '../types';

const SUMMARY_CARDS = [
  { key: 'projects', label: 'Projects in scope' },
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Active roles' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'auditEntries', label: 'Audit entries' },
];

export default function Reports() {
  const dispatch = useAppDispatch();
  const { summary, progress, distribution, workload, status, error } = useAppSelector((state) => state.reports);
  const [tab, setTab] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    dispatch(fetchSummary());
    dispatch(fetchStageDistribution());
    dispatch(fetchWorkload());
    dispatch(fetchProjectProgress({ status: statusFilter || undefined }));
    return () => {
      dispatch(resetReports());
    };
  }, [dispatch, statusFilter]);

  const totals = progress?.totals;
  const byStatus = distribution?.byStatus || {};
  const distributionTotal = distribution?.total || 0;
  const workloadItems = useMemo(() => (workload?.items as WorkloadRow[]) || [], [workload]);

  const maxLoad = useMemo(
    () => Math.max(1, ...workloadItems.map((w) => w.activeAssignments || 0)),
    [workloadItems],
  );

  return (
    <Box>
      <PageHeader
        title="Reports"
        subtitle="Aggregations are computed on the server and scoped to the projects your role can see."
        action={
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => {
              dispatch(fetchSummary());
              dispatch(fetchStageDistribution());
              dispatch(fetchWorkload());
              dispatch(fetchProjectProgress({ status: statusFilter || undefined }));
            }}
          >
            Refresh
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {SUMMARY_CARDS.map((card) => (
          <Grid item xs={6} md={4} lg={2.4} key={card.key}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="text.secondary">
                  {card.label}
                </Typography>
                <Typography variant="h4">{summary?.[card.key] ?? '—'}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {totals && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Overall completion
            </Typography>
            <Stack direction="row" spacing={3} alignItems="center">
              <Box sx={{ flexGrow: 1 }}>
                <LinearProgress variant="determinate" value={totals.completionRate} sx={{ height: 12, borderRadius: 6 }} />
              </Box>
              <Typography variant="h5" sx={{ minWidth: 64, textAlign: 'right' }}>
                {totals.completionRate}%
              </Typography>
            </Stack>
            <Stack direction="row" spacing={3} sx={{ mt: 2, flexWrap: 'wrap', gap: 2 }} useFlexGap>
              <Metric label="Projects" value={totals.projects} />
              <Metric label="Stages" value={totals.totalStages} />
              <Metric label="Completed" value={totals.completedStages} color="success" />
              <Metric label="Blocked" value={totals.blockedStages} color="error" />
              <Metric label="On hold" value={totals.onHoldStages} color="warning" />
              <Metric label="Overdue" value={totals.overdueStages} color="error" />
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tab icon={<AssessmentIcon />} iconPosition="start" label="Project progress" />
          <Tab icon={<GroupWorkIcon />} iconPosition="start" label="Stage distribution" />
          <Tab label="Team workload" />
        </Tabs>

        <CardContent>
          {status === 'loading' && <PageLoader label="Building report…" minHeight="25vh" />}
          {status === 'failed' && <Alert severity="error">{error}</Alert>}

          {tab === 0 && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Filter by project status
                </Typography>
                <Select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 170 }}>
                  <MenuItem value="">All statuses</MenuItem>
                  {['Planned', 'In Progress', 'On Hold', 'Completed', 'Cancelled'].map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>

              {progress?.items?.length ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Project</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Priority</TableCell>
                        <TableCell align="center">Stages</TableCell>
                        <TableCell align="center">Completed</TableCell>
                        <TableCell align="center">Blocked</TableCell>
                        <TableCell align="center">On hold</TableCell>
                        <TableCell align="center">Overdue</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>Completion</TableCell>
                        <TableCell>Target</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {progress.items.map((row: ProjectProgressRow) => (
                        <TableRow key={String(row.projectId)} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {row.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.code} · SOP v{row.sopVersion ?? '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <StatusChip status={row.status} />
                          </TableCell>
                          <TableCell>
                            <PriorityChip priority={row.priority} />
                          </TableCell>
                          <TableCell align="center">{row.totalStages}</TableCell>
                          <TableCell align="center">{row.completedStages}</TableCell>
                          <TableCell align="center">{row.blockedStages ? <b style={{ color: '#d32f2f' }}>{row.blockedStages}</b> : 0}</TableCell>
                          <TableCell align="center">{row.onHoldStages}</TableCell>
                          <TableCell align="center">{row.overdueStages ? <b style={{ color: '#ed6c02' }}>{row.overdueStages}</b> : 0}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <LinearProgress
                                variant="determinate"
                                value={row.completionRate}
                                color={row.completionRate === 100 ? 'success' : 'primary'}
                                sx={{ height: 7, borderRadius: 4, flexGrow: 1 }}
                              />
                              <Typography variant="caption">{row.completionRate}%</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.targetEndDate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                !status &&
                status !== 'loading' && (
                  <EmptyState icon={AssessmentIcon} title="No projects match" description="Try a different status filter." />
                )
              )}
            </Stack>
          )}

          {tab === 1 && (
            <Box>
              {distributionTotal === 0 ? (
                <EmptyState icon={AssessmentIcon} title="No stages to chart" />
              ) : (
                <Stack spacing={2}>
                  {STAGE_STATUS_VALUES.map((statusValue) => {
                    const value = byStatus[statusValue] || 0;
                    const pct = distributionTotal ? Math.round((value / distributionTotal) * 100) : 0;
                    return (
                      <Box key={statusValue}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                          <StatusChip status={statusValue} />
                          <Typography variant="body2">
                            <b>{value}</b> · {pct}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          color={STATUS_COLOR[statusValue] === 'default' ? 'inherit' : STATUS_COLOR[statusValue]}
                          sx={{ height: 10, borderRadius: 5, opacity: STATUS_COLOR[statusValue] === 'default' ? 0.5 : 1 }}
                        />
                      </Box>
                    );
                  })}
                  <Divider />
                  <Typography variant="caption" color="text.secondary">
                    {distributionTotal} stage{distributionTotal === 1 ? '' : 's'} across all projects in your scope.
                  </Typography>
                </Stack>
              )}
            </Box>
          )}

          {tab === 2 && (
            <Box>
              {workloadItems.length === 0 ? (
                <EmptyState icon={GroupWorkIcon} title="No open assignments" description="Every stage owner is unassigned or complete." />
              ) : (
                <Stack spacing={1.5}>
                  {workloadItems.map((person: WorkloadRow) => (
                    <Stack key={person.id} direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {initials(person.name)}
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {person.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {person.role?.name ?? '—'}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(person.activeAssignments / maxLoad) * 100}
                          sx={{ height: 6, borderRadius: 3, mt: 0.75 }}
                        />
                      </Box>
                      <Chip
                        size="small"
                        label={`${person.activeAssignments} open`}
                        color={person.activeAssignments > 5 ? 'warning' : 'default'}
                      />
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

function Metric({ label, value, color = 'default' }: { label: string; value: number | undefined; color?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" color={color === 'default' ? 'text.primary' : `${color}.main`}>
        {value ?? 0}
      </Typography>
    </Box>
  );
}
