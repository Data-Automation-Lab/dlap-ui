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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportingApi } from './api';
import {
  DEFAULT_PAGING,
  EMPTY_FILTERS,
  READ_SIGNAL_VIEWS,
  REPORT_READ_ROLES,
  ReportShapeError,
  buildQueryParams,
  canReadExpiryReport,
  describeReportError,
  downloadExpiryCsv,
  fetchExpiryPage,
  fetchExportManifest,
  fileNameFromDisposition,
  formatBytes,
  formatCount,
  formatUtcDate,
  parseManifest,
  readSignalView,
  sha256Hex,
  validateFilters,
  verifyDownload,
  type ExpiryFilters,
} from './reportApi';

vi.mock('./api', () => ({ reportingApi: { get: vi.fn() } }));
vi.mock('../keycloak', () => ({ default: {} }));

const get = reportingApi.get as unknown as ReturnType<typeof vi.fn>;

const filters = (overrides: Partial<ExpiryFilters> = {}): ExpiryFilters => ({ ...EMPTY_FILTERS, ...overrides });
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const subtle = webcrypto.subtle as SubtleCrypto;

describe('canReadExpiryReport', () => {
  it('lists exactly the nine human roles of the Access Model', () => {
    expect([...REPORT_READ_ROLES].sort()).toEqual(
      [
        'ROLE_ADMIN',
        'ROLE_AUDITOR',
        'ROLE_CDO',
        'ROLE_DATA_ANALYST',
        'ROLE_DATA_ENGINEER',
        'ROLE_DATA_SCIENTIST',
        'ROLE_DIRECTOR',
        'ROLE_POLICY_MANAGER',
        'ROLE_VIEWER',
      ].sort()
    );
  });

  it.each(REPORT_READ_ROLES)('allows %s', (role) => {
    expect(canReadExpiryReport([role])).toBe(true);
  });

  it('allows a user who holds one report role among others', () => {
    expect(canReadExpiryReport(['offline_access', 'ROLE_AUDITOR'])).toBe(true);
  });

  it.each([[[]], [['ROLE_SERVICE_ACCOUNT']], [['offline_access', 'uma_authorization']], [['admin']]])(
    'refuses roles %j',
    (roles) => {
      expect(canReadExpiryReport(roles)).toBe(false);
    }
  );
});

describe('buildQueryParams', () => {
  it('sends only paging and sort for no filter', () => {
    expect(buildQueryParams({ filters: EMPTY_FILTERS, paging: DEFAULT_PAGING })).toEqual({
      page: '0',
      size: '50',
      sort: 'assetUri,asc',
    });
  });

  it('sends nothing at all for the CSV with no filter', () => {
    expect(buildQueryParams({ filters: EMPTY_FILTERS, paging: DEFAULT_PAGING }, false)).toEqual({});
  });

  it('comma-joins lists, upper-cases kinds and turns dates into UTC instants', () => {
    const params = buildQueryParams({
      filters: filters({
        provider: ['GCP', 'AWS'],
        kind: ' gcs_bucket ,, bigquery_table',
        status: ['ACTIVE'],
        retentionStatus: ['DUE', 'UNKNOWN'],
        readCoverage: ['NONE'],
        lastReadKnown: 'true',
        legalHold: 'false',
        idleDaysMin: ' 30 ',
        lastReadBefore: '2026-07-19',
        lastReadAfter: '2026-01-01',
      }),
      paging: { page: 2, size: 100, sort: 'sizeBytes', direction: 'desc' },
    });
    expect(params).toEqual({
      provider: 'GCP,AWS',
      kind: 'GCS_BUCKET,BIGQUERY_TABLE',
      status: 'ACTIVE',
      retentionStatus: 'DUE,UNKNOWN',
      readCoverage: 'NONE',
      lastReadKnown: 'true',
      legalHold: 'false',
      idleDaysMin: '30',
      lastReadBefore: '2026-07-19T00:00:00Z',
      lastReadAfter: '2026-01-01T00:00:00Z',
      page: '2',
      size: '100',
      sort: 'sizeBytes,desc',
    });
  });

  it('lets a pinned instant win over the typed as-of date', () => {
    const typed = filters({ asOf: '2026-10-01' });
    expect(buildQueryParams({ filters: typed, paging: DEFAULT_PAGING }).asOf).toBe('2026-10-01T00:00:00Z');
    expect(buildQueryParams({ filters: typed, paging: DEFAULT_PAGING, asOf: '2026-10-20T08:15:00Z' }).asOf).toBe(
      '2026-10-20T08:15:00Z'
    );
    expect(buildQueryParams({ filters: EMPTY_FILTERS, paging: DEFAULT_PAGING }).asOf).toBeUndefined();
  });
});

