import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Form, Formik, type FormikHelpers } from 'formik';
import * as Yup from 'yup';

import PageHeader from '../components/PageHeader';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { selectClientUsers, selectInternalUsers } from '../utils/selectors';
import { fetchAssignableUsers } from '../features/users/usersSlice';
import { fetchTemplates } from '../features/sop/sopSlice';
import { clearPreview, createProject, previewStages } from '../features/projects/projectsSlice';
import type { Role, SopStageDefinition, UserSummary } from '../types';

interface FormValues {
  name: string;
  code: string;
  description: string;
  sopTemplate: string;
  client: string;
  projectManager: string;
  members: string[];
  priority: string;
  startDate: string;
  targetEndDate: string;
  internalRemarks: string;
  tags: string;
}

/** The user directory entries carry the role and job title the pickers display. */
type DirectoryUser = UserSummary & { role?: Role | null; jobTitle?: string | null };

/**
 * `POST /projects/preview` answers with the template name and the bare version
 * number it resolved, not a nested template/version document. Stage rows use
 * `stageKey` — the field is `key` only on the SOP template itself.
 */
type StagePreview = {
  templateName: string | null;
  version: number | null;
  clientVisibleStages: number;
  internalStages: number;
  stages: (SopStageDefinition & { stageKey?: string })[];
};

const schema = Yup.object({
  name: Yup.string().trim().min(3, 'At least 3 characters').required('Project name is required'),
  code: Yup.string()
    .trim()
    .matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Letters, numbers, hyphens and underscores only')
    .max(30),
  description: Yup.string().max(2000),
  sopTemplate: Yup.string().required('Select an SOP template'),
  client: Yup.string().required('Select a client user'),
  projectManager: Yup.string().required('Select a project manager'),
  priority: Yup.string().required(),
  startDate: Yup.string().required('Start date is required'),
  // The cross-field rule lives on this field so the error highlights the input itself.
  targetEndDate: Yup.string()
    .nullable()
    .test('after-start', 'Target end date must be on or after the start date', (value, context) => {
      const start = (context.parent as FormValues | undefined)?.startDate;
      if (!start || !value) return true;
      return new Date(value) >= new Date(start);
    }),
  internalRemarks: Yup.string().max(2000),
  tags: Yup.string(),
});

const today = () => new Date().toISOString().slice(0, 10);

