import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import LoginIcon from '@mui/icons-material/Login';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Formik, Form, type FormikHelpers } from 'formik';
import * as Yup from 'yup';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { login } from '../features/auth/authSlice';
import { DEFAULT_ROUTE_PERMISSIONS } from '../utils/constants';
import { ink, slate } from '../theme';

interface FormValues {
  email: string;
  password: string;
}

const schema = Yup.object({
  email: Yup.string().trim().email('Enter a valid email address').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', email: 'superadmin@example.com', password: 'SuperAdmin@123' },
  { label: 'Admin', email: 'admin@example.com', password: 'Admin@123' },
  { label: 'IT Team Member', email: 'itmember@example.com', password: 'ITMember@123' },
  { label: 'Client / Operations', email: 'client@example.com', password: 'Client@123' },
];

const HIGHLIGHTS = [
  { icon: <LayersOutlinedIcon fontSize="small" />, text: 'Versioned SOP templates per project' },
  { icon: <HistoryOutlinedIcon fontSize="small" />, text: 'Manual stage status with full history' },
  { icon: <ShieldOutlinedIcon fontSize="small" />, text: 'Database-driven roles and permissions' },
  { icon: <DescriptionOutlinedIcon fontSize="small" />, text: 'Client-safe reporting, filtered server side' },
];

export default function Login() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const [revealPassword, setRevealPassword] = useState(false);

  const { user, status, error } = useAppSelector((state) => state.auth);

  /** Landing route is derived from the permissions returned by the API. */
  const homePath = () => {
    const permissions = user?.permissions || [];
    const match = DEFAULT_ROUTE_PERMISSIONS.find(({ permission }) => permissions.includes(permission));
    return match ? match.path : '/projects';
  };

  const from = (location.state as { from?: string } | null)?.from;

  if (user) return <Navigate to={from && from !== '/login' ? from : homePath()} replace />;

  const busy = status === 'loading';

  const handleSubmit = async (values: FormValues, { setSubmitting, setFieldTouched }: FormikHelpers<FormValues>) => {
    try {
      await schema.validate(values, { abortEarly: false });
      const result = await dispatch(login(values));
      if (login.rejected.match(result)) {
        setFieldTouched('email', true);
        setFieldTouched('password', true);
      }
    } catch (err) {
      (err as Yup.ValidationError).inner?.forEach((e) => setFieldTouched(String(e.path), true));
    }
    setSubmitting(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' } }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { md: 6, lg: 8 },
          color: '#fff',
          background: `linear-gradient(155deg, ${ink[900]} 0%, ${ink[700]} 55%, ${ink[500]} 100%)`,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 42,
              height: 42,
              borderRadius: 2.5,
              backgroundColor: alpha('#fff', 0.14),
              border: `1px solid ${alpha('#fff', 0.22)}`,
            }}
          >
            <AccountTreeIcon />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              IT Workflow Manager
            </Typography>
            <Typography variant="caption" sx={{ color: alpha('#fff', 0.72) }}>
              Delivery governance platform
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ maxWidth: 460, my: 6 }}>
          <Typography variant="h3" sx={{ color: '#fff', mb: 2, lineHeight: 1.18 }}>
            One place to run every IT project stage.
          </Typography>
          <Typography sx={{ color: alpha('#fff', 0.78), mb: 4 }}>
            Replaces the spreadsheet-based SOP process with a single auditable system — templates,
            stages, documents, blockers and an append-only audit trail.
          </Typography>

          <Stack spacing={1.75}>
            {HIGHLIGHTS.map((item) => (
              <Stack key={item.text} direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 2,
                    color: '#fff',
                    backgroundColor: alpha('#fff', 0.12),
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="body2" sx={{ color: alpha('#fff', 0.88) }}>
                  {item.text}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 4 },
          bgcolor: 'background.default',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 440,
            p: { xs: 3, sm: 5 },
            borderRadius: 3,
            border: `1px solid ${slate[200]}`,
            boxShadow: `0 18px 50px ${alpha(ink[900], 0.1)}`,
          }}
        >
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.25, mb: 3 }}>
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: 38,
                height: 38,
                borderRadius: 2.5,
                color: '#fff',
                backgroundColor: 'primary.main',
              }}
            >
              <AccountTreeIcon fontSize="small" />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              IT Workflow Manager
            </Typography>
          </Box>

          <Typography variant="h5" gutterBottom>
            Sign in
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
            Use the work email address issued to you.
          </Typography>

          <Formik<FormValues>
            initialValues={{ email: '', password: '' }}
            validationSchema={schema}
            onSubmit={handleSubmit}
            validateOnBlur
            validateOnChange
          >
            {({ values, errors, touched, handleChange, handleBlur, isSubmitting, setFieldValue, setTouched }) => {
              const disabled = isSubmitting || busy;
              // An empty field reports itself as soon as it is left, so the
              // reason a sign-in cannot proceed is visible before submitting.
              const emailError = touched.email ? errors.email : undefined;
              const passwordError = touched.password ? errors.password : undefined;

              return (
                <Form noValidate>
                  <Stack spacing={2.25}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField
                      label="Email address"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={values.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={Boolean(emailError)}
                      helperText={emailError ?? ' '}
                      inputProps={{ 'aria-label': 'Email address' }}
                    />

                    <TextField
                      label="Password"
                      name="password"
                      type={revealPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={values.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={Boolean(passwordError)}
                      helperText={passwordError ?? ' '}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setRevealPassword((shown) => !shown)}
                              edge="end"
                              size="small"
                              aria-label={revealPassword ? 'Hide password' : 'Show password'}
                            >
                              {revealPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      startIcon={<LoginIcon />}
                      disabled={disabled}
                      fullWidth
                      sx={{ py: 1.25, mt: 0.5 }}
                    >
                      {disabled ? 'Signing in…' : 'Sign in'}
                    </Button>

                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mt: -1 }}>
                      Sessions are time-limited and require a fresh sign-in on another device.
                    </Typography>
                  </Stack>

                  <Divider sx={{ my: 3 }}>
                    <Chip label="Demo accounts" size="small" />
                  </Divider>

                  <Stack spacing={1}>
                    {DEMO_ACCOUNTS.map((account) => (
                      <Button
                        key={account.email}
                        type="button"
                        size="small"
                        variant="outlined"
                        disabled={disabled}
                        startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
                        onClick={() => {
                          // Fills the form only — signing in stays an explicit
                          // action so the fields can be reviewed first.
                          setTouched({});
                          setFieldValue('email', account.email, true);
                          setFieldValue('password', account.password, true);
                        }}
                        sx={{ justifyContent: 'space-between', py: 1 }}
                      >
                        <span>{account.label}</span>
                        <Typography component="span" variant="caption" color="text.secondary">
                          {account.email}
                        </Typography>
                      </Button>
                    ))}
                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2.5, textAlign: 'center' }}>
                    Need access? Contact your system administrator.
                  </Typography>
                </Form>
              );
            }}
          </Formik>
        </Paper>
      </Box>
    </Box>
  );
}
