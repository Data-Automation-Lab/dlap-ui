/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { createHash, webcrypto } from 'node:crypto';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportingApi } from '../../utils/api';
import type { ExpiryRow } from '../../utils/reportApi';
import ExpiryReport, { KNOWN_LOGGING_GAPS } from '../ExpiryReport';
import { quietConsole, renderPage, type StubClient } from './testUtils';

// The page reads the signed-in roles from the Keycloak singleton; each test sets them.
const kc = vi.hoisted(() => ({
  authenticated: true,
  token: 'test-token',
  tokenParsed: undefined as undefined | Record<string, unknown>,
  logout: vi.fn(),
  updateToken: vi.fn(),
  login: vi.fn(),
  onAuthSuccess: undefined,
  onAuthRefreshSuccess: undefined,
  onAuthLogout: undefined,
}));

vi.mock('../../keycloak', () => ({ default: kc }));
vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());

const reporting = reportingApi as unknown as StubClient;

const AS_OF = '2026-10-20T00:00:00Z';
const EXPORT_ID = '6f1b6a0e-3d0c-4f86-9d6c-0d1f6f0f4a11';
const CSV_TEXT = 'assetUri,assetId\ngs://orders,1\n';

/** The report row the service sends, with the fields a test cares about overridden. */
function row(overrides: Partial<ExpiryRow> = {}): ExpiryRow {
  return {
    assetUri: 'gs://orders-raw',
    assetId: '11111111-1111-4111-8111-111111111111',
    provider: 'GCP',
    type: 'GCS_BUCKET',
    region: 'us-central1',
    name: 'orders-raw',
    lifecycleStatus: 'ACTIVE',
    sizeBytes: 2048,
    createdAt: '2025-01-02T03:04:05Z',
    createdSource: 'GCS_API',
    ageDays: 291,
    lastReadAt: '2026-09-01T10:00:00Z',
    lastReadSource: 'gcpaudit',
    idleDays: 49,
    readSignalState: 'READ',
    readCoverage: 'FULL',
    lastModifiedAt: '2026-09-02T10:00:00Z',
    retentionStatus: 'RETAINED',
    retentionExpiresAt: '2027-01-01T00:00:00Z',
    legalHold: false,
    labels: [],
    mode: 'live',
    ...overrides,
  };
}

/** A page envelope as RPT-01 sends it. */
function pageOf(items: ExpiryRow[], extra: { number?: number; totalPages?: number; totalElements?: number; mode?: string; asOf?: string } = {}) {
  return {
    report: 'asset-activity-expiry',
    contractVersion: '1.0',
    mode: extra.mode ?? 'live',
    asOf: extra.asOf ?? AS_OF,
    filters: {},
    page: {
      number: extra.number ?? 0,
      size: 50,
      totalElements: extra.totalElements ?? items.length,
      totalPages: extra.totalPages ?? (items.length === 0 ? 0 : 1),
      sort: 'assetUri,asc',
    },
    items,
  };
}

interface Call {
  url: string;
  params: Record<string, string> | undefined;
}

/** Routes the stub client by URL; every call is recorded. */
function serve(handlers: {
  page?: (params: Record<string, string>) => unknown;
  csv?: () => unknown;
  manifest?: () => unknown;
}): Call[] {
  const calls: Call[] = [];
  reporting.get.mockImplementation(async (url: string, config?: { params?: Record<string, string> }) => {
    calls.push({ url, params: config?.params });
    let reply: unknown;
    if (url === '/reports/expiry') {
      reply = handlers.page?.(config?.params ?? {});
    } else if (url === '/reports/expiry.csv') {
      reply = handlers.csv?.();
    } else if (url.startsWith('/reports/expiry/exports/')) {
      reply = handlers.manifest?.();
    } else {
      throw new Error(`unexpected GET ${url}`);
    }
    if (reply instanceof Error) {
      throw reply;
    }
    return reply;
  });
  return calls;
}

const ok = (data: unknown) => ({ data, headers: {} });
const failure = (status: number, message?: string) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data: message ? { message } : {} } });

function setRoles(roles: string[]) {
  kc.tokenParsed = { realm_access: { roles } };
}

