import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { Form, Formik, type FormikHelpers } from 'formik';
import * as Yup from 'yup';

import PageHeader from '../components/PageHeader';
import { useAppDispatch } from '../app/hooks';
import { useAuth } from '../hooks/useAuth';
import { formatDateTime, initials } from '../utils/format';
import { changePassword } from '../features/auth/authSlice';

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const schema = Yup.object({
  currentPassword: Yup.string().required('Your current password is required'),
  newPassword: Yup.string()
    .min(10, 'Use at least 10 characters')
    .matches(/[a-z]/, 'Include a lowercase letter')
    .matches(/[A-Z]/, 'Include an uppercase letter')
    .matches(/\d/, 'Include a number')
    .required('A new password is required')
    .notOneOf([Yup.ref('currentPassword')], { message: 'The new password must differ from the current one' }),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], { message: 'The passwords do not match' })
    .required('Confirm the new password'),
});

export default function Profile() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const [done, setDone] = useState(false);

  const handleSubmit = async (values: PasswordFormValues, { setSubmitting, resetForm }: FormikHelpers<PasswordFormValues>) => {
    const result = await dispatch(changePassword(values));
    setSubmitting(false);
    if (changePassword.fulfilled.match(result)) {
      enqueueSnackbar('Password changed. Please sign in again with the new password.', { variant: 'success' });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } else {
      enqueueSnackbar(result.payload?.message || 'Could not change the password', { variant: 'error' });
    }
    resetForm();
  };

  return (
    <Box>
      <PageHeader title="Profile" subtitle="Your account, your effective permissions, and the password change form." />

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Avatar sx={{ width: 56, height: 56, bgcolor: user?.avatarColor || 'primary.main' }}>
                  {initials(user?.name)}
                </Avatar>
                <Box>
                  <Typography variant="h6">{user?.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user?.email}
                  </Typography>
                </Box>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={1.5}>
                <Row label="Role" value={user?.role?.name} />
                <Row label="Role key" value={<code>{user?.role?.key}</code>} />
                <Row label="Job title" value={user?.jobTitle} />
                <Row label="Department" value={user?.department} />
                <Row label="Team" value={user?.team} />
                <Row label="Project scope" value={user?.role?.accessScope} />
                <Row label="Client scoped" value={user?.role?.isClientScoped ? 'Yes' : 'No'} />
                <Row label="Sees internal data" value={user?.role?.canSeeInternalData ? 'Yes' : 'No'} />
                <Row label="Last sign in" value={formatDateTime(user?.lastLoginAt)} />
                <Row label="Account created" value={formatDateTime(user?.createdAt)} />
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <VerifiedUserOutlinedIcon fontSize="small" />
                <Typography variant="h6">Effective permissions</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {user?.permissions?.length || 0} permissions granted by your role. The UI never compares role names.
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap gap={0.75}>
                {(user?.permissions || []).map((permission) => (
                  <Chip key={permission} size="small" variant="outlined" label={permission} />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <LockOutlinedIcon fontSize="small" />
                <Typography variant="h6">Change password</Typography>
              </Stack>

              <Alert severity="info" sx={{ mb: 2 }}>
                Changing your password revokes every refresh token in your session family, so you will be signed out
                immediately afterwards.
              </Alert>

              {done ? (
                <Alert severity="success" icon={<VerifiedUserOutlinedIcon fontSize="inherit" />}>
                  Password changed. Redirecting you to the sign in screen…
                </Alert>
              ) : (
                <Formik
                  initialValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
                  validationSchema={schema}
                  onSubmit={handleSubmit}
                >
                  {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
                    <Form noValidate>
                      <Stack spacing={2}>
                        <TextField
                          label="Current password"
                          name="currentPassword"
                          type="password"
                          fullWidth
                          value={values.currentPassword}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.currentPassword && Boolean(errors.currentPassword)}
                          helperText={touched.currentPassword && errors.currentPassword}
                        />
                        <TextField
                          label="New password"
                          name="newPassword"
                          type="password"
                          fullWidth
                          value={values.newPassword}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.newPassword && Boolean(errors.newPassword)}
                          helperText={touched.newPassword && errors.newPassword}
                        />
                        <TextField
                          label="Confirm new password"
                          name="confirmPassword"
                          type="password"
                          fullWidth
                          value={values.confirmPassword}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.confirmPassword && Boolean(errors.confirmPassword)}
                          helperText={touched.confirmPassword && errors.confirmPassword}
                        />
                        <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ alignSelf: 'flex-start' }}>
                          {isSubmitting ? 'Updating…' : 'Change password'}
                        </Button>
                      </Stack>
                    </Form>
                  )}
                </Formik>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right' }}>
        {value || '—'}
      </Typography>
    </Stack>
  );
}
