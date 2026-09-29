import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';

import App from './App';
import store from './app/store';
import theme from './theme/index';
import { setSessionExpiredHandler, setTokenRefreshedHandler } from './api/httpClient';
import { sessionExpired, setUser } from './features/auth/authSlice';
import type { User } from './types';

// The axios interceptor owns session expiry: on a failed refresh it forces a logout.
setSessionExpiredHandler((message?: string) => store.dispatch(sessionExpired(message)));
// A successful rotation can return a refreshed user (e.g. after a role change).
setTokenRefreshedHandler((user: User) => store.dispatch(setUser(user)));

const themeWrapper = (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <SnackbarProvider
      maxSnack={3}
      autoHideDuration={4000}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      domRoot={document.body}
    >
      <App />
    </SnackbarProvider>
  </ThemeProvider>
);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root is missing from index.html');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>{themeWrapper}</BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