export default function CreateProject() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const templates = useAppSelector((state) => state.sop.items);
  const { preview: previewState, actionStatus, actionError, lastCreated } = useAppSelector((state) => state.projects);
  const clientUsers = useAppSelector(selectClientUsers) as DirectoryUser[];
  const internalUsers = useAppSelector(selectInternalUsers) as DirectoryUser[];

  const [activeStep, setActiveStep] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  const preview = previewState as StagePreview | null;
  const publishedTemplates = useMemo(() => templates.filter((t) => t.currentVersion > 0), [templates]);

  useEffect(() => {
    dispatch(fetchAssignableUsers());
    dispatch(fetchTemplates({}));
  }, [dispatch]);

  useEffect(
    () => () => {
      dispatch(clearPreview());
    },
    [dispatch],
  );

  /** Live preview of the stages the backend will generate. */
  const handlePreview = async (
    values: FormValues,
    { setFieldError }: Pick<FormikHelpers<FormValues>, 'setFieldError'>,
  ) => {
    try {
      await schema.validate(values, { abortEarly: false });
    } catch (err) {
      (err as Yup.ValidationError).inner?.forEach((e) => setFieldError(e.path as string, e.message));
      return;
    }
    setPreviewLoading(true);
    // The API resolves the latest published version itself, so it only needs the dates.
    const result = await dispatch(
      previewStages({
        sopTemplate: values.sopTemplate,
        startDate: values.startDate,
        targetEndDate: values.targetEndDate || null,
      }),
    );
    setPreviewLoading(false);

    if (previewStages.fulfilled.match(result)) {
      setActiveStep(1);
    } else {
      enqueueSnackbar(result.payload?.message || 'Could not preview the stages', { variant: 'error' });
    }
  };

  const handleCreate = async (values: FormValues, { setSubmitting }: Pick<FormikHelpers<FormValues>, 'setSubmitting'>) => {
    const result = await dispatch(
      createProject({
        ...values,
        code: values.code || undefined,
        startDate: new Date(values.startDate).toISOString(),
        targetEndDate: values.targetEndDate ? new Date(values.targetEndDate).toISOString() : null,
        members: values.members || [],
        internalRemarks: values.internalRemarks || '',
        tags: (values.tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    );
    setSubmitting(false);

    if (createProject.fulfilled.match(result)) {
      enqueueSnackbar(result.payload.message, { variant: 'success' });
      dispatch(clearPreview());
      setActiveStep(0);
      navigate(`/projects/${result.payload.project.id}`);
    } else {
      enqueueSnackbar(result.payload?.message || 'Could not create the project', { variant: 'error' });
    }
  };

  const busy = actionStatus === 'loading';

  return (
    <Box>
      <PageHeader
        title="Create Project"
        subtitle="Stages are generated on the server from the latest published SOP version and locked to that version."
        breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: 'New project' }]}
      />

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        <Step>
          <StepLabel>Project details</StepLabel>
        </Step>
        <Step>
          <StepLabel>Review generated stages</StepLabel>
        </Step>
      </Stepper>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Formik
                initialValues={
                  {
                    name: '',
                    code: '',
                    description: '',
                    sopTemplate: '',
                    client: '',
                    projectManager: '',
                    members: [],
                    priority: 'Medium',
                    startDate: today(),
                    targetEndDate: '',
                    internalRemarks: '',
                    tags: '',
                  } as FormValues
                }
                enableReinitialize
                validationSchema={schema}
                onSubmit={handleCreate}
              >
                {({ values, errors, touched, handleChange, handleBlur, setFieldValue, setFieldError }) => (
                  <Form noValidate>
                    <Stack spacing={2}>
                      <TextField
                        label="Project name *"
                        name="name"
                        value={values.name}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.name && Boolean(errors.name)}
                        helperText={touched.name && errors.name}
                      />
                      <TextField
                        label="Project code"
                        name="code"
                        value={values.code}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.code && Boolean(errors.code)}
                        helperText={touched.code && errors.code || 'Leave blank to auto-generate'}
                      />
                      <TextField
                        label="Description"
                        name="description"
                        value={values.description}
                        onChange={handleChange}
                        multiline
                        minRows={2}
                      />

                      <FormControl size="small" fullWidth error={touched.sopTemplate && Boolean(errors.sopTemplate)}>
                        <InputLabel>SOP template *</InputLabel>
                        <Select
                          name="sopTemplate"
                          label="SOP template *"
                          value={values.sopTemplate}
                          onChange={(e) => {
                            handleChange(e);
                            dispatch(clearPreview());
                            setActiveStep(0);
                          }}
                          onBlur={handleBlur}
                        >
                          {publishedTemplates.map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                              <ListItemText
                                primary={t.name}
                                secondary={`Latest published version v${t.currentVersion}`}
                              />
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {touched.sopTemplate && errors.sopTemplate
                            ? errors.sopTemplate
                            : 'Only templates with a published version can be used'}
                        </FormHelperText>
                      </FormControl>

                      <FormControl size="small" fullWidth error={touched.client && Boolean(errors.client)}>
                        <InputLabel>Client user *</InputLabel>
                        <Select
                          name="client"
                          label="Client user *"
                          value={values.client}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        >
                          {clientUsers.map((u) => (
                            <MenuItem key={u.id} value={u.id}>
                              {u.name} — {u.role?.name}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {touched.client && errors.client
                            ? errors.client
                            : 'Must be a client-scoped role. Restricted data is stripped for this user.'}
                        </FormHelperText>
                      </FormControl>

                      <FormControl size="small" fullWidth error={touched.projectManager && Boolean(errors.projectManager)}>
                        <InputLabel>Project manager *</InputLabel>
                        <Select
                          name="projectManager"
                          label="Project manager *"
                          value={values.projectManager}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        >
                          {internalUsers.map((u) => (
                            <MenuItem key={u.id} value={u.id}>
                              {u.name} — {u.jobTitle || u.role?.name}
                            </MenuItem>
                          ))}
                        </Select>
                        {touched.projectManager && errors.projectManager && (
                          <FormHelperText>{errors.projectManager}</FormHelperText>
                        )}
                      </FormControl>

                      <FormControl size="small" fullWidth>
                        <InputLabel>Team members</InputLabel>
                        <Select<string[]>
                          multiple
                          label="Team members"
                          value={values.members}
                          onChange={(e) => setFieldValue('members', e.target.value)}
                          renderValue={(selected) =>
                            selected.map((id) => internalUsers.find((u) => u.id === id)?.name).join(', ') || 'None'
                          }
                        >
                          {internalUsers.map((u) => (
                            <MenuItem key={u.id} value={u.id}>
                              <Checkbox checked={values.members.includes(u.id)} />
                              <ListItemText primary={u.name} secondary={u.jobTitle || u.role?.name} />
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <FormControl size="small" fullWidth>
                            <InputLabel>Priority</InputLabel>
                            <Select name="priority" label="Priority" value={values.priority} onChange={handleChange}>
                              {['Low', 'Medium', 'High', 'Critical'].map((p) => (
                                <MenuItem key={p} value={p}>
                                  {p}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            label="Start date *"
                            name="startDate"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={values.startDate}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.startDate && Boolean(errors.startDate)}
                            helperText={touched.startDate && errors.startDate}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            label="Target end date"
                            name="targetEndDate"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={values.targetEndDate}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.targetEndDate && Boolean(errors.targetEndDate)}
                            helperText={touched.targetEndDate && errors.targetEndDate || ' '}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            label="Tags"
                            name="tags"
                            value={values.tags}
                            onChange={handleChange}
                            helperText="Comma separated"
                          />
                        </Grid>
                      </Grid>

                      <TextField
                        label="Internal remarks"
                        name="internalRemarks"
                        value={values.internalRemarks}
                        onChange={handleChange}
                        multiline
                        minRows={2}
                        helperText="Never exposed to client accounts."
                      />

                      {actionError && <Alert severity="error">{actionError}</Alert>}

                      <Divider />
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          variant="outlined"
                          startIcon={previewLoading ? <CircularProgress size={16} /> : <AccountTreeIcon />}
                          onClick={() => handlePreview(values, { setFieldError })}
                          disabled={previewLoading || busy}
                        >
                          Preview generated stages
                        </Button>
                      </Stack>
                    </Stack>

                    {/* Hidden submit button driven by the preview step */}
                    <Button type="submit" sx={{ display: 'none' }} aria-hidden tabIndex={-1} />
                  </Form>
                )}
              </Formik>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ position: { md: 'sticky' }, top: 88 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <AccountTreeIcon color="primary" />
                <Typography variant="h6">Stages to be generated</Typography>
              </Stack>

              {!preview ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <LockOutlinedIcon sx={{ fontSize: 42, color: 'text.disabled' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Fill in the details and press <strong>Preview generated stages</strong> to see exactly what the
                    backend will create.
                  </Typography>
                </Box>
              ) : (
                <>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <strong>{preview.stages.length}</strong> stages will be created from{' '}
                    <strong>{preview.templateName}</strong> version <strong>v{preview.version}</strong>.
                  </Alert>

                  <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Chip size="small" color="success" label={`${preview.clientVisibleStages} client visible`} />
                    <Chip size="small" label={`${preview.internalStages} internal only`} />
                  </Stack>

                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width={44}>#</TableCell>
                        <TableCell>Stage</TableCell>
                        <TableCell>Visibility</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.stages.map((stage, index) => (
                        <TableRow key={stage.stageKey ?? stage.name}>
                          <TableCell>{stage.order ?? index + 1}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {stage.name}
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                              <Chip size="small" label={stage.stageKey ?? '—'} />
                              {Boolean(stage.dependsOn?.length) && (
                                <Chip size="small" variant="outlined" color="info" label={`deps: ${stage.dependsOn?.join(',')}`} />
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={stage.clientVisible ? 'success' : 'default'}
                              label={stage.clientVisible ? 'Client' : 'Internal'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Divider sx={{ my: 2 }} />

                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button onClick={() => setActiveStep(0)} color="inherit" disabled={busy}>
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardIcon />}
                      onClick={() => document.querySelector('form')?.requestSubmit()}
                      disabled={busy}
                    >
                      {busy ? 'Creating…' : 'Create project'}
                    </Button>
                  </Stack>

                  {lastCreated && (
                    <Alert severity="info" sx={{ mt: 2 }} icon={<CheckCircleIcon fontSize="inherit" />}>
                      {lastCreated.message}
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
