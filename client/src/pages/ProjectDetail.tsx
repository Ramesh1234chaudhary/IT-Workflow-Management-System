import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import PersonIcon from '@mui/icons-material/Person';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import DescriptionIcon from '@mui/icons-material/Description';

import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { PriorityChip, StatusChip, VisibilityChip } from '../components/StatusChip';
import StageCard from '../components/StageCard';
import StatusModal from '../components/StatusModal';
import StatusHistoryDialog from '../components/StatusHistoryDialog';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { usePermission } from '../hooks/usePermission';
import { formatBytes, formatDate, formatDateTime, initials } from '../utils/format';
import { STAGE_STATUS } from '../utils/constants';
import { documentsApi } from '../api/api';
import type { StatusUpdatePayload } from '../api/api';
import { fetchProject } from '../features/projects/projectsSlice';
import {
  addStageRemark,
  assignStage,
  deleteDocument,
  fetchDocuments,
  fetchProjectHistory,
  fetchStageHistory,
  updateStageStatus,
  uploadDocument,
} from '../features/workflow/workflowSlice';
import { fetchAssignableUsers } from '../features/users/usersSlice';
import type { Project, ProjectDocument, Role, Stage, UserRef, UserSummary } from '../types';

/** `GET /projects/:id` returns the project together with its generated stages. */
type ProjectDetail = Project & {
  stages: Stage[];
  progressPercent?: number;
  sopVersionNumber?: number | null;
  members?: UserRef[];
};

/** Set by the API when it stripped a payload down to a client-scoped account. */
type ProjectMeta = {
  filtered: boolean;
  scope: string;
  visibleStageCount?: number;
  totalStageCount?: number;
};

/** Document rows add the client visibility flag and timestamp the table renders. */
type DocumentRow = ProjectDocument & { clientVisible: boolean; createdAt?: string };

type PartyUser = UserRef & { role?: Role | null };
type AssignableUser = UserSummary & { role?: Role | null };

/**
 * When a request asks for a blob, axios leaves a failed JSON error body as an
 * opaque Blob, so the real message has to be unwrapped before it can be shown.
 */
const blobErrorMessage = async (body: Blob): Promise<string> => {
  try {
    const parsed = JSON.parse(await body.text()) as { message?: string };
    return parsed.message || 'Download failed';
  } catch {
    return 'Download failed';
  }
};