describe('validateFilters', () => {
  it('accepts no filter and a full set of good ones', () => {
    expect(validateFilters(EMPTY_FILTERS)).toBeNull();
    expect(
      validateFilters(filters({ kind: 'GCS_BUCKET, S3_BUCKET', idleDaysMin: '0', lastReadBefore: '2026-02-28', asOf: '2026-10-20' }))
    ).toBeNull();
  });

  it.each([
    [{ kind: 'bucket!' }, 'is not an asset kind'],
    [{ kind: '1bucket' }, 'is not an asset kind'],
    [{ kind: Array.from({ length: 21 }, (_, i) => `K${i}`).join(',') }, 'at most 20'],
    [{ idleDaysMin: 'abc' }, 'Idle days'],
    [{ idleDaysMin: '-1' }, 'Idle days'],
    [{ idleDaysMin: '1.5' }, 'Idle days'],
    [{ idleDaysMin: '36501' }, 'Idle days'],
    [{ lastReadBefore: '2026-13-01' }, 'Last read before'],
    [{ lastReadAfter: '2026-02-30' }, 'Last read after'],
    [{ asOf: '20-10-2026' }, 'Report as of'],
  ])('rejects %j', (overrides, fragment) => {
    expect(validateFilters(filters(overrides))).toContain(fragment);
  });
});

describe('readSignalView', () => {
  it('words the five states and nothing else', () => {
    expect(READ_SIGNAL_VIEWS.map((view) => view.state)).toEqual(['READ', 'NOT_READ', 'PARTIAL_COVERAGE', 'NO_COVERAGE', 'UNKNOWN']);
    expect(readSignalView({ readSignalState: 'READ', readCoverage: 'PARTIAL' }).label).toBe('Read');
    expect(readSignalView({ readSignalState: 'NOT_READ', readCoverage: 'FULL' }).label).toBe('Not read');
    expect(readSignalView({ readSignalState: 'NOT_READ', readCoverage: ' full ' }).label).toBe('Not read');
    expect(readSignalView({ readSignalState: 'PARTIAL_COVERAGE', readCoverage: 'PARTIAL' }).label).toBe('Partly logged');
    expect(readSignalView({ readSignalState: 'NO_COVERAGE', readCoverage: 'NONE' }).label).toBe('Not logged');
    expect(readSignalView({ readSignalState: 'UNKNOWN', readCoverage: undefined }).label).toBe('Unknown');
  });

  it('uses the words "not read" for exactly one state', () => {
    const wording = READ_SIGNAL_VIEWS.filter((view) => /not read/i.test(view.label));
    expect(wording.map((view) => view.state)).toEqual(['NOT_READ']);
  });

  it.each([undefined, 'PARTIAL', 'NONE', 'UNKNOWN', '', 'garbage'])(
    'degrades NOT_READ to Unknown when coverage is %s',
    (coverage) => {
      expect(readSignalView({ readSignalState: 'NOT_READ', readCoverage: coverage }).state).toBe('UNKNOWN');
    }
  );

  it('degrades a missing or unknown state to Unknown', () => {
    expect(readSignalView({ readSignalState: undefined, readCoverage: 'FULL' }).state).toBe('UNKNOWN');
    expect(readSignalView({ readSignalState: 'FUTURE' as never, readCoverage: 'FULL' }).state).toBe('UNKNOWN');
  });
});

describe('formatters', () => {
  it('formats sizes, keeping 0 as a real size and null as unknown', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB');
    expect(formatBytes(null)).toBe('-');
    expect(formatBytes(undefined)).toBe('-');
    expect(formatBytes(-1)).toBe('-');
    expect(formatBytes(Number.NaN)).toBe('-');
  });

  it('formats a date as its UTC day whatever the local zone', () => {
    expect(formatUtcDate('2026-10-20T23:59:59Z')).toBe('2026-10-20');
    expect(formatUtcDate('2026-10-20T23:59:59-05:00')).toBe('2026-10-21');
    expect(formatUtcDate(null)).toBe('-');
    expect(formatUtcDate('')).toBe('-');
    expect(formatUtcDate('not a date')).toBe('-');
  });

  it('formats counts', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(null)).toBe('-');
    expect(formatCount(undefined)).toBe('-');
  });
});

