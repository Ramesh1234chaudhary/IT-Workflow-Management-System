import { useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';

import PageHeader from '../components/PageHeader';
import StageCard from '../components/StageCard';
import StatusModal from '../components/StatusModal';
import StatusHistoryDialog from '../components/StatusHistoryDialog';
import EmptyState from '../components/EmptyState';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { usePermission } from '../hooks/usePermission';
import { useDebounce } from '../hooks/useDebounce';
import {
  selectBoardFilters,
  selectBoardProjects,
  selectBoardStats,
  selectFilteredBoardStages,
  selectPendingStatusIds,
} from '../utils/selectors';
import { STAGE_STATUS } from '../utils/constants';
import type { StatusUpdatePayload } from '../api/api';
import {
  fetchBoard,
  fetchStageHistory,
  resetWorkflowState,
  setBoardFilters,
  clearWorkflowError,
  updateStageStatus,
} from '../features/workflow/workflowSlice';
import type { BoardStage, Project } from '../types';

const TABS = [
  { key: 'all', label: 'All stages' },
  { key: 'mine', label: 'Assigned to me' },
  { key: 'unassigned', label: 'Unassigned' },
];

/** The board endpoint returns a raw `projectId` next to the populated `project`. */
type BoardStageRow = BoardStage & { projectId?: string };

/** The board endpoint returns lean project documents, so the id arrives as `_id`. */
type BoardProject = Project & { _id?: string };

/**
 * The board is the one endpoint that hands back raw stage documents rather than
 * serialised ones, so a stage carries `_id` and no `id`. Reading `stage.id`
 * here yields undefined and every status change is rejected as an invalid id.
 */
const stageIdOf = (stage: BoardStageRow): string =>
  (stage as unknown as { _id?: string })._id || stage.id;

/**
 * `GET /workflow/board` populates `project` on every stage, so it arrives as an
 * object even though the domain type models the field as the raw id.
 */
const projectRefOf = (stage: BoardStage) =>
  stage.project as unknown as { _id?: string; id?: string; name?: string; code?: string } | null;

const projectIdOf = (stage: BoardStageRow) => projectRefOf(stage)?._id || projectRefOf(stage)?.id || stage.projectId;

export default function WorkflowBoard() {
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const { can } = usePermission();

  const stages = useAppSelector(selectFilteredBoardStages) as BoardStageRow[];
  const projects = useAppSelector(selectBoardProjects) as BoardProject[];
  const filters = useAppSelector(selectBoardFilters);
  const stats = useAppSelector(selectBoardStats);
  const pendingIds = useAppSelector(selectPendingStatusIds);
  const boardStatus = useAppSelector((state) => state.workflow.boardStatus);
  const actionError = useAppSelector((state) => state.workflow.actionError);
  const history = useAppSelector((state) => state.workflow.history);
  const historyStatus = useAppSelector((state) => state.workflow.historyStatus);

  const canUpdateStatus = can('stage', 'updateStatus');
  const canReadHistory = can('stage', 'readHistory');

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [statusModal, setStatusModal] = useState<{ open: boolean; stage: BoardStageRow | null }>({
    open: false,
    stage: null,
  });
  const [historyModal, setHistoryModal] = useState<{ open: boolean; stage: BoardStageRow | null }>({
    open: false,
    stage: null,
  });
  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    dispatch(fetchBoard());
    return () => {
      dispatch(resetWorkflowState());
    };
  }, [dispatch]);

  const visibleStages = useMemo(() => {
    let result = stages;
    if (tab === 'mine') result = result.filter((s) => s.isMine);
    if (tab === 'unassigned') result = result.filter((s) => !s.owner);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          projectRefOf(s)?.name?.toLowerCase().includes(q) ||
          projectRefOf(s)?.code?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [stages, tab, debouncedSearch]);

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(String(p._id || p.id), p));
    return map;
  }, [projects]);

  /**
   * Optimistic status change: the card updates immediately, and rolls back to the
   * exact previous snapshot if the API rejects the transition.
   */
  const handleStatusSubmit = async (payload: StatusUpdatePayload) => {
    const stage = statusModal.stage;
    if (!stage) return;

    const projectId = projectIdOf(stage) as string;
    const rollback = {
      status: stage.status,
      blocker: stage.blocker || '',
      holdReason: stage.holdReason || '',
      completionDate: stage.completionDate || null,
    };
    const optimistic = {
      status: payload.status,
      blocker: payload.blocker ?? stage.blocker ?? '',
      holdReason: payload.holdReason ?? stage.holdReason ?? '',
      completionDate: payload.status === STAGE_STATUS.COMPLETED ? payload.completionDate : null,
    };

    const result = await dispatch(
      updateStageStatus({ projectId, stageId: stageIdOf(stage), body: payload, optimistic, rollback }),
    );

    if (updateStageStatus.fulfilled.match(result)) {
      enqueueSnackbar(result.payload.message, { variant: 'success' });
      setStatusModal({ open: false, stage: null });
    } else {
      enqueueSnackbar(`${result.payload?.message || 'Update failed'} — change rolled back.`, { variant: 'error' });
      setStatusModal({ open: false, stage: null });
    }
  };

  const handleShowHistory = (stage: BoardStage) => {
    setHistoryModal({ open: true, stage: stage as BoardStageRow });
    const projectId = projectIdOf(stage as BoardStageRow) as string;
    dispatch(fetchStageHistory({ projectId, stageId: stageIdOf(stage), params: { limit: 50 } }));
  };

  const saving = statusModal.open && pendingIds.includes(stageIdOf(statusModal.stage as BoardStageRow));

  return (
    <Box>
      <PageHeader
        title="Workflow Board"
        subtitle="Manually move stages forward. Nothing changes status automatically — a document upload or remark never moves a stage."
        action={
          <Stack direction="row" spacing={1}>
            <TextField
              placeholder="Search stage or project…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ width: { xs: 180, sm: 280 } }}
            />
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => dispatch(fetchBoard())}
              disabled={boardStatus === 'loading'}
            >
              Refresh
            </Button>
          </Stack>
        }
      />

      {!canUpdateStatus && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your role can view this board but not change stage status. The <strong>Update</strong> action requires the
          <code> stage:updateStatus </code> permission.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Overall progress
              </Typography>
              <Typography variant="h4" gutterBottom>
                {stats.progressPercent}%
              </Typography>
              <LinearProgress variant="determinate" value={stats.progressPercent} sx={{ height: 8, borderRadius: 4 }} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {stats.completed} of {stats.total} stages completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap gap={1}>
                <Chip size="small" label={`${stats.total} visible`} />
                <Chip size="small" color="default" label={`${stats.byStatus['Not Started']} not started`} />
                <Chip size="small" color="primary" label={`${stats.byStatus['In Progress']} in progress`} />
                <Chip size="small" color="warning" label={`${stats.byStatus['On Hold']} on hold`} />
                <Chip size="small" color="error" label={`${stats.byStatus.Blocked} blocked`} />
                <Chip size="small" color="success" label={`${stats.byStatus.Completed} completed`} />
                {stats.overdue > 0 && (
                  <Chip size="small" color="error" variant="outlined" label={`${stats.overdue} overdue`} />
                )}
                {stats.unassigned > 0 && (
                  <Chip size="small" variant="outlined" label={`${stats.unassigned} unassigned`} />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_e, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ px: 1 }}>
          {TABS.map((t) => (
            <Tab key={t.key} value={t.key} label={t.label} />
          ))}
        </Tabs>
        <CardContent sx={{ pt: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="board-status-label">Status</InputLabel>
              <Select
                labelId="board-status-label"
                label="Status"
                value={filters.status}
                onChange={(e) => dispatch(setBoardFilters({ status: e.target.value }))}
              >
                <MenuItem value="">All statuses</MenuItem>
                {Object.values(STAGE_STATUS).map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="board-project-label">Project</InputLabel>
              <Select
                labelId="board-project-label"
                label="Project"
                value={filters.projectId}
                onChange={(e) => dispatch(setBoardFilters({ projectId: e.target.value }))}
              >
                <MenuItem value="">All projects</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p._id || p.id} value={p._id || p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  checked={filters.mine}
                  onChange={(e) => dispatch(setBoardFilters({ mine: e.target.checked }))}
                />
              }
              label="Only my stages"
            />
            <Box sx={{ flexGrow: 1 }} />
            <Button
              size="small"
              disabled={!filters.status && !filters.projectId && !filters.mine}
              onClick={() => dispatch(setBoardFilters({ status: '', projectId: '', mine: false }))}
            >
              Clear filters
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {boardStatus === 'loading' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {boardStatus === 'succeeded' && visibleStages.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              icon={ViewKanbanIcon}
              title="No stages match your filters"
              description="Try a different tab, clear the filters, or check that a project has been assigned to you."
            />
          </CardContent>
        </Card>
      )}

      {visibleStages.length > 0 && (
        <Grid container spacing={2}>
          {visibleStages.map((stage) => (
            <Grid item xs={12} sm={6} lg={4} key={stageIdOf(stage)}>
              <StageCard
                stage={stage}
                project={projectById.get(String(projectRefOf(stage)?._id || projectRefOf(stage)?.id))}
                canUpdateStatus={canUpdateStatus}
                onUpdateStatus={(s) => setStatusModal({ open: true, stage: s as BoardStageRow })}
                onShowHistory={canReadHistory ? handleShowHistory : undefined}
                actions={
                  pendingIds.includes(stageIdOf(stage)) ? (
                    <Chip size="small" label="Saving…" color="primary" variant="outlined" />
                  ) : null
                }
              />
            </Grid>
          ))}
        </Grid>
      )}

      <StatusModal
        open={statusModal.open}
        stage={statusModal.stage}
        saving={saving}
        error={saving ? null : actionError}
        onClose={() => setStatusModal({ open: false, stage: null })}
        onSubmit={handleStatusSubmit}
      />

      <StatusHistoryDialog
        open={historyModal.open}
        stage={historyModal.stage}
        history={history}
        loading={historyStatus === 'loading'}
        onClose={() => setHistoryModal({ open: false, stage: null })}
        onRefresh={() => {
          const stage = historyModal.stage;
          if (!stage) return;
          const projectId = projectIdOf(stage) as string;
          dispatch(fetchStageHistory({ projectId, stageId: stageIdOf(stage), params: { limit: 50 } }));
        }}
      />

      {actionError && !statusModal.open && (
        <Alert severity="error" onClose={() => dispatch(clearWorkflowError())} sx={{ mt: 2 }}>
          {actionError}
        </Alert>
      )}
    </Box>
  );
}
