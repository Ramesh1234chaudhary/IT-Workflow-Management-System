import { Fragment, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';

import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import EmptyState from '../components/EmptyState';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useDebounce } from '../hooks/useDebounce';
import { formatDateTime, titleCase, truncate } from '../utils/format';
import { AUDIT_ACTION_COLOR, type StatusColor } from '../utils/constants';
import { fetchAuditFacets, fetchAuditLogs, resetAuditFilters, setAuditFilters } from '../features/audit/auditSlice';
import type { AuditLogEntry } from '../types';

/** The audit serialiser flattens the actor into a name instead of a user object. */
type AuditRow = Omit<AuditLogEntry, 'actor'> & { actor: string };

/** The action vocabulary is open, so unknown actions fall back to `default`. */
const ACTION_COLOR = AUDIT_ACTION_COLOR as Record<string, StatusColor>;

const JsonBlock = ({ value }: { value?: unknown }) => {
  if (!value) return null;
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        mt: 0.5,
        p: 1,
        bgcolor: '#f6f7f9',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        fontSize: 11.5,
        maxHeight: 220,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </Box>
  );
};

/** `0`, `false` and `''` are real recorded values, not "absent". */
const hasValue = (value: unknown): boolean => value !== null && value !== undefined && value !== '';

/** Change payloads are often objects (e.g. the whole role object), so never `String()` them. */
const changeLabel = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

const ChangeCell = ({ oldValue, newValue }: { oldValue?: unknown; newValue?: unknown }) => {
  if (!hasValue(oldValue) && !hasValue(newValue)) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {hasValue(oldValue) ? (
        <Chip size="small" variant="outlined" label={truncate(changeLabel(oldValue), 22)} color="default" />
      ) : (
        <Chip size="small" variant="outlined" label="∅" />
      )}
      <Typography variant="caption">→</Typography>
      {hasValue(newValue) ? (
        <Chip size="small" label={truncate(changeLabel(newValue), 22)} color="primary" variant="outlined" />
      ) : (
        <Chip size="small" label="∅" />
      )}
    </Stack>
  );
};

/**
 * Audit trail browser.
 *
 * The collection is append-only on the server: this router exposes no write
 * endpoint, and client-scoped roles are rejected by `denyClientScoped()`.
 */