const pageCalls = (calls: Call[]) => calls.filter((call) => call.url === '/reports/expiry');

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function manifestFor(text: string, overrides: Record<string, unknown> = {}) {
  return {
    exportId: EXPORT_ID,
    report: 'asset-activity-expiry',
    contractVersion: '1.0',
    format: 'csv',
    fileName: 'asset-activity-expiry.csv',
    sha256: sha256(text),
    bytes: new Blob([text]).size,
    rows: 1,
    columns: ['assetUri', 'assetId'],
    asOf: AS_OF,
    mode: 'live',
    filters: {},
    source: {},
    completedAt: '2026-10-20T00:00:01Z',
    ...overrides,
  };
}

function csvReply(text: string) {
  return {
    data: new Blob([text]),
    headers: {
      'x-export-id': EXPORT_ID,
      'content-disposition': 'attachment; filename="asset-activity-expiry-20261020.csv"',
    },
  };
}

describe('ExpiryReport page', () => {
  beforeEach(() => {
    quietConsole();
    reporting.get.mockReset();
    setRoles(['ROLE_VIEWER']);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('role gate', () => {
    it('shows a notice and makes no request for a user without a report role', async () => {
      setRoles(['ROLE_SERVICE_ACCOUNT']);
      const calls = serve({ page: () => ok(pageOf([row()])) });
      renderPage(<ExpiryReport />);
      expect(await screen.findByText('Your role cannot read reports')).toBeTruthy();
      expect(calls).toEqual([]);
      expect(screen.queryByRole('table')).toBeNull();
    });

    it.each([
      'ROLE_ADMIN',
      'ROLE_CDO',
      'ROLE_DIRECTOR',
      'ROLE_POLICY_MANAGER',
      'ROLE_DATA_ENGINEER',
      'ROLE_DATA_SCIENTIST',
      'ROLE_DATA_ANALYST',
      'ROLE_AUDITOR',
      'ROLE_VIEWER',
    ])('loads the report for %s', async (role) => {
      setRoles([role]);
      serve({ page: () => ok(pageOf([row()])) });
      renderPage(<ExpiryReport />);
      expect(await screen.findAllByTestId('expiry-row')).toHaveLength(1);
    });
  });

  describe('table', () => {
    it('requests page 0, 50 rows, sorted by asset URI, with no filter', async () => {
      const calls = serve({ page: () => ok(pageOf([row()])) });
      renderPage(<ExpiryReport />);
      await screen.findAllByTestId('expiry-row');
      expect(pageCalls(calls)).toHaveLength(1);
      expect(pageCalls(calls)[0].params).toEqual({ page: '0', size: '50', sort: 'assetUri,asc' });
    });

    it('shows the values the service delivered', async () => {
      serve({ page: () => ok(pageOf([row({ account: 'orders-proj' })])) });
      renderPage(<ExpiryReport />);
      const rowEl = (await screen.findAllByTestId('expiry-row'))[0];
      const text = rowEl.textContent ?? '';
      expect(text).toContain('orders-raw');
      expect(text).toContain('gs://orders-raw');
      expect(text).toContain('GCP / GCS_BUCKET');
      expect(text).toContain('orders-proj');
      expect(text).toContain('2.0 KB');
      expect(text).toContain('291 d');
      expect(text).toContain('2025-01-02');
      expect(text).toContain('2026-09-01');
      expect(text).toContain('idle 49 d');
      expect(text).toContain('RETAINED');
      expect(text).toContain('expires 2027-01-01');
      expect(screen.getByTestId('report-summary').textContent).toContain('1 asset');
      expect(screen.getByTestId('report-summary').textContent).toContain('2026-10-20');
    });

    it('shows a missing value as a dash and never as zero', async () => {
      serve({
        page: () =>
          ok(
            pageOf([
              row({
                sizeBytes: undefined,
                ageDays: undefined,
                createdAt: undefined,
                lastReadAt: undefined,
                idleDays: undefined,
                readSignalState: 'UNKNOWN',
                readCoverage: undefined,
                lastModifiedAt: undefined,
                retentionExpiresAt: undefined,
                retentionStatus: undefined,
              }),
            ])
          ),
      });
      renderPage(<ExpiryReport />);
      const text = (await screen.findAllByTestId('expiry-row'))[0].textContent ?? '';
      expect(text).toContain('idle: unknown');
      expect(text).toContain('coverage: none recorded');
      expect(text).toContain('expires -');
      expect(text).not.toMatch(/\b0 d\b|NaN|Invalid|undefined|null/);
    });

    it('shows a real size of zero as 0 B', async () => {
      serve({ page: () => ok(pageOf([row({ sizeBytes: 0 })])) });
      renderPage(<ExpiryReport />);
      expect((await screen.findAllByTestId('expiry-row'))[0].textContent).toContain('0 B');
    });

    it('marks a legal hold', async () => {
      serve({ page: () => ok(pageOf([row({ legalHold: true, retentionStatus: 'ON_HOLD' })])) });
      renderPage(<ExpiryReport />);
      const text = (await screen.findAllByTestId('expiry-row'))[0].textContent ?? '';
      expect(text).toContain('Legal hold');
      expect(text).toContain('ON_HOLD');
    });

    it('shows an empty state when the catalog has no assets', async () => {
      serve({ page: () => ok(pageOf([])) });
      renderPage(<ExpiryReport />);
      expect(await screen.findByText('No assets yet')).toBeTruthy();
      expect(screen.queryByRole('table')).toBeNull();
    });

    it('announces shadow mode', async () => {
      serve({ page: () => ok(pageOf([row()], { mode: 'shadow' })) });
      renderPage(<ExpiryReport />);
      await screen.findAllByTestId('expiry-row');
      expect(screen.getByRole('note').textContent).toContain('Shadow mode');
    });
  });

  describe('read signal text and coverage time (Q-832)', () => {
    const notRead = { readSignalState: 'NOT_READ' as const, readCoverage: 'FULL', lastReadAt: undefined, idleDays: undefined };

    it('prints the service\'s "not read since" text under the Not read badge', async () => {
      serve({ page: () => ok(pageOf([row({ ...notRead, readSignalText: 'not read since 2026-09-01' })])) });
      renderPage(<ExpiryReport />);
      const rowEl = (await screen.findAllByTestId('expiry-row'))[0];
      expect(within(rowEl).getByText('Not read', { selector: 'span' })).toBeTruthy();
      expect(within(rowEl).getByTestId('read-signal-text').textContent).toBe('not read since 2026-09-01');
    });

    it('says only Not read when the coverage start is not known', async () => {
      serve({ page: () => ok(pageOf([row({ ...notRead, readSignalText: undefined })])) });
      renderPage(<ExpiryReport />);
      const rowEl = (await screen.findAllByTestId('expiry-row'))[0];
      expect(within(rowEl).getByText('Not read', { selector: 'span' })).toBeTruthy();
      expect(within(rowEl).queryByTestId('read-signal-text')).toBeNull();
      expect(rowEl.textContent).not.toMatch(/since/);
    });

    it.each([
      ['READ', { readSignalState: 'READ' as const, readCoverage: 'FULL' }],
      ['PARTIAL_COVERAGE', { readSignalState: 'PARTIAL_COVERAGE' as const, readCoverage: 'PARTIAL', lastReadAt: undefined }],
      ['NO_COVERAGE', { readSignalState: 'NO_COVERAGE' as const, readCoverage: 'NONE', lastReadAt: undefined }],
      ['UNKNOWN', { readSignalState: 'UNKNOWN' as const, readCoverage: undefined, lastReadAt: undefined }],
      ['NOT_READ with partial coverage', { readSignalState: 'NOT_READ' as const, readCoverage: 'PARTIAL', lastReadAt: undefined }],
    ])('never prints the text next to %s', async (_name, overrides) => {
      serve({ page: () => ok(pageOf([row({ ...overrides, readSignalText: 'not read since 2026-09-01' })])) });
      renderPage(<ExpiryReport />);
      const rowEl = (await screen.findAllByTestId('expiry-row'))[0];
      expect(within(rowEl).queryByTestId('read-signal-text')).toBeNull();
      expect(rowEl.textContent).not.toMatch(/not read since/i);
    });

    it('shows when the catalog last read the logging configuration, as a UTC date', async () => {
      serve({ page: () => ok(pageOf([row({ readCoverageObservedAt: '2026-10-19T23:30:00Z' })])) });
      renderPage(<ExpiryReport />);
      const rowEl = (await screen.findAllByTestId('expiry-row'))[0];
      expect(within(rowEl).getByTestId('coverage-observed').textContent).toBe('logging checked 2026-10-19');
    });

    it('shows no checked line when the time is missing or unreadable', async () => {
      serve({
        page: () =>
          ok(
            pageOf([
              row({ readCoverageObservedAt: undefined }),
              row({ assetUri: 'gs://b', name: 'b', assetId: '22222222-2222-4222-8222-222222222222', readCoverageObservedAt: 'not a date' }),
            ])
          ),
      });
      renderPage(<ExpiryReport />);
      const rows = await screen.findAllByTestId('expiry-row');
      expect(rows).toHaveLength(2);
      for (const rowEl of rows) {
        expect(within(rowEl).queryByTestId('coverage-observed')).toBeNull();
      }
    });

    it('no longer says in the help text that the report cannot print "not read since"', async () => {
      serve({ page: () => ok(pageOf([row()])) });
      renderPage(<ExpiryReport />);
      await screen.findAllByTestId('expiry-row');
      const text = screen.getByTestId('logging-gaps').textContent ?? '';
      expect(text).not.toContain('does not yet print');
      expect(text).not.toContain('is not shown');
      expect(text).toContain('not read since');
      expect(text).toContain('logging configuration');
      expect(KNOWN_LOGGING_GAPS.map((gap) => gap.title)).not.toContain('The start of complete logging is not shown');
    });
  });

  describe('read-signal badges', () => {
    const states: Array<[string, Partial<ExpiryRow>, string]> = [
      ['READ', { readSignalState: 'READ', readCoverage: 'FULL' }, 'Read'],
      ['NOT_READ', { readSignalState: 'NOT_READ', readCoverage: 'FULL', lastReadAt: undefined, idleDays: undefined }, 'Not read'],
      ['PARTIAL_COVERAGE', { readSignalState: 'PARTIAL_COVERAGE', readCoverage: 'PARTIAL', lastReadAt: undefined, idleDays: undefined }, 'Partly logged'],
      ['NO_COVERAGE', { readSignalState: 'NO_COVERAGE', readCoverage: 'NONE', lastReadAt: undefined, idleDays: undefined }, 'Not logged'],
      ['UNKNOWN', { readSignalState: 'UNKNOWN', readCoverage: undefined, lastReadAt: undefined, idleDays: undefined }, 'Unknown'],
    ];

    it.each(states)('words %s as "%s" with the coverage as delivered', async (_state, overrides, label) => {
      serve({ page: () => ok(pageOf([row(overrides)])) });
      renderPage(<ExpiryReport />);
      const rowEl = (await screen.findAllByTestId('expiry-row'))[0];
      const badge = within(rowEl).getByText(label, { selector: 'span' });
      expect(badge).toBeTruthy();
      expect(rowEl.textContent).toContain(`coverage: ${overrides.readCoverage ?? 'none recorded'}`);
    });

    it('says "Not read" only for the NOT_READ state (E7: unknown is never not-read)', async () => {
      serve({ page: () => ok(pageOf(states.map(([, overrides], index) => row({ ...overrides, assetUri: `gs://b${index}`, name: `b${index}`, assetId: `00000000-0000-4000-8000-00000000000${index}` })))) });
      renderPage(<ExpiryReport />);
      const rows = await screen.findAllByTestId('expiry-row');
      expect(rows).toHaveLength(5);
      const withNotRead = rows.filter((r) => /not read/i.test(r.textContent ?? ''));
      expect(withNotRead).toHaveLength(1);
      expect(withNotRead[0].textContent).toContain('b1');
    });

    it.each(['PARTIAL', 'NONE', 'UNKNOWN', undefined])(
      'refuses to say "Not read" for NOT_READ with coverage %s',
      async (coverage) => {
        serve({ page: () => ok(pageOf([row({ readSignalState: 'NOT_READ', readCoverage: coverage, lastReadAt: undefined, idleDays: undefined })])) });
        renderPage(<ExpiryReport />);
        const text = (await screen.findAllByTestId('expiry-row'))[0].textContent ?? '';
        expect(text).not.toMatch(/not read/i);
        expect(text).toContain('Unknown');
      }
    );

    it('words a state it does not know as Unknown', async () => {
      serve({ page: () => ok(pageOf([row({ readSignalState: 'SOMETHING_NEW' as ExpiryRow['readSignalState'], lastReadAt: undefined, idleDays: undefined })])) });
      renderPage(<ExpiryReport />);
      const text = (await screen.findAllByTestId('expiry-row'))[0].textContent ?? '';
      expect(text).toContain('Unknown');
      expect(text).not.toMatch(/not read/i);
    });
  });

  describe('help text', () => {
    it('lists the five read-signal states and every known logging gap', async () => {
      serve({ page: () => ok(pageOf([row()])) });
      renderPage(<ExpiryReport />);
      await screen.findAllByTestId('expiry-row');
      for (const state of ['READ', 'NOT_READ', 'PARTIAL_COVERAGE', 'NO_COVERAGE', 'UNKNOWN']) {
        expect(screen.getByTestId(`legend-${state}`)).toBeTruthy();
      }
      const gaps = screen.getByTestId('logging-gaps');
      expect(within(gaps).getAllByRole('listitem')).toHaveLength(KNOWN_LOGGING_GAPS.length);
      expect(KNOWN_LOGGING_GAPS.length).toBeGreaterThanOrEqual(7);
      const text = gaps.textContent ?? '';
      expect(text).toContain('data events');
      expect(text).toContain('Data Access audit logs');
      expect(text).toContain('public objects');
      expect(text).toContain('exempted');
      expect(text).toContain('cache');
      expect(text).toContain('another project');
      expect(text).toContain('Storage Read API');
      expect(text).toContain('diagnostic setting');
      expect(text).toContain('properties');
      expect(text).toContain('complete logging began');
    });

    it('is shown even when the report fails to load', async () => {
      serve({ page: () => failure(503, 'The catalog could not be reached') });
      renderPage(<ExpiryReport />);
      await screen.findByText('The catalog could not be reached');
      expect(screen.getByTestId('logging-gaps')).toBeTruthy();
    });
  });

  describe('failure', () => {
    it('shows the failure and no rows when the catalog is unavailable, then recovers on retry', async () => {
      let healthy = false;
      serve({
        page: () => (healthy ? ok(pageOf([row()])) : failure(503, 'The catalog is down')),
      });
      renderPage(<ExpiryReport />);
      expect(await screen.findByText('The catalog is down')).toBeTruthy();
      expect(screen.queryAllByTestId('expiry-row')).toHaveLength(0);
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.getByRole('button', { name: /Download CSV/ }).hasAttribute('disabled')).toBe(true);

      healthy = true;
      fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
      expect(await screen.findAllByTestId('expiry-row')).toHaveLength(1);
    });

    it('treats a 200 that is not a report page as a failure', async () => {
      serve({ page: () => ok({ message: 'hello' }) });
      renderPage(<ExpiryReport />);
      expect(await screen.findByText('The reporting service answered, but not with a report page.')).toBeTruthy();
      expect(screen.queryAllByTestId('expiry-row')).toHaveLength(0);
    });

    it('drops the rows of an earlier page when the next page fails', async () => {
      serve({
        page: (params) =>
          params.page === '0' ? ok(pageOf([row()], { totalPages: 2, totalElements: 60 })) : failure(503, 'Gone for a moment'),
      });
      renderPage(<ExpiryReport />);
      await screen.findAllByTestId('expiry-row');
      fireEvent.click(screen.getByRole('button', { name: /Next/ }));
      expect(await screen.findByText('Gone for a moment')).toBeTruthy();
      expect(screen.queryAllByTestId('expiry-row')).toHaveLength(0);
    });

    it('names the 403 for a token the service refuses', async () => {
      serve({ page: () => failure(403) });
      renderPage(<ExpiryReport />);
      expect(await screen.findByText('Your role cannot read reports.')).toBeTruthy();
    });
  });

  describe('filters', () => {
    it('sends the ticked and typed filters and returns to page 0', async () => {
      const calls = serve({ page: () => ok(pageOf([row()])) });
      renderPage(<ExpiryReport />);
      await screen.findAllByTestId('expiry-row');

      const filters = within(screen.getByRole('form', { name: 'Report filters' }));
      fireEvent.click(filters.getByLabelText('GCP'));
      fireEvent.click(filters.getByLabelText('AWS'));
      fireEvent.click(filters.getByLabelText('DUE'));
      fireEvent.click(filters.getByLabelText('PARTIAL'));
      fireEvent.click(filters.getByLabelText('ACTIVE'));
      fireEvent.change(filters.getByLabelText('Asset kinds'), { target: { value: 'gcs_bucket, bigquery_table' } });
      fireEvent.change(filters.getByLabelText('Has a recorded read'), { target: { value: 'false' } });
      fireEvent.change(filters.getByLabelText('Legal hold'), { target: { value: 'false' } });
      fireEvent.change(filters.getByLabelText('Idle at least (days)'), { target: { value: '90' } });
      fireEvent.change(filters.getByLabelText('Last read before'), { target: { value: '2026-07-19' } });
      fireEvent.change(filters.getByLabelText('Last read after'), { target: { value: '2026-01-01' } });
      fireEvent.change(filters.getByLabelText('Report as of (UTC)'), { target: { value: '2026-10-01' } });
      fireEvent.click(filters.getByRole('button', { name: 'Apply filters' }));

      await waitFor(() => expect(pageCalls(calls)).toHaveLength(2));
      expect(pageCalls(calls)[1].params).toEqual({
        provider: 'AWS,GCP',
        kind: 'GCS_BUCKET,BIGQUERY_TABLE',
        status: 'ACTIVE',
        retentionStatus: 'DUE',
        readCoverage: 'PARTIAL',
        lastReadKnown: 'false',
        legalHold: 'false',
        idleDaysMin: '90',
        lastReadBefore: '2026-07-19T00:00:00Z',
        lastReadAfter: '2026-01-01T00:00:00Z',
        asOf: '2026-10-01T00:00:00Z',
        page: '0',
        size: '50',
        sort: 'assetUri,asc',
      });
    });

    it('blocks a malformed filter with a message and sends nothing', async () => {
      const calls = serve({ page: () => ok(pageOf([row()])) });
      renderPage(<ExpiryReport />);
      await screen.findAllByTestId('expiry-row');
      const filters = within(screen.getByRole('form', { name: 'Report filters' }));
      fireEvent.change(filters.getByLabelText('Idle at least (days)'), { target: { value: '-3' } });
      fireEvent.click(filters.getByRole('button', { name: 'Apply filters' }));
      expect((await screen.findByRole('alert')).textContent).toContain('Idle days must be a whole number');
      expect(pageCalls(calls)).toHaveLength(1);
    });

    it('explains an empty result and clears the filters', async () => {
      const calls = serve({ page: (params) => ok(params.provider === 'AWS' ? pageOf([]) : pageOf([row()])) });
      renderPage(<ExpiryReport />);
      await screen.findAllByTestId('expiry-row');
      const filters = within(screen.getByRole('form', { name: 'Report filters' }));
      fireEvent.click(filters.getByLabelText('AWS'));
      fireEvent.click(filters.getByRole('button', { name: 'Apply filters' }));
      expect(await screen.findByText('No asset matches these filters')).toBeTruthy();
      fireEvent.click(filters.getByRole('button', { name: 'Clear filters' }));
      expect(await screen.findAllByTestId('expiry-row')).toHaveLength(1);
      expect(pageCalls(calls).at(-1)?.params?.provider).toBeUndefined();
      expect((filters.getByLabelText('AWS') as HTMLInputElement).checked).toBe(false);
    });
  });

  describe('paging and sort', () => {
    it('moves between pages and keeps the report instant of the first page', async () => {
      const calls = serve({
        page: (params) => {
          const number = Number(params.page);
          return ok(pageOf([row({ name: `asset-${number}`, assetUri: `gs://asset-${number}` })], { number, totalPages: 3, totalElements: 120, asOf: '2026-10-20T08:15:00Z' }));
        },
      });
      renderPage(<ExpiryReport />);
      await screen.findByText('asset-0');
      expect(screen.getByTestId('page-position').textContent).toBe('Page 1 of 3');
      expect(screen.getByRole('button', { name: /Previous/ }).hasAttribute('disabled')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: /Next/ }));
      await screen.findByText('asset-1');
      expect(screen.getByTestId('page-position').textContent).toBe('Page 2 of 3');
      fireEvent.click(screen.getByRole('button', { name: /Next/ }));
      await screen.findByText('asset-2');
      expect(screen.getByRole('button', { name: /Next/ }).hasAttribute('disabled')).toBe(true);

      const sent = pageCalls(calls).map((call) => call.params);
      expect(sent[0]?.asOf).toBeUndefined();
      expect(sent[1]).toMatchObject({ page: '1', asOf: '2026-10-20T08:15:00Z' });
      expect(sent[2]).toMatchObject({ page: '2', asOf: '2026-10-20T08:15:00Z' });

      fireEvent.click(screen.getByRole('button', { name: /Previous/ }));
      await screen.findByText('asset-1');
    });

    it('sorts, changes the page size and returns to page 0', async () => {
      const calls = serve({ page: () => ok(pageOf([row()], { totalPages: 2, totalElements: 80 })) });
      renderPage(<ExpiryReport />);
      await screen.findAllByTestId('expiry-row');
      fireEvent.click(screen.getByRole('button', { name: /Next/ }));
      await waitFor(() => expect(pageCalls(calls)).toHaveLength(2));

      fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'lastAccessedAt' } });
      await waitFor(() => expect(pageCalls(calls)).toHaveLength(3));
      expect(pageCalls(calls)[2].params).toMatchObject({ page: '0', sort: 'lastAccessedAt,asc' });

      fireEvent.change(screen.getByLabelText('Sort direction'), { target: { value: 'desc' } });
      await waitFor(() => expect(pageCalls(calls)).toHaveLength(4));
      expect(pageCalls(calls)[3].params).toMatchObject({ sort: 'lastAccessedAt,desc' });

      fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '200' } });
      await waitFor(() => expect(pageCalls(calls)).toHaveLength(5));
      expect(pageCalls(calls)[4].params).toMatchObject({ size: '200', page: '0' });
    });

    it('offers only sort fields the catalog accepts', async () => {
      serve({ page: () => ok(pageOf([row()])) });
      renderPage(<ExpiryReport />);
      await screen.findAllByTestId('expiry-row');
      const values = Array.from((screen.getByLabelText('Sort by') as HTMLSelectElement).options).map((o) => o.value);
      expect(values).toEqual([
        'assetUri',
        'assetName',
        'cloudProvider',
        'serviceType',
        'status',
        'cloudCreatedAt',
        'sizeBytes',
        'lastAccessedAt',
        'lastModifiedAt',
        'retentionStatus',
        'retentionExpiresAt',
      ]);
    });
  });

  describe('CSV download', () => {
    let clicked: string[];
    let createObjectURL: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      clicked = [];
      createObjectURL = vi.fn(() => 'blob:test');
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this.download);
      });
      vi.stubGlobal('crypto', webcrypto);
    });

    async function openReport(handlers: Parameters<typeof serve>[0]) {
      const calls = serve({ page: () => ok(pageOf([row()], { asOf: '2026-10-20T08:15:00Z' })), ...handlers });
      renderPage(<ExpiryReport />);
      await screen.findAllByTestId('expiry-row');
      return calls;
    }

    it('downloads every matching row with the filters and the first page instant, then verifies it against the manifest', async () => {
      const calls = await openReport({ csv: () => csvReply(CSV_TEXT), manifest: () => ok(manifestFor(CSV_TEXT)) });
      const filters = within(screen.getByRole('form', { name: 'Report filters' }));
      fireEvent.click(filters.getByLabelText('GCP'));
      fireEvent.click(filters.getByRole('button', { name: 'Apply filters' }));
      await waitFor(() => expect(pageCalls(calls)).toHaveLength(2));
      await screen.findAllByTestId('expiry-row');

      fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
      const result = await screen.findByTestId('export-result');

      const csvCall = calls.find((call) => call.url === '/reports/expiry.csv');
      expect(csvCall?.params).toEqual({ provider: 'GCP', asOf: '2026-10-20T08:15:00Z' });
      expect(calls.some((call) => call.url === `/reports/expiry/exports/${EXPORT_ID}/manifest`)).toBe(true);
      expect(result.textContent).toContain('saved and checked against its manifest');
      expect(result.textContent).toContain(sha256(CSV_TEXT));
      expect(result.textContent).toContain('1 rows');
      expect(clicked).toEqual(['asset-activity-expiry-20261020.csv']);
      expect(createObjectURL).toHaveBeenCalledTimes(1);
    });

    it('does not save a file whose export has no manifest, and lets the person save it anyway', async () => {
      await openReport({ csv: () => csvReply(CSV_TEXT), manifest: () => failure(404, 'No completed export') });
      fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
      const result = await screen.findByTestId('export-result');
      expect(result.textContent).toContain('was not saved: the export has no manifest');
      expect(result.textContent).toContain('incomplete');
      expect(clicked).toEqual([]);

      fireEvent.click(screen.getByRole('button', { name: /Save the file anyway/ }));
      await waitFor(() => expect(clicked).toEqual(['asset-activity-expiry-20261020.csv']));
      expect((await screen.findByTestId('export-result')).textContent).toContain('Treat it as incomplete');
    });

    it('does not save a file whose SHA-256 differs from the manifest', async () => {
      await openReport({
        csv: () => csvReply(CSV_TEXT),
        manifest: () => ok(manifestFor(CSV_TEXT, { sha256: sha256('something else') })),
      });
      fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
      const result = await screen.findByTestId('export-result');
      expect(result.textContent).toContain('does not match its manifest');
      expect(result.textContent).toContain('SHA-256');
      expect(clicked).toEqual([]);
    });

    it('does not save a file whose size differs from the manifest', async () => {
      await openReport({ csv: () => csvReply(CSV_TEXT), manifest: () => ok(manifestFor(CSV_TEXT, { bytes: 3 })) });
      fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
      const result = await screen.findByTestId('export-result');
      expect(result.textContent).toContain('does not match its manifest');
      expect(result.textContent).toContain('the manifest says 3');
      expect(clicked).toEqual([]);
    });

    it('saves the file and says so when this browser cannot compute SHA-256 but the size matches', async () => {
      vi.stubGlobal('crypto', {});
      await openReport({ csv: () => csvReply(CSV_TEXT), manifest: () => ok(manifestFor(CSV_TEXT)) });
      fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
      const result = await screen.findByTestId('export-result');
      expect(result.textContent).toContain('cannot compute SHA-256');
      expect(result.textContent).toContain(sha256(CSV_TEXT));
      expect(clicked).toHaveLength(1);
    });

    it('saves the file with a warning when the export id header is not readable', async () => {
      await openReport({ csv: () => ({ data: new Blob([CSV_TEXT]), headers: {} }) });
      fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
      const result = await screen.findByTestId('export-result');
      expect(result.textContent).toContain('could not be checked');
      expect(result.textContent).toContain('X-Export-Id');
      expect(clicked).toEqual(['asset-activity-expiry.csv']);
    });

    it('saves the file with a warning when the manifest request itself fails', async () => {
      await openReport({ csv: () => csvReply(CSV_TEXT), manifest: () => failure(503, 'Reporting is restarting') });
      fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
      const result = await screen.findByTestId('export-result');
      expect(result.textContent).toContain('could not be checked');
      expect(result.textContent).toContain('Reporting is restarting');
      expect(clicked).toHaveLength(1);
    });

    it('reports a refused export (413) with the server message and saves nothing', async () => {
      await openReport({
        csv: () =>
          Object.assign(new Error('HTTP 413'), {
            response: { status: 413, data: new Blob([JSON.stringify({ message: 'The result has 300000 rows; the limit is 250000' })]) },
          }),
      });
      fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('The CSV was not produced');
      expect(alert.textContent).toContain('the limit is 250000');
      expect(clicked).toEqual([]);
    });

    it('disables the button while an export runs', async () => {
      let release: (value: unknown) => void = () => undefined;
      await openReport({
        csv: () => new Promise((resolve) => (release = resolve)),
        manifest: () => ok(manifestFor(CSV_TEXT)),
      });
      fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
      expect((await screen.findAllByRole('status')).some((el) => /Building the CSV/.test(el.textContent ?? ''))).toBe(true);
      expect(screen.getByRole('button', { name: /Download CSV/ }).hasAttribute('disabled')).toBe(true);
      release(csvReply(CSV_TEXT));
      await screen.findByTestId('export-result');
    });
  });
});