describe('fileNameFromDisposition', () => {
  it('reads the quoted name and strips any path', () => {
    expect(fileNameFromDisposition('attachment; filename="report-1.csv"', 'x.csv')).toBe('report-1.csv');
    expect(fileNameFromDisposition('attachment; filename="../../etc/passwd"', 'x.csv')).toBe('.._.._etc_passwd');
    expect(fileNameFromDisposition(null, 'x.csv')).toBe('x.csv');
    expect(fileNameFromDisposition('attachment', 'x.csv')).toBe('x.csv');
  });
});

describe('requests', () => {
  beforeEach(() => get.mockReset());

  it('fetchExpiryPage returns a page and sends the comma-joined params', async () => {
    get.mockResolvedValue({ data: { items: [], page: { number: 0 } } });
    const page = await fetchExpiryPage({ filters: filters({ provider: ['GCP', 'AWS'] }), paging: DEFAULT_PAGING });
    expect(page.items).toEqual([]);
    expect(get).toHaveBeenCalledWith('/reports/expiry', { params: { provider: 'GCP,AWS', page: '0', size: '50', sort: 'assetUri,asc' } });
  });

  it.each([[null], [{}], [{ items: 'nope' }], ['text']])('fetchExpiryPage refuses the body %j', async (body) => {
    get.mockResolvedValue({ data: body });
    await expect(fetchExpiryPage({ filters: EMPTY_FILTERS, paging: DEFAULT_PAGING })).rejects.toBeInstanceOf(ReportShapeError);
  });

  it('downloadExpiryCsv asks for a blob without paging and reads the export id and file name', async () => {
    const blob = new Blob(['a']);
    get.mockResolvedValue({ data: blob, headers: { 'X-Export-Id': ' abc ', 'Content-Disposition': 'attachment; filename="f.csv"' } });
    const download = await downloadExpiryCsv({ filters: filters({ status: ['ACTIVE'] }), paging: DEFAULT_PAGING, asOf: '2026-10-20T00:00:00Z' });
    expect(download).toEqual({ blob, exportId: 'abc', fileName: 'f.csv' });
    const config = get.mock.calls[0][1];
    expect(get.mock.calls[0][0]).toBe('/reports/expiry.csv');
    expect(config.params).toEqual({ status: 'ACTIVE', asOf: '2026-10-20T00:00:00Z' });
    expect(config.responseType).toBe('blob');
    expect(config.timeout).toBeGreaterThan(60_000);
  });

  it('downloadExpiryCsv reads headers through an AxiosHeaders style get()', async () => {
    const map = new Map([['x-export-id', 'id-1']]);
    get.mockResolvedValue({ data: new Blob(['a']), headers: { get: (name: string) => map.get(name.toLowerCase()) } });
    const download = await downloadExpiryCsv({ filters: EMPTY_FILTERS, paging: DEFAULT_PAGING });
    expect(download.exportId).toBe('id-1');
    expect(download.fileName).toBe('asset-activity-expiry.csv');
  });

  it('downloadExpiryCsv reports an unreadable export id as null', async () => {
    get.mockResolvedValue({ data: new Blob(['a']), headers: {} });
    expect((await downloadExpiryCsv({ filters: EMPTY_FILTERS, paging: DEFAULT_PAGING })).exportId).toBeNull();
  });
});

describe('manifest', () => {
  beforeEach(() => get.mockReset());
  const body = (overrides: Record<string, unknown> = {}) => ({
    exportId: 'e1',
    report: 'asset-activity-expiry',
    contractVersion: '1.0',
    format: 'csv',
    fileName: 'f.csv',
    sha256: sha('abc'),
    bytes: 3,
    rows: 0,
    columns: ['assetUri'],
    asOf: '2026-10-20T00:00:00Z',
    mode: 'live',
    filters: {},
    source: {},
    completedAt: '2026-10-20T00:00:01Z',
    ...overrides,
  });

  it('parseManifest keeps a complete manifest and refuses one without a checksum, size or row count', () => {
    expect(parseManifest(body())?.sha256).toBe(sha('abc'));
    expect(parseManifest(body({ sha256: 'ABC' }))).toBeNull();
    expect(parseManifest(body({ sha256: undefined }))).toBeNull();
    expect(parseManifest(body({ bytes: '3' }))).toBeNull();
    expect(parseManifest(body({ rows: undefined }))).toBeNull();
    expect(parseManifest(body({ exportId: 7 }))).toBeNull();
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest('x')).toBeNull();
  });

  it('fetchExportManifest finds, misses on 404, and rethrows anything else', async () => {
    get.mockResolvedValueOnce({ data: body() });
    expect((await fetchExportManifest('e 1')).kind).toBe('found');
    expect(get).toHaveBeenCalledWith('/reports/expiry/exports/e%201/manifest');

    get.mockRejectedValueOnce({ response: { status: 404 } });
    expect(await fetchExportManifest('e1')).toEqual({ kind: 'missing' });

    const boom = { response: { status: 500 } };
    get.mockRejectedValueOnce(boom);
    await expect(fetchExportManifest('e1')).rejects.toBe(boom);

    get.mockResolvedValueOnce({ data: { sha256: 'bad' } });
    await expect(fetchExportManifest('e1')).rejects.toBeInstanceOf(ReportShapeError);
  });
});