export default function AuditLog() {
  const dispatch = useAppDispatch();
  const { items, pagination, filters, facets, status, error } = useAppSelector((state) => state.audit);
  const [search, setSearch] = useState(filters.search || '');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const entries = items as unknown as AuditRow[];

  useEffect(() => {
    dispatch(fetchAuditFacets());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchAuditLogs({ ...filters, search: debouncedSearch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dispatch,
    filters.page,
    filters.limit,
    filters.entityType,
    filters.action,
    filters.from,
    filters.to,
    debouncedSearch,
  ]);

  const hasFilters = filters.entityType || filters.action || filters.from || filters.to || debouncedSearch;

  return (
    <Box>
      <PageHeader
        title="Audit Log"
        subtitle="Append-only trail of every change. Entries cannot be edited or deleted by any role, including the administrator."
        action={
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => dispatch(fetchAuditLogs({ ...filters, search: debouncedSearch }))}
          >
            Refresh
          </Button>
        }
      />

      <Alert severity="info" icon={<ShieldOutlinedIcon fontSize="inherit" />} sx={{ mb: 3 }}>
        Client / Operations accounts never receive audit data: the <code>/api/audit</code> router rejects them with
        <code> 403</code> before any record is queried.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              placeholder="Search entity, actor or label…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 240, flexGrow: 1 }}
            />

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Entity type</InputLabel>
              <Select
                label="Entity type"
                value={filters.entityType}
                onChange={(e) => dispatch(setAuditFilters({ entityType: e.target.value, page: 1 }))}
              >
                <MenuItem value="">All entities</MenuItem>
                {facets.entityTypes.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Action</InputLabel>
              <Select
                label="Action"
                value={filters.action}
                onChange={(e) => dispatch(setAuditFilters({ action: e.target.value, page: 1 }))}
              >
                <MenuItem value="">All actions</MenuItem>
                {facets.actions.map((a) => (
                  <MenuItem key={a} value={a}>
                    {titleCase(a)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* No separate actor input: the `actor` query param is an ObjectId (API contract),
                while the API returns the actor as a display name. The search box above already
                matches actor names via the server's actorName regex, so a free-text field here
                would only ever produce a 422. */}
            <TextField
              size="small"
              label="From"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.from}
              onChange={(e) => dispatch(setAuditFilters({ from: e.target.value, page: 1 }))}
            />
            <TextField
              size="small"
              label="To"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.to}
              onChange={(e) => dispatch(setAuditFilters({ to: e.target.value, page: 1 }))}
            />

            {hasFilters && (
              <Button
                onClick={() => {
                  setSearch('');
                  dispatch(resetAuditFilters());
                }}
              >
                Clear
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {status === 'loading' && <PageLoader label="Loading audit entries…" minHeight="35vh" />}

      {status === 'failed' && <Alert severity="error">{error}</Alert>}

      {status === 'succeeded' && entries.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              icon={HistoryIcon}
              title="No audit entries match"
              description="Adjust the filters or widen the date range."
            />
          </CardContent>
        </Card>
      )}

      {entries.length > 0 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={46} />
                  <TableCell>When</TableCell>
                  <TableCell>Actor</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Entity</TableCell>
                  <TableCell>Change</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => (
                  <Fragment key={entry.id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => setExpanded((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                        >
                          <ExpandMoreIcon
                            fontSize="small"
                            sx={{ transform: expanded[entry.id] ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
                          />
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.createdAt)}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{entry.actor}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entry.actorRole || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={titleCase(entry.action)}
                          color={ACTION_COLOR[entry.action] || 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{entry.entityLabel || entry.entityType}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entry.entityType}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <ChangeCell oldValue={entry.oldValue} newValue={entry.newValue} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                        <Collapse in={Boolean(expanded[entry.id])} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2 }}>
                            <Divider sx={{ mb: 1.5 }} />
                            <Stack spacing={1.5}>
                              <Button size="small" variant="outlined" onClick={() => setDetail(entry)}>
                                Open full record
                              </Button>
                              <JsonBlock value={entry.metadata} />
                            </Stack>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {pagination.totalPages > 1 && (
        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3 }} alignItems="center">
          <Button disabled={pagination.page <= 1} onClick={() => dispatch(setAuditFilters({ page: pagination.page - 1 }))}>
            Previous
          </Button>
          <Typography variant="body2">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} entries
          </Typography>
          <Button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => dispatch(setAuditFilters({ page: pagination.page + 1 }))}
          >
            Next
          </Button>
        </Stack>
      )}

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle>Audit record</DialogTitle>
        <DialogContent dividers>
          {detail && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={titleCase(detail.action)} color={ACTION_COLOR[detail.action] || 'default'} />
                <Chip size="small" variant="outlined" label={detail.entityType} />
                <Chip size="small" variant="outlined" label={formatDateTime(detail.createdAt)} />
              </Stack>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Actor
                </Typography>
                <Typography variant="body2">
                  {detail.actor} ({detail.actorEmail || 'no email'}) · {detail.actorRole || 'role unknown'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Entity
                </Typography>
                <Typography variant="body2">
                  {detail.entityLabel || '—'} <code>{detail.entityId}</code>
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Old value
                </Typography>
                <JsonBlock value={detail.oldValue} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  New value
                </Typography>
                <JsonBlock value={detail.newValue} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Metadata
                </Typography>
                <JsonBlock value={detail.metadata} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Source IP
                </Typography>
                <Typography variant="body2">{detail.ip || 'not recorded'}</Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
