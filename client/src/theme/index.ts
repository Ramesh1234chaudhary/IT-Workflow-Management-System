import { alpha, createTheme } from '@mui/material/styles';

/**
 * A calm, high-contrast enterprise palette. Colours are chosen for WCAG AA text
 * contrast on both the light page background and white surfaces, so status pills
 * stay readable rather than merely colourful.
 */
const ink = {
  50: '#eef2f9',
  100: '#d9e2f2',
  200: '#b6c7e6',
  300: '#8ba5d4',
  400: '#5c7fbe',
  500: '#3a5fa6',
  600: '#264a91',
  700: '#1b3a76',
  800: '#152f5e',
  900: '#12274a',
};

const slate = {
  50: '#f6f8fb',
  100: '#eceff5',
  200: '#dde2ec',
  300: '#c3cbd9',
  400: '#9aa5b8',
  500: '#78849a',
  600: '#5c6679',
  700: '#474f5e',
  800: '#3a414d',
  900: '#333944',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1b3a76',
      light: '#3a5fa6',
      dark: '#12274a',
      contrastText: '#ffffff',
    },
    secondary: { main: '#5c6679', contrastText: '#ffffff' },
    success: { main: '#1b7f4c', light: '#2ea36a', dark: '#12603a', contrastText: '#ffffff' },
    warning: { main: '#b25e00', light: '#d97a1a', dark: '#8a4700', contrastText: '#ffffff' },
    error: { main: '#c02626', light: '#d94a4a', dark: '#971c1c', contrastText: '#ffffff' },
    info: { main: '#1d5f8a', light: '#2f80b3', dark: '#154763', contrastText: '#ffffff' },
    background: { default: '#f4f6fa', paper: '#ffffff' },
    text: { primary: slate[900], secondary: slate[600] },
    divider: slate[200],
    action: { hover: alpha(ink[700], 0.04), selected: alpha(ink[700], 0.08) },
  },

  shape: { borderRadius: 10 },

  typography: {
    fontFamily:
      '"Inter var", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h3: { fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.015em' },
    h6: { fontWeight: 650, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body1: { lineHeight: 1.55 },
    body2: { lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },

  /**
   * One shared easing curve keeps every transition feeling like the same
   * surface. Short durations for hover feedback, longer for entrances.
   */
  transitions: {
    duration: { shortest: 120, shorter: 180, short: 240, standard: 300, complex: 380 },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minHeight: '100vh',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        '@keyframes riseIn': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'none' },
        },
        '@keyframes fadeIn': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        '@keyframes shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        '*:focus-visible': {
          outline: `2px solid ${ink[500]}`,
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
        '::-webkit-scrollbar': { width: 10, height: 10 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': {
          background: slate[300],
          borderRadius: 8,
          border: '2px solid transparent',
          backgroundClip: 'content-box',
        },
        '::-webkit-scrollbar-thumb:hover': { background: slate[400], backgroundClip: 'content-box' },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${slate[200]}`,
          borderRadius: 14,
          backgroundImage: 'none',
          transition: 'box-shadow 220ms cubic-bezier(0.2, 0, 0.2, 1), border-color 220ms ease, transform 220ms ease',
        },
      },
    },

    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 9,
          paddingInline: 18,
          transition: 'background-color 180ms ease, box-shadow 180ms ease, transform 120ms ease',
        },
        containedPrimary: {
          boxShadow: `0 1px 2px ${alpha(ink[900], 0.14)}`,
          '&:hover': {
            boxShadow: `0 6px 18px ${alpha(ink[700], 0.26)}`,
            transform: 'translateY(-1px)',
          },
          '&:active': { transform: 'translateY(0)', boxShadow: `0 1px 2px ${alpha(ink[900], 0.14)}` },
        },
        outlined: {
          borderColor: slate[300],
          '&:hover': { borderColor: ink[500], backgroundColor: alpha(ink[700], 0.05) },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: { transition: 'background-color 160ms ease, color 160ms ease, transform 160ms ease' },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8, transition: 'box-shadow 160ms ease, transform 160ms ease' },
        colorPrimary: { backgroundColor: alpha(ink[700], 0.1), color: ink[800] },
        colorInfo: { backgroundColor: alpha('#1d5f8a', 0.12), color: '#14455f' },
        colorSuccess: { backgroundColor: alpha('#1b7f4c', 0.12), color: '#135a37' },
        colorWarning: { backgroundColor: alpha('#b25e00', 0.13), color: '#7d4100' },
        colorError: { backgroundColor: alpha('#c02626', 0.12), color: '#8f1b1b' },
        colorDefault: { backgroundColor: slate[100], color: slate[700] },
      },
    },

    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiSelect: { defaultProps: { size: 'small' } },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 9,
          backgroundColor: '#ffffff',
          transition: 'box-shadow 180ms ease',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: slate[300] },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: slate[400] },
          '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(ink[500], 0.14)}` },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: slate[700],
          backgroundColor: slate[50],
          borderBottom: `1px solid ${slate[200]}`,
        },
        body: { borderBottom: `1px solid ${slate[100]}` },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: { transition: 'background-color 160ms ease' },
        hover: { backgroundColor: slate[50] },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16, boxShadow: `0 24px 60px ${alpha(ink[900], 0.22)}` },
      },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 650, fontSize: '1.125rem' } } },

    MuiTooltip: { defaultProps: { arrow: true } },

    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 6, borderRadius: 4, backgroundColor: slate[200] },
        bar: { borderRadius: 4, transition: 'transform 420ms cubic-bezier(0.2, 0, 0.2, 1)' },
      },
    },

    MuiCircularProgress: { styleOverrides: { root: { transition: 'opacity 200ms ease' } } },

    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: { root: { backgroundColor: alpha(slate[500], 0.14), borderRadius: 8 } },
    },

    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3, transition: 'transform 260ms cubic-bezier(0.2, 0, 0.2, 1)' } } },

    MuiAppBar: {
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: '#ffffff', color: slate[900], boxShadow: 'none' },
      },
    },

    MuiDrawer: { styleOverrides: { paper: { borderRight: `1px solid ${slate[200]}` } } },

    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 9, transition: 'background-color 160ms ease, color 160ms ease' },
      },
    },

    MuiAlert: { styleOverrides: { root: { borderRadius: 12, alignItems: 'center' } } },

    MuiMenu: { styleOverrides: { paper: { marginTop: 6, borderRadius: 12, border: `1px solid ${slate[200]}` } } },

    MuiMenuItem: { styleOverrides: { root: { borderRadius: 8, marginInline: 6, transition: 'background-color 140ms ease' } } },
  },
});

export { ink, slate };
export default theme;
