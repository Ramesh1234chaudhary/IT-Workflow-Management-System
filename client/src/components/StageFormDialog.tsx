import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import type { SopStageDefinition } from '../types';

const schema = Yup.object({
  key: Yup.string()
    .trim()
    .required('Stage key is required')
    .matches(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, hyphens and underscores only')
    .max(40),
  name: Yup.string().trim().required('Stage name is required').max(150),
  description: Yup.string().max(1000),
  estimatedDays: Yup.number().min(0).max(3650).nullable().transform((v, o) => (o === '' ? null : v)),
  clientVisible: Yup.boolean(),
  requiredDocuments: Yup.string(),
  dependsOn: Yup.string(),
});

interface StageFormValues {
  key: string;
  name: string;
  description: string;
  estimatedDays: string | number | null;
  clientVisible: boolean;
  requiredDocuments: string;
  dependsOn: string;
}

const emptyValues: StageFormValues = {
  key: '',
  name: '',
  description: '',
  estimatedDays: '',
  clientVisible: false,
  requiredDocuments: '',
  dependsOn: '',
};

const toList = (value: unknown): string[] =>
  String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

interface StageFormDialogProps {
  open: boolean;
  stage: SopStageDefinition | null;
  saving: boolean;
  error: string | null;
  allStages?: SopStageDefinition[];
  onClose: () => void;
  onSubmit: (payload: Omit<SopStageDefinition, 'id' | 'order'> & { key: string }) => void;
}

/** Add / edit a stage of a draft SOP template. */
export default function StageFormDialog({
  open,
  stage,
  saving,
  error,
  allStages = [],
  onClose,
  onSubmit,
}: StageFormDialogProps) {
  const [initialValues, setInitialValues] = useState<StageFormValues>(emptyValues);

  useEffect(() => {
    if (!open) return;
    setInitialValues(
      stage
        ? {
            key: stage.key,
            name: stage.name,
            description: stage.description || '',
            estimatedDays: stage.estimatedDays ?? '',
            clientVisible: Boolean(stage.clientVisible),
            requiredDocuments: (stage.requiredDocuments || []).join(', '),
            dependsOn: (stage.dependsOn || []).join(', '),
          }
        : emptyValues,
    );
  }, [open, stage]);

  const availableDependencies = allStages.filter((s) => !stage || s.key !== stage.key);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <Formik<StageFormValues>
        initialValues={initialValues}
        enableReinitialize
        validationSchema={schema}
        onSubmit={(values) =>
          onSubmit({
            key: values.key.trim().toUpperCase(),
            name: values.name.trim(),
            description: values.description?.trim() || '',
            estimatedDays: values.estimatedDays === '' || values.estimatedDays === null ? null : Number(values.estimatedDays),
            clientVisible: Boolean(values.clientVisible),
            requiredDocuments: toList(values.requiredDocuments),
            dependsOn: toList(values.dependsOn).map((d) => d.toUpperCase()),
          } as Omit<SopStageDefinition, 'id' | 'order'> & { key: string })
        }
      >
        {({ values, errors, touched, handleSubmit, handleChange, handleBlur, setFieldValue, isValid }) => (
          <Form onSubmit={handleSubmit} noValidate>
            <DialogTitle>{stage ? 'Edit stage' : 'Add stage'}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ pt: 0.5 }}>
                {error && (
                  <Box sx={{ color: 'error.main', fontSize: 13 }} role="alert">
                    {error}
                  </Box>
                )}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
                  <TextField
                    name="key"
                    label="Stage key *"
                    placeholder="SEC"
                    value={values.key}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.key && Boolean(errors.key)}
                    helperText={touched.key && errors.key ? errors.key : 'Unique code for this stage'}
                    disabled={Boolean(stage)}
                  />
                  <TextField
                    name="name"
                    label="Stage name *"
                    value={values.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                  />
                </Box>

                <TextField
                  name="description"
                  label="Description"
                  value={values.description}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  multiline
                  minRows={2}
                  error={touched.description && Boolean(errors.description)}
                  helperText={touched.description && errors.description}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(values.clientVisible)}
                      onChange={(e) => setFieldValue('clientVisible', e.target.checked)}
                    />
                  }
                  label="Visible to Client / Operations accounts"
                />
                <FormHelperText sx={{ mt: -1.5, mb: 0.5 }}>
                  When off, the API strips this stage from every client-scoped response.
                </FormHelperText>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    name="estimatedDays"
                    label="Estimated duration (days)"
                    type="number"
                    value={values.estimatedDays}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.estimatedDays && Boolean(errors.estimatedDays)}
                    helperText={touched.estimatedDays && errors.estimatedDays}
                  />
                  <TextField
                    name="dependsOn"
                    label="Depends on (comma separated keys)"
                    value={values.dependsOn}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="REQ, INFRA"
                    helperText={
                      availableDependencies.length
                        ? `Available: ${availableDependencies.map((s) => s.key).join(', ')}`
                        : 'No other stages yet'
                    }
                  />
                </Box>

                <TextField
                  name="requiredDocuments"
                  label="Required documents (comma separated)"
                  value={values.requiredDocuments}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Security Assessment, Sign-off"
                />

                {values.dependsOn && (
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                    {toList(values.dependsOn).map((key) => (
                      <Chip key={key} size="small" label={key} />
                    ))}
                  </Stack>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={onClose} color="inherit" disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={saving || !isValid}>
                {saving ? 'Saving…' : stage ? 'Save changes' : 'Add stage'}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
}