describe('verifyDownload', () => {
  const download = (text: string) => ({ blob: new Blob([text]), exportId: 'e1', fileName: 'f.csv' });
  const manifest = (text: string, overrides: Record<string, unknown> = {}) => ({
    kind: 'found' as const,
    manifest: {
      exportId: 'e1',
      report: '',
      contractVersion: '',
      format: 'csv',
      fileName: 'f.csv',
      sha256: sha(text),
      bytes: new Blob([text]).size,
      rows: 1,
      columns: [],
      asOf: '',
      mode: '',
      filters: {},
      source: {},
      completedAt: '',
      ...overrides,
    },
  });

  it('computes SHA-256 as the same hex that sha256sum prints', async () => {
    expect(await sha256Hex(new Blob(['abc']), subtle)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('has no digest where the browser has no Web Crypto', async () => {
    vi.stubGlobal('crypto', {});
    try {
      expect(await sha256Hex(new Blob(['abc']))).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('verifies a file that matches', async () => {
    expect((await verifyDownload(download('a,b\n1,2\n'), manifest('a,b\n1,2\n'), subtle)).kind).toBe('verified');
  });

  it('reports no manifest as an incomplete export', async () => {
    expect(await verifyDownload(download('x'), { kind: 'missing' }, subtle)).toEqual({ kind: 'no-manifest' });
  });

  it('detects a changed byte of the same length', async () => {
    const result = await verifyDownload(download('a,b\n1,3\n'), manifest('a,b\n1,2\n'), subtle);
    expect(result.kind).toBe('mismatch');
    expect(result.kind === 'mismatch' && result.reason).toContain('SHA-256');
  });

  it('detects a truncated file by its size before hashing', async () => {
    const result = await verifyDownload(download('a,b\n'), manifest('a,b\n1,2\n'), subtle);
    expect(result.kind).toBe('mismatch');
    expect(result.kind === 'mismatch' && result.reason).toContain('bytes');
  });

  it('falls back to a size-only result without Web Crypto', async () => {
    vi.stubGlobal('crypto', {});
    try {
      expect((await verifyDownload(download('abc'), manifest('abc'))).kind).toBe('unchecked');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('describeReportError', () => {
  const http = (status: number, message?: string) => ({ response: { status, data: message ? { message } : {} } });

  it('words every status the report can answer', async () => {
    expect(await describeReportError(new ReportShapeError('not a page'))).toBe('not a page');
    expect(await describeReportError(new Error('Network Error'))).toBe('The reporting service could not be reached.');
    expect(await describeReportError(http(400, 'Unknown provider X'))).toBe('Unknown provider X');
    expect(await describeReportError(http(400))).toBe('The filters were not accepted.');
    expect(await describeReportError(http(401))).toBe('Your session has expired. Sign in again.');
    expect(await describeReportError(http(403, 'Forbidden'))).toBe('Your role cannot read reports.');
    expect(await describeReportError(http(413, 'Too many rows'))).toBe('Too many rows');
    expect(await describeReportError(http(413))).toContain('Narrow the filters');
    expect(await describeReportError(http(503, 'Catalog down'))).toBe('Catalog down');
    expect(await describeReportError(http(503))).toContain('was not built');
    expect(await describeReportError(http(500))).toBe('The report could not be loaded (HTTP 500).');
  });

  it('reads the message of a Blob body (the CSV request asks for a blob)', async () => {
    const error = { response: { status: 413, data: new Blob([JSON.stringify({ message: 'Result has 300000 rows' })]) } };
    expect(await describeReportError(error)).toBe('Result has 300000 rows');
    const garbage = { response: { status: 503, data: new Blob(['<html>']) } };
    expect(await describeReportError(garbage)).toContain('was not built');
  });
});
