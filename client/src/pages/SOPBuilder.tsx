import { useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Stack,
  Switch,
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
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HistoryIcon from '@mui/icons-material/History';
import PublishIcon from '@mui/icons-material/Publish';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import StageFormDialog from '../components/StageFormDialog';
import VersionHistoryDialog from '../components/VersionHistoryDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import PermissionGate from '../components/PermissionGate';
import { StatusChip, VisibilityChip } from '../components/StatusChip';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { usePermission } from '../hooks/usePermission';
import { selectCurrentTemplate, selectSOPItems, selectTemplateStats } from '../utils/selectors';
import { formatDateTime } from '../utils/format';
import {
  addStage,
  createDraft,
  createTemplate,
  deleteStage,
  deleteTemplate,
  fetchTemplate,
  fetchTemplates,
  fetchVersions,
  publishTemplate,
  reorderStages,
  updateStage,
} from '../features/sop/sopSlice';
import type { SopStageDefinition, SopTemplate } from '../types';

/** A persisted stage always carries an id; the drag handles and reorder API need it. */
type TemplateStage = Omit<SopStageDefinition, 'id'> & { id: string };

/** The builder works on the loaded template, which always ships its stage list. */
type TemplateDetail = Omit<SopTemplate, 'stages'> & { stages: TemplateStage[] };

/** Payload `StageFormDialog` hands back on submit. */
type StageFormValues = Omit<SopStageDefinition, 'id' | 'order'> & { key: string };

/** The confirm dialog targets either one stage or the whole template. */
type DeleteTarget = { template?: boolean; id: string; name?: string } | null;

interface SortableStageRowProps {
  stage: TemplateStage;
  readOnly: boolean;
  canEdit: boolean;
  onEdit: (stage: TemplateStage) => void;
  onDelete: (stage: TemplateStage) => void;
  onToggleVisibility: (stage: TemplateStage) => void;
}

function SortableStageRow({
  stage,
  readOnly,
  canEdit,
  onEdit,
  onDelete,
  onToggleVisibility,
}: SortableStageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 2 : 'auto' }}
    >
      <TableCell padding="checkbox" sx={{ width: 48 }}>
        {readOnly ? (
          <Typography variant="body2" color="text.secondary">
            {stage.order}
          </Typography>
        ) : (
          <Tooltip title="Drag to reorder">
            <IconButton size="small" {...attributes} {...listeners} aria-label={`Reorder ${stage.name}`}>
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" label={stage.key} />
          <Typography variant="body2" fontWeight={600}>
            {stage.name}
          </Typography>
        </Stack>
        {stage.description && (
          <Typography variant="caption" color="text.secondary">
            {stage.description}
          </Typography>
        )}
      </TableCell>
      <TableCell>{stage.estimatedDays ? `${stage.estimatedDays}d` : '—'}</TableCell>
      <TableCell>{stage.dependsOn?.length ? stage.dependsOn.join(', ') : '—'}</TableCell>
      <TableCell align="center">
        {readOnly ? (
          <VisibilityChip clientVisible={stage.clientVisible} />
        ) : (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            {stage.clientVisible ? (
              <VisibilityOutlinedIcon color="success" fontSize="small" />
            ) : (
              <VisibilityOffOutlinedIcon color="disabled" fontSize="small" />
            )}
            <Switch
              size="small"
              checked={Boolean(stage.clientVisible)}
              disabled={!canEdit}
              onChange={() => onToggleVisibility(stage)}
              inputProps={{ 'aria-label': `Toggle client visibility for ${stage.name}` }}
            />
          </Stack>
        )}
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          {canEdit && (
            <>
              <Tooltip title="Edit stage">
                <IconButton size="small" onClick={() => onEdit(stage)}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete stage (draft only)">
                <span>
                  <IconButton size="small" color="error" onClick={() => onDelete(stage)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
}

export default function SOPBuilder() {
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const { can } = usePermission();

  const templates = useAppSelector(selectSOPItems);
  const template = useAppSelector(selectCurrentTemplate) as TemplateDetail | null;
  const versions = useAppSelector((state) => state.sop.versions);
  const listStatus = useAppSelector((state) => state.sop.status);
  const actionStatus = useAppSelector((state) => state.sop.actionStatus);
  const actionError = useAppSelector((state) => state.sop.actionError);
  const stats = useAppSelector(selectTemplateStats);

  const canManage = can('sop', 'create') && can('sop', 'update');

  const [stageDialog, setStageDialog] = useState<{ open: boolean; stage: TemplateStage | null }>({
    open: false,
    stage: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [metaForm, setMetaForm] = useState({ name: '', key: '', description: '', category: 'Service Delivery' });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const busy = actionStatus === 'loading';
  const isDraft = template?.status === 'draft';
  const readOnly = !canManage || !isDraft;

  useEffect(() => {
    dispatch(fetchTemplates({}));
  }, [dispatch]);

  useEffect(() => {
    if (template?.id) dispatch(fetchVersions(template.id));
  }, [dispatch, template?.id]);

  const handleSelect = async (id: string) => {
    const result = await dispatch(fetchTemplate(id));
    if (fetchTemplate.rejected.match(result)) {
      enqueueSnackbar(result.payload?.message || 'Could not load the template', { variant: 'error' });
    }
  };

  const handleCreateTemplate = async () => {
    if (!metaForm.name.trim() || !metaForm.key.trim()) return;
    const result = await dispatch(
      createTemplate({ ...metaForm, name: metaForm.name.trim(), key: metaForm.key.trim().toUpperCase() }),
    );
    if (createTemplate.fulfilled.match(result)) {
      enqueueSnackbar(`Template "${result.payload.template.name}" created as a draft`, { variant: 'success' });
      setNewTemplateOpen(false);
      setMetaForm({ name: '', key: '', description: '', category: 'Service Delivery' });
    } else {
      enqueueSnackbar(result.payload?.message || 'Could not create the template', { variant: 'error' });
    }
  };

  const handleSaveStage = async (values: StageFormValues) => {
    // The dialog payload is the stage body for both create and update.
    const action = stageDialog.stage
      ? updateStage({ id: template!.id, stageId: stageDialog.stage.id, body: values })
      : addStage({ id: template!.id, body: values });
    const result = await dispatch(action as ReturnType<typeof updateStage>);
    if (updateStage.fulfilled.match(result) || addStage.fulfilled.match(result)) {
      enqueueSnackbar(stageDialog.stage ? 'Stage updated' : 'Stage added', { variant: 'success' });
      setStageDialog({ open: false, stage: null });
    } else {
      enqueueSnackbar((result.payload as { message?: string } | undefined)?.message || 'Could not save the stage', {
        variant: 'error',
      });
    }
  };

  const handleDeleteStage = async () => {
    const result = await dispatch(deleteStage({ id: template!.id, stageId: deleteTarget!.id }));
    if (deleteStage.fulfilled.match(result)) {
      enqueueSnackbar('Stage deleted', { variant: 'success' });
      setDeleteTarget(null);
    } else {
      enqueueSnackbar(result.payload?.message || 'Could not delete the stage', { variant: 'error' });
      setDeleteTarget(null);
    }
  };

  const handleToggleVisibility = async (stage: TemplateStage) => {
    const result = await dispatch(
      updateStage({ id: template!.id, stageId: stage.id, body: { clientVisible: !stage.clientVisible } }),
    );
    if (updateStage.rejected.match(result)) {
      enqueueSnackbar(result.payload?.message || 'Could not update visibility', { variant: 'error' });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = template!.stages;
    const from = current.findIndex((s) => s.id === active.id);
    const to = current.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(current, from, to).map((s, index) => ({ ...s, order: index + 1 }));

    const result = await dispatch(reorderStages({ id: template!.id, stageIds: reordered.map((s) => s.id) }));
    if (reorderStages.rejected.match(result)) {
      enqueueSnackbar(result.payload?.message || 'Could not save the new order', { variant: 'error' });
    } else {
      enqueueSnackbar('Stage order saved', { variant: 'success' });
    }
  };

  const handlePublish = async () => {
    const result = await dispatch(
      publishTemplate({ id: template!.id, body: { changeNote: changeNote.trim() } }),
    );
    if (publishTemplate.fulfilled.match(result)) {
      enqueueSnackbar((result.payload as { message?: string }).message, { variant: 'success' });
      setPublishOpen(false);
      setChangeNote('');
    } else {
      enqueueSnackbar(result.payload?.message || 'Could not publish', { variant: 'error' });
    }
  };

  const handleOpenDraft = async () => {
    const result = await dispatch(createDraft(template!.id));
    if (createDraft.fulfilled.match(result)) {
      enqueueSnackbar('A new draft was created from the latest published version', { variant: 'success' });
    } else {
      enqueueSnackbar(result.payload?.message || 'Could not create a draft', { variant: 'error' });
    }
  };

  const handleDeleteTemplate = async () => {
    const result = await dispatch(deleteTemplate(template!.id));
    if (deleteTemplate.fulfilled.match(result)) {
      enqueueSnackbar('Template deleted', { variant: 'success' });
    } else {
      enqueueSnackbar(result.payload?.message || 'Could not delete the template', { variant: 'error' });
    }
  };

  return (
    <Box>
      <PageHeader
        title="SOP Builder"
        subtitle="Configure the workflow once. Every project generated from a published version keeps that version forever."
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <PermissionGate module="sop" action="create">
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewTemplateOpen(true)}>
                New template
              </Button>
            </PermissionGate>
            <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setHistoryOpen(true)}>
              Version history
            </Button>
            {template && !isDraft && can('sop', 'update') && (
              <Button variant="outlined" startIcon={<NoteAddOutlinedIcon />} onClick={handleOpenDraft} disabled={busy}>
                New draft
              </Button>
            )}
            {template && isDraft && (
              <PermissionGate module="sop" action="publish">
                <Button variant="contained" startIcon={<PublishIcon />} onClick={() => setPublishOpen(true)} disabled={busy}>
                  Publish version {template.currentVersion + 1}
                </Button>
              </PermissionGate>
            )}
          </Stack>
        }
      />

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Templates
              </Typography>
              {listStatus === 'loading' && <CircularProgress size={22} />}
              {templates.length === 0 && listStatus !== 'loading' && (
                <Typography variant="body2" color="text.secondary">
                  No templates yet.
                </Typography>
              )}
              <Stack spacing={0.5}>
                {templates.map((t) => (
                  <Button
                    key={t.id}
                    onClick={() => handleSelect(t.id)}
                    variant={template?.id === t.id ? 'contained' : 'text'}
                    sx={{ justifyContent: 'space-between', textAlign: 'left' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                    <Chip
                      size="small"
                      label={`v${t.currentVersion}`}
                      sx={{ ml: 1 }}
                      color={t.status === 'published' ? 'success' : 'warning'}
                      variant="outlined"
                    />
                  </Button>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={9}>
          {!template ? (
            <Card>
              <CardContent>
                <EmptyState
                  title="Select a template"
                  description="Pick an SOP template on the left, or create a new one to start building stages."
                />
              </CardContent>
            </Card>
          ) : (
            <Stack spacing={3}>
              <Card>
                <CardContent>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="h6">{template.name}</Typography>
                        <StatusChip status={template.status} />
                        <Chip size="small" label={`v${template.currentVersion}`} variant="outlined" />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {template.description || 'No description'}
                      </Typography>
                      {template.publishedAt && (
                        <Typography variant="caption" color="text.secondary">
                          Last published {formatDateTime(template.publishedAt)}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" spacing={2}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6">{stats.total}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Stages
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" color="success.main">
                          {stats.clientVisible}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Client visible
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" color="text.secondary">
                          {stats.internal}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Internal
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>

                  {!isDraft && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      This template is <strong>published</strong>. Stages can only be edited in a draft. Use “New draft” to
                      make changes — existing projects keep their current version and are never affected.
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">Stages</Typography>
                    {canManage && isDraft && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setStageDialog({ open: true, stage: null })}
                      >
                        Add stage
                      </Button>
                    )}
                  </Stack>

                  {actionError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {actionError}
                    </Alert>
                  )}

                  {template.stages.length === 0 ? (
                    <EmptyState
                      title="No stages yet"
                      description="Add the stages that make up this workflow, then publish to create version 1."
                    />
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={template.stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell width={60}>#</TableCell>
                                <TableCell>Stage</TableCell>
                                <TableCell width={90}>Duration</TableCell>
                                <TableCell width={140}>Depends on</TableCell>
                                <TableCell width={150} align="center">
                                  Client visible
                                </TableCell>
                                <TableCell width={110} align="right" />
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {template.stages.map((stage) => (
                                <SortableStageRow
                                  key={stage.id}
                                  stage={stage}
                                  readOnly={readOnly}
                                  canEdit={canManage && isDraft}
                                  onEdit={(s) => setStageDialog({ open: true, stage: s })}
                                  onDelete={(s) => setDeleteTarget(s)}
                                  onToggleVisibility={handleToggleVisibility}
                                />
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </SortableContext>
                    </DndContext>
                  )}

                  {canManage && isDraft && template.stages.length > 0 && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          Drag a row to change the execution order. Deleting a stage that other stages depend on is
                          blocked.
                        </Typography>
                        <Button color="error" size="small" onClick={() => setDeleteTarget({ template: true, id: template.id })}>
                          Delete template
                        </Button>
                      </Stack>
                    </>
                  )}
                </CardContent>
              </Card>
            </Stack>
          )}
        </Grid>
      </Grid>

      <StageFormDialog
        open={stageDialog.open}
        stage={stageDialog.stage}
        saving={busy}
        error={actionError}
        allStages={template?.stages || []}
        onClose={() => setStageDialog({ open: false, stage: null })}
        onSubmit={handleSaveStage}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.template ? 'Delete this template?' : 'Delete this stage?'}
        message={
          deleteTarget?.template
            ? 'The template must be in draft and not used by any project.'
            : `"${deleteTarget?.name}" will be removed from the draft. Published versions are unaffected.`
        }
        confirmLabel="Delete"
        color="error"
        loading={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget?.template) {
            await handleDeleteTemplate();
          } else {
            await handleDeleteStage();
          }
        }}
      />

      <Dialog open={publishOpen} onClose={busy ? undefined : () => setPublishOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Publish version {(template?.currentVersion ?? 0) + 1}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Alert severity="warning">
              Publishing creates an immutable snapshot of all {stats.total} stages. Projects already created from a
              previous version keep their own version and their stages are never changed.
            </Alert>
            <TextField
              label="Change note"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="What changed in this version?"
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setPublishOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handlePublish} disabled={busy || stats.total === 0}>
            {busy ? 'Publishing…' : 'Publish version'}
          </Button>
        </DialogActions>
      </Dialog>

      <VersionHistoryDialog
        open={historyOpen}
        versions={versions}
        templateName={template?.name}
        onClose={() => setHistoryOpen(false)}
      />

      <Dialog open={newTemplateOpen} onClose={() => setNewTemplateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New SOP template</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Name *"
              value={metaForm.name}
              onChange={(e) => setMetaForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label="Key *"
              value={metaForm.key}
              onChange={(e) => setMetaForm((f) => ({ ...f, key: e.target.value.toUpperCase() }))}
              helperText="Unique code, e.g. IT_DELIVERY"
            />
            <TextField
              label="Category"
              value={metaForm.category}
              onChange={(e) => setMetaForm((f) => ({ ...f, category: e.target.value }))}
            />
            <TextField
              label="Description"
              value={metaForm.description}
              onChange={(e) => setMetaForm((f) => ({ ...f, description: e.target.value }))}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setNewTemplateOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateTemplate}
            disabled={busy || !metaForm.name.trim() || !metaForm.key.trim()}
          >
            Create draft
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