export default function ProjectDetail() {
  // The route is `/projects/:id`, so the param is always present at runtime.
  const { id } = useParams() as { id: string };
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const fileInput = useRef<HTMLInputElement>(null);
  const { can } = usePermission();

  const { current: project, currentMeta } = useAppSelector((state) => state.projects) as {
    current: ProjectDetail | null;
    currentMeta: ProjectMeta | null;
  };
  const { documents, history, historyStatus, actionStatus, actionError } = useAppSelector((state) => state.workflow);
  const assignable = useAppSelector((state) => state.users.assignable) as AssignableUser[];

  const [tab, setTab] = useState('stages');
  const [statusModal, setStatusModal] = useState<{ open: boolean; stage: Stage | null }>({ open: false, stage: null });
  const [historyModal, setHistoryModal] = useState<{ open: boolean; stage: Stage | null }>({ open: false, stage: null });
  const [assignModal, setAssignModal] = useState<{ open: boolean; stage: Stage | null; ownerId: string }>({
    open: false,
    stage: null,
    ownerId: '',
  });
  const [remarkModal, setRemarkModal] = useState<{ open: boolean; stage: Stage | null; remark: string }>({
    open: false,
    stage: null,
    remark: '',
  });
  const [uploadModal, setUploadModal] = useState<{
    open: boolean;
    stageId: string;
    description: string;
    clientVisible: boolean;
    file: File | null;
  }>({ open: false, stageId: '', description: '', clientVisible: false, file: null });
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canUpdateStatus = can('stage', 'updateStatus');
  const canReadHistory = can('stage', 'readHistory');
  const canRemark = can('stage', 'remark');
  const canAssign = can('stage', 'assign');
  const canUpload = can('document', 'upload');
  const canDeleteDoc = can('document', 'delete');
  const canReadDocs = can('document', 'read');

  useEffect(() => {
    dispatch(fetchProject(id));
  }, [dispatch, id]);

  useEffect(() => {
    if (canReadDocs) dispatch(fetchDocuments({ projectId: id, params: {} }));
    if (canReadHistory) dispatch(fetchProjectHistory({ projectId: id, params: { limit: 100 } }));
    if (canAssign) dispatch(fetchAssignableUsers());
  }, [dispatch, id, canReadDocs, canReadHistory, canAssign]);

  const stages = useMemo(() => (project?.stages || []).slice().sort((a, b) => a.order - b.order), [project]);

  const progress = project?.progressPercent || 0;
  const completed = stages.filter((s) => s.status === STAGE_STATUS.COMPLETED).length;

  const handleStatusSubmit = async (payload: StatusUpdatePayload) => {
    const stage = statusModal.stage;
    if (!stage) return;

    const result = await dispatch(
      updateStageStatus({ projectId: id, stageId: stage.id, body: payload, optimistic: payload, rollback: stage }),
    );
    if (updateStageStatus.fulfilled.match(result)) {
      enqueueSnackbar(result.payload.message, { variant: 'success' });
    } else {
      enqueueSnackbar(`${result.payload?.message || 'Update failed'} — the change was rolled back.`, { variant: 'error' });
    }
    setStatusModal({ open: false, stage: null });
  };

  const handleAssign = async () => {
    // The API takes `owner`, matching `AssignStagePayload`.
    const result = await dispatch(
      assignStage({
        projectId: id,
        stageId: assignModal.stage!.id,
          body: { owner: assignModal.ownerId || null },
      }),
    );
    if (assignStage.fulfilled.match(result)) {
      enqueueSnackbar('Stage owner updated', { variant: 'success' });
    } else {
      enqueueSnackbar(result.payload?.message || 'Could not assign the stage', { variant: 'error' });
    }
    setAssignModal({ open: false, stage: null, ownerId: '' });
  };

  const handleRemark = async () => {
    // The API takes `remark`, matching `RemarkPayload`.
    const result = await dispatch(
      addStageRemark({
        projectId: id,
        stageId: remarkModal.stage!.id,
          body: { remark: remarkModal.remark },
      }),
    );
    if (addStageRemark.fulfilled.match(result)) {
      enqueueSnackbar('Remark saved. The stage status was not changed.', { variant: 'success' });
    } else {
      enqueueSnackbar(result.payload?.message || 'Could not save the remark', { variant: 'error' });
    }
    setRemarkModal({ open: false, stage: null, remark: '' });
  };

  const handleUpload = async () => {
    if (!uploadModal.file) {
      enqueueSnackbar('Choose a file first', { variant: 'warning' });
      return;
    }
    const formData = new FormData();
    formData.append('document', uploadModal.file);
    if (uploadModal.stageId) formData.append('stageId', uploadModal.stageId);
    if (uploadModal.description) formData.append('description', uploadModal.description);
    formData.append('clientVisible', String(uploadModal.clientVisible));

    setUploading(true);
    const result = await dispatch(uploadDocument({ projectId: id, formData }));
    setUploading(false);
    if (uploadDocument.fulfilled.match(result)) {
      // The controller also answers with a confirmation `message`.
      enqueueSnackbar((result.payload as { document: ProjectDocument; message?: string }).message, { variant: 'success' });
      setUploadModal({ open: false, stageId: '', description: '', clientVisible: false, file: null });
    } else {
      enqueueSnackbar(result.payload?.message || 'Upload failed', { variant: 'error' });
    }
  };

  const handleDeleteDocument = async () => {
    const result = await dispatch(deleteDocument(deleteTarget!.id));
    setDeleteTarget(null);
    if (deleteDocument.fulfilled.match(result)) {
      enqueueSnackbar('Document deleted', { variant: 'success' });
    } else {
      enqueueSnackbar(result.payload?.message || 'Could not delete the document', { variant: 'error' });
    }
  };

  /**
   * The file is fetched through the authenticated axios client and then handed
   * to the browser as a blob. A bare href or window.open would carry no
   * Authorization header and the route would always answer 401, because the
   * access token lives in memory and the refresh token is not readable by JS.
   */
  const handleDownload = async (doc: DocumentRow) => {
    setDownloadingId(doc.id);
    try {
      const response = await documentsApi.download(doc.id);
      const disposition = String(response.headers['content-disposition'] || '');
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const fileName = match ? decodeURIComponent(match[1]) : doc.originalName || doc.fileName || 'download';

      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const body = (error as { response?: { data?: Blob } }).response?.data;
      const message = body instanceof Blob ? await blobErrorMessage(body) : '';
      enqueueSnackbar(message || 'Could not download the document', { variant: 'error' });
    } finally {
      setDownloadingId(null);
    }
  };

  const showStageHistory = useCallback(
    (stage: Stage) => {
      setHistoryModal({ open: true, stage });
      dispatch(fetchStageHistory({ projectId: id, stageId: stage.id, params: { limit: 50 } }));
    },
    [dispatch, id],
  );

  if (!project) return <PageLoader label="Loading project…" />;

  /**
   * The API sets `meta.filtered` when it stripped data for a client-scoped
   * account. Never infer this from a missing field: an internal project can
   * legitimately have no internal remarks.
   */
  const isClientView = Boolean(currentMeta?.filtered);
  const documentRows = documents as DocumentRow[];

  return (
    <Box>
      <PageHeader
        title={project.name}
        subtitle={project.description}
        breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: project.name }]}
        action={
          <Stack direction="row" spacing={1}>
            <StatusChip status={project.status} />
            <PriorityChip priority={project.priority} />
          </Stack>
        }
      />

      {currentMeta?.filtered && (
        <Alert severity="info" icon={<LockOutlinedIcon fontSize="inherit" />} sx={{ mb: 3 }}>
          You are seeing {currentMeta.visibleStageCount} of {currentMeta.totalStageCount} stages. Internal stages, remarks
          and documents are removed by the API for client-scoped accounts.
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={3} alignItems="center">
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h4" gutterBottom>
                    {progress}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    color={progress === 100 ? 'success' : 'primary'}
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {completed} of {stages.length} stages completed
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    SOP version
                  </Typography>
                  <Typography variant="h6">v{project.sopVersionNumber ?? '—'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Locked at creation
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Target date
                  </Typography>
                  <Typography variant="h6">{formatDate(project.targetEndDate)}</Typography>
                </Box>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Party label="Client" user={project.client} />
                <Party label="Project manager" user={project.projectManager} />
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Started
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatDate(project.startDate)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Team
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {project.members?.length || 0} member{project.members?.length === 1 ? '' : 's'}
                  </Typography>
                </Grid>
              </Grid>

              {project.internalRemarks && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Alert severity="warning" icon={<LockOutlinedIcon fontSize="inherit" />}>
                    <Typography variant="caption" fontWeight={700} display="block">
                      Internal remarks · never exposed to client accounts
                    </Typography>
                    <Typography variant="body2">{project.internalRemarks}</Typography>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status distribution
              </Typography>
              <Stack spacing={1.25}>
                {Object.values(STAGE_STATUS).map((status) => {
                  const count = stages.filter((s) => s.status === status).length;
                  return (
                    <Stack key={status} direction="row" justifyContent="space-between" alignItems="center">
                      <StatusChip status={status} />
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1, ml: 2 }}>
                        <LinearProgress
                          variant="determinate"
                          value={stages.length ? (count / stages.length) * 100 : 0}
                          sx={{ height: 7, borderRadius: 4, flexGrow: 1 }}
                        />
                        <Typography variant="caption" sx={{ minWidth: 20, textAlign: 'right' }}>
                          {count}
                        </Typography>
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tab value="stages" label={`Stages (${stages.length})`} />
          {canReadDocs && <Tab value="documents" label={`Documents (${documents.length})`} />}
          {canReadHistory && <Tab value="history" label="Status history" />}
        </Tabs>

        <CardContent>
          {tab === 'stages' && (
            <Grid container spacing={2}>
              {stages.map((stage) => (
                <Grid item xs={12} md={6} lg={4} key={stage.id}>
                  <StageCard
                    stage={stage}
                    canUpdateStatus={canUpdateStatus}
                    readOnly={isClientView}
                    onUpdateStatus={(s) => setStatusModal({ open: true, stage: s })}
                    onShowHistory={canReadHistory ? showStageHistory : undefined}
                    actions={
                      <>
                        {canRemark && (
                          <Tooltip title="Add internal remark (does not change status)">
                            <IconButton
                              size="small"
                              onClick={() => setRemarkModal({ open: true, stage, remark: stage.internalRemarks || '' })}
                            >
                              <ChatBubbleOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canAssign && !isClientView && (
                          <Tooltip title="Assign owner">
                            <IconButton
                              size="small"
                              onClick={() => setAssignModal({ open: true, stage, ownerId: stage.owner?.id || '' })}
                            >
                              <PersonIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    }
                  />
                </Grid>
              ))}
            </Grid>
          )}

          {tab === 'documents' && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Alert severity="info" sx={{ py: 0 }}>
                  Uploading a document never changes a stage status. Re-uploading the same document name creates a new
                  version instead of overwriting.
                </Alert>
                {canUpload && (
                  <Button
                    variant="contained"
                    startIcon={<UploadFileIcon />}
                    onClick={() => setUploadModal({ open: true, stageId: '', description: '', clientVisible: false, file: null })}
                    sx={{ flexShrink: 0, ml: 2 }}
                  >
                    Upload
                  </Button>
                )}
              </Stack>

              {documentRows.length === 0 ? (
                <EmptyState
                  icon={DescriptionIcon}
                  title="No documents"
                  description="Upload the first document for this project."
                />
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>File</TableCell>
                        <TableCell>Stage</TableCell>
                        <TableCell>Version</TableCell>
                        <TableCell>Visibility</TableCell>
                        <TableCell>Uploaded</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {documentRows.map((doc) => {
                        const stage = stages.find((s) => s.id === doc.stage);
                        return (
                          <TableRow key={doc.id} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {doc.originalName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatBytes(doc.size)} · {doc.mimeType}
                              </Typography>
                            </TableCell>
                            <TableCell>{stage?.name || 'Project level'}</TableCell>
                            <TableCell>
                              <Chip size="small" label={`v${doc.version}`} color={doc.isLatest ? 'primary' : 'default'} />
                            </TableCell>
                            <TableCell>
                              <VisibilityChip clientVisible={doc.clientVisible} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{doc.uploadedBy?.name || '—'}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDateTime(doc.createdAt)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Download">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDownload(doc)}
                                  disabled={downloadingId === doc.id}
                                >
                                  {downloadingId === doc.id ? (
                                    <CircularProgress size={18} />
                                  ) : (
                                    <DownloadIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                              {canDeleteDoc && (
                                <Tooltip title="Delete">
                                  <IconButton size="small" color="error" onClick={() => setDeleteTarget(doc)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {tab === 'history' && (
            <Box>
              {historyStatus === 'loading' ? (
                <PageLoader label="Loading history…" minHeight="20vh" />
              ) : history.length === 0 ? (
                <EmptyState
                  icon={HistoryIcon}
                  title="No status changes yet"
                  description="A history row is written on every manual status change."
                />
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>When</TableCell>
                        <TableCell>Stage</TableCell>
                        <TableCell>Change</TableCell>
                        <TableCell>By</TableCell>
                        <TableCell>Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {history.map((entry) => (
                        <TableRow key={entry.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.changedAt)}</TableCell>
                          <TableCell>{entry.stageName || '—'}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              {entry.fromStatus && <StatusChip status={entry.fromStatus} variant="outlined" />}
                              <Typography variant="body2">→</Typography>
                              <StatusChip status={entry.toStatus} />
                            </Stack>
                          </TableCell>
                          <TableCell>{entry.changedBy?.name || 'System'}</TableCell>
                          <TableCell>{entry.blocker || entry.holdReason || entry.note || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------- Dialogs -------------------------------- */}

      <StatusModal
        open={statusModal.open}
        stage={statusModal.stage}
        saving={actionStatus === 'loading'}
        error={actionError}
        onClose={() => setStatusModal({ open: false, stage: null })}
        onSubmit={handleStatusSubmit}
      />

      <StatusHistoryDialog
        open={historyModal.open}
        stage={historyModal.stage}
        history={history}
        loading={historyStatus === 'loading'}
        onClose={() => setHistoryModal({ open: false, stage: null })}
        onRefresh={() => showStageHistory(historyModal.stage!)}
      />

      <Dialog
        open={assignModal.open}
        onClose={() => setAssignModal({ open: false, stage: null, ownerId: '' })}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Assign stage owner</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {assignModal.stage?.name}
          </Typography>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Owner</InputLabel>
            <Select
              label="Owner"
              value={assignModal.ownerId}
              onChange={(e) => setAssignModal((s) => ({ ...s, ownerId: e.target.value }))}
            >
              <MenuItem value="">
                <em>Unassigned</em>
              </MenuItem>
              {assignable.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  <ListItemText primary={user.name} secondary={user.role?.name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setAssignModal({ open: false, stage: null, ownerId: '' })}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAssign} disabled={actionStatus === 'loading'}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={remarkModal.open}
        onClose={() => setRemarkModal({ open: false, stage: null, remark: '' })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Internal remark</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Remarks are internal and are never shown to client-scoped accounts. Saving a remark does not change the
            stage status.
          </Alert>
          <TextField
            label="Remark"
            fullWidth
            multiline
            minRows={4}
            value={remarkModal.remark}
            onChange={(e) => setRemarkModal((s) => ({ ...s, remark: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setRemarkModal({ open: false, stage: null, remark: '' })}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleRemark} disabled={actionStatus === 'loading'}>
            Save remark
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={uploadModal.open}
        onClose={() => setUploadModal({ open: false, stageId: '', description: '', clientVisible: false, file: null })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Upload document</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
              {uploadModal.file ? uploadModal.file.name : 'Choose file'}
              <input
                hidden
                type="file"
                ref={fileInput}
                onChange={(e) => setUploadModal((s) => ({ ...s, file: e.target.files?.[0] || null }))}
              />
            </Button>
            {uploadModal.file && (
              <Typography variant="caption" color="text.secondary">
                {formatBytes(uploadModal.file.size)} · {uploadModal.file.type}
              </Typography>
            )}

            <FormControl fullWidth size="small">
              <InputLabel>Attach to stage</InputLabel>
              <Select
                label="Attach to stage"
                value={uploadModal.stageId}
                onChange={(e) => setUploadModal((s) => ({ ...s, stageId: e.target.value }))}
              >
                <MenuItem value="">Project level</MenuItem>
                {stages.map((stage) => (
                  <MenuItem key={stage.id} value={stage.id}>
                    {stage.order}. {stage.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Description"
              multiline
              minRows={2}
              value={uploadModal.description}
              onChange={(e) => setUploadModal((s) => ({ ...s, description: e.target.value }))}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={uploadModal.clientVisible}
                  onChange={(e) => setUploadModal((s) => ({ ...s, clientVisible: e.target.checked }))}
                />
              }
              label="Visible to the client"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setUploadModal({ open: false, stageId: '', description: '', clientVisible: false, file: null })}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete document"
        message={`Permanently delete "${deleteTarget?.originalName}"? This is recorded in the audit log.`}
        confirmLabel="Delete"
        color="error"
        onConfirm={handleDeleteDocument}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}

function Party({ label, user }: { label: string; user?: PartyUser | null }) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: user?.avatarColor || 'primary.main' }}>
          {initials(user?.name)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {user?.name || '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {user?.role?.name}
          </Typography>
        </Box>
      </Stack>
    </Grid>
  );
}
