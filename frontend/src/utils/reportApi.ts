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

import type { ExpiryReportPage, ExpiryReportRow } from '../api/generated/reporting';
import { reportingApi } from './api';
import { httpStatus, serverMessage } from './httpError';

/**
 * Client for the Asset Activity and Expiry report (RPT-02 over the RPT-01 contract, ADR-0082).
 *
 * This module holds no business rules. Age, idle days, retention status and the read signal are
 * computed by the services and shown as delivered. What lives here is the request shape (filters,
 * paging, sort), the CSV download with its integrity check against the manifest, the wording of
 * the five read-signal states, and the role list that may open the page.
 */

/** Path of the report below the reporting API base (/api/v1/reporting). */
const EXPIRY_PATH = '/reports/expiry';
const EXPIRY_CSV_PATH = '/reports/expiry.csv';

/** A CSV of the largest allowed export (250000 rows) can take minutes to stream; the default 10 s would cut it. */
export const EXPORT_TIMEOUT_MS = 10 * 60 * 1000;

/** One row of the report, exactly as the service delivers it. */
export type ExpiryRow = ExpiryReportRow;

/** One page of the report with its envelope. */
export type ExpiryPage = ExpiryReportPage;

/** The five things a missing or present last read can mean (ADR-0082, decision 2). */
export type ReadSignalState = NonNullable<ExpiryReportRow['readSignalState']>;

/**
 * Manifest of a completed CSV export. The OpenAPI contract types this body as an empty object, so
 * the shape is written out here from ExportManifest.java; the fields the page relies on are
 * checked at runtime by {@link parseManifest}.
 */
export interface ExportManifest {
  exportId: string;
  report: string;
  contractVersion: string;
  format: string;
  fileName: string;
  /** Lower-case hexadecimal SHA-256 of the exact bytes the server sent. */
  sha256: string;
  bytes: number;
  /** Data rows, not counting the header. */
  rows: number;
  columns: string[];
  asOf: string;
  mode: string;
  filters: Record<string, unknown>;
  source: Record<string, unknown>;
  completedAt: string;
}

/** The realm roles that may read reports: the nine human roles of the Access Model. The machine principal may not. */
export const REPORT_READ_ROLES: readonly string[] = [
  'ROLE_ADMIN',
  'ROLE_CDO',
  'ROLE_DIRECTOR',
  'ROLE_POLICY_MANAGER',
  'ROLE_DATA_ENGINEER',
  'ROLE_DATA_SCIENTIST',
  'ROLE_DATA_ANALYST',
  'ROLE_AUDITOR',
  'ROLE_VIEWER',
];

/**
 * Whether a user's realm roles include one that may read the report. This only decides what the
 * UI offers; the reporting service enforces the same list and answers 403 to anyone else.
 */
export function canReadExpiryReport(roles: readonly string[]): boolean {
  return roles.some((role) => REPORT_READ_ROLES.includes(role));
}

// ---------------------------------------------------------------------------------------------
// Filters, paging and sort
// ---------------------------------------------------------------------------------------------

/** Providers the catalog can hold assets for (AssetProvider). */
export const PROVIDER_OPTIONS: readonly string[] = ['AWS', 'GCP', 'AZURE', 'OCI', 'UNITY', 'DATABRICKS', 'SNOWFLAKE'];
/** Lifecycle statuses of an asset. */
export const STATUS_OPTIONS: readonly string[] = ['ACTIVE', 'ARCHIVED', 'PENDING_DELETION', 'DELETED'];
/** Retention results the catalog stores. */
export const RETENTION_STATUS_OPTIONS: readonly string[] = ['UNKNOWN', 'NO_POLICY', 'RETAINED', 'DUE', 'ON_HOLD'];
/** Read coverage values; UNKNOWN selects assets for which the catalog holds none. */
export const COVERAGE_OPTIONS: readonly string[] = ['FULL', 'PARTIAL', 'NONE', 'UNKNOWN'];

/** A tri-state choice for a yes/no filter: either answer, or no filter at all. */
export type Choice = '' | 'true' | 'false';

/** What the person typed or ticked; every value is text so an empty box means "no filter". */
export interface ExpiryFilters {
  provider: string[];
  /** Asset kinds, comma separated, for example GCS_BUCKET, BIGQUERY_TABLE. */
  kind: string;
  status: string[];
  retentionStatus: string[];
  readCoverage: string[];
  lastReadKnown: Choice;
  legalHold: Choice;
  /** Whole days, as text. */
  idleDaysMin: string;
  /** A calendar date, YYYY-MM-DD, read as 00:00 UTC. */
  lastReadBefore: string;
  lastReadAfter: string;
  /** Pin the report instant: a calendar date, YYYY-MM-DD, read as 00:00 UTC. Empty means now. */
  asOf: string;
}

/** The filters of a fresh page: none. */
export const EMPTY_FILTERS: ExpiryFilters = {
  provider: [],
  kind: '',
  status: [],
  retentionStatus: [],
  readCoverage: [],
  lastReadKnown: '',
  legalHold: '',
  idleDaysMin: '',
  lastReadBefore: '',
  lastReadAfter: '',
  asOf: '',
};

/** Sort fields the catalog accepts for this report, with the column they sort. */
export const SORT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'assetUri', label: 'Asset URI' },
  { value: 'assetName', label: 'Name' },
  { value: 'cloudProvider', label: 'Provider' },
  { value: 'serviceType', label: 'Kind' },
  { value: 'status', label: 'Lifecycle status' },
  { value: 'cloudCreatedAt', label: 'Created' },
  { value: 'sizeBytes', label: 'Size' },
  { value: 'lastAccessedAt', label: 'Last read' },
  { value: 'lastModifiedAt', label: 'Last write' },
  { value: 'retentionStatus', label: 'Retention status' },
  { value: 'retentionExpiresAt', label: 'Retention expiry' },
];

/** Page sizes the page offers; the service allows 1 to 200. */
export const PAGE_SIZES: readonly number[] = [25, 50, 100, 200];

/** Where in the result the person is looking. */
export interface Paging {
  /** Zero-based. */
  page: number;
  size: number;
  sort: string;
  direction: 'asc' | 'desc';
}

/** The paging of a fresh page. */
export const DEFAULT_PAGING: Paging = { page: 0, size: 50, sort: 'assetUri', direction: 'asc' };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const KIND_TOKEN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const MAX_FILTER_VALUES = 20;
const MAX_IDLE_DAYS = 36_500;

/** Splits comma separated text into trimmed, non-empty tokens. */
function tokens(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** True for a real calendar date written YYYY-MM-DD. */
function isCalendarDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** A date input value as the ISO-8601 instant the service expects (00:00 UTC of that day). */
function toInstant(value: string): string {
  return `${value}T00:00:00Z`;
}

/**
 * Checks what can be checked before a request goes out, so a typo shows next to the form instead
 * of as a 400. The service validates everything again.
 *
 * @returns the first problem as a sentence, or null when the filters are fit to send
 */
export function validateFilters(filters: ExpiryFilters): string | null {
  const kinds = tokens(filters.kind);
  if (kinds.length > MAX_FILTER_VALUES) {
    return `Give at most ${MAX_FILTER_VALUES} asset kinds.`;
  }
  const badKind = kinds.find((kind) => !KIND_TOKEN.test(kind));
  if (badKind !== undefined) {
    return `"${badKind}" is not an asset kind. A kind is a name such as GCS_BUCKET.`;
  }
  const idle = filters.idleDaysMin.trim();
  if (idle !== '') {
    if (!/^\d+$/.test(idle) || Number(idle) > MAX_IDLE_DAYS) {
      return `Idle days must be a whole number from 0 to ${MAX_IDLE_DAYS}.`;
    }
  }
  const dates: Array<[string, string]> = [
    ['Last read before', filters.lastReadBefore],
    ['Last read after', filters.lastReadAfter],
    ['Report as of', filters.asOf],
  ];
  for (const [label, value] of dates) {
    if (value.trim() !== '' && !isCalendarDate(value.trim())) {
      return `${label} must be a date written YYYY-MM-DD.`;
    }
  }
  return null;
}

/** What one request to the report needs on top of the filters. */
export interface ReportRequest {
  filters: ExpiryFilters;
  paging: Paging;
  /** The report instant to send; wins over {@code filters.asOf}. Pages 2 onward and the CSV reuse the first page's instant. */
  asOf?: string;
}

/** Query string values: only parameters that carry a value are present. */
export type QueryParams = Record<string, string>;

/**
 * The query string of a report request. Lists are comma separated (the service accepts commas or
 * repeated parameters, and axios would otherwise write provider[]=AWS). Empty filters are left
 * out, so "no filter" is never sent as an empty value.
 *
 * @param request the filters, paging and optional pinned instant
 * @param includePaging false for the CSV, which ignores paging and always runs in assetUri order
 */
export function buildQueryParams(request: ReportRequest, includePaging = true): QueryParams {
  const { filters, paging } = request;
  const params: QueryParams = {};
  const list = (name: string, values: readonly string[]) => {
    if (values.length > 0) {
      params[name] = values.join(',');
    }
  };
  list('provider', filters.provider);
  list('kind', tokens(filters.kind).map((kind) => kind.toUpperCase()));
  list('status', filters.status);
  list('retentionStatus', filters.retentionStatus);
  list('readCoverage', filters.readCoverage);
  if (filters.lastReadKnown !== '') {
    params.lastReadKnown = filters.lastReadKnown;
  }
  if (filters.legalHold !== '') {
    params.legalHold = filters.legalHold;
  }
  if (filters.idleDaysMin.trim() !== '') {
    params.idleDaysMin = filters.idleDaysMin.trim();
  }
  if (filters.lastReadBefore.trim() !== '') {
    params.lastReadBefore = toInstant(filters.lastReadBefore.trim());
  }
  if (filters.lastReadAfter.trim() !== '') {
    params.lastReadAfter = toInstant(filters.lastReadAfter.trim());
  }
  const asOf = request.asOf ?? (filters.asOf.trim() !== '' ? toInstant(filters.asOf.trim()) : undefined);
  if (asOf !== undefined && asOf !== '') {
    params.asOf = asOf;
  }
  if (includePaging) {
    params.page = String(paging.page);
    params.size = String(paging.size);
    params.sort = `${paging.sort},${paging.direction}`;
  }
  return params;
}

// ---------------------------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------------------------

/** The reporting service answered 2xx with a body that is not the report contract. */
export class ReportShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportShapeError';
  }
}

/**
 * Fetches one page of the report.
 *
 * @throws ReportShapeError when the body is not a page (the report is never shown half-read)
 * @throws the transport error when the service answers an error; see {@link describeReportError}
 */
export async function fetchExpiryPage(request: ReportRequest): Promise<ExpiryPage> {
  const response = await reportingApi.get<ExpiryPage>(EXPIRY_PATH, { params: buildQueryParams(request) });
  const body = response.data;
  if (typeof body !== 'object' || body === null || !Array.isArray(body.items)) {
    throw new ReportShapeError('The reporting service answered, but not with a report page.');
  }
  return body;
}

/** A downloaded CSV, still in memory, with what the response said about it. */
export interface CsvDownload {
  blob: Blob;
  /** From the X-Export-Id header; null when the browser could not read it (a cross-origin deployment without exposed headers). */
  exportId: string | null;
  fileName: string;
}

/** Reads a response header whatever the header container is (AxiosHeaders, or a plain object in tests). */
function headerValue(headers: unknown, name: string): string | null {
  if (typeof headers !== 'object' || headers === null) {
    return null;
  }
  const container = headers as { get?: (key: string) => unknown } & Record<string, unknown>;
  if (typeof container.get === 'function') {
    const viaGet = container.get(name);
    if (typeof viaGet === 'string') {
      return viaGet;
    }
  }
  const wanted = name.toLowerCase();
  for (const key of Object.keys(container)) {
    if (key.toLowerCase() === wanted && typeof container[key] === 'string') {
      return container[key] as string;
    }
  }
  return null;
}

/** The file name from a Content-Disposition header, or the fallback. */
export function fileNameFromDisposition(disposition: string | null, fallback: string): string {
  if (disposition === null) {
    return fallback;
  }
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  if (match === null) {
    return fallback;
  }
  let name = match[1].trim();
  try {
    name = decodeURIComponent(name);
  } catch {
    // keep the raw name
  }
  // A download name must never carry a path.
  name = name.replace(/[\\/]/g, '_');
  return name === '' ? fallback : name;
}

/**
 * Downloads the whole report as CSV. The export ignores paging and runs in assetUri order over
 * every matching row, so the file is the full result, not the page on screen.
 */
export async function downloadExpiryCsv(request: ReportRequest): Promise<CsvDownload> {
  const response = await reportingApi.get<Blob>(EXPIRY_CSV_PATH, {
    params: buildQueryParams(request, false),
    responseType: 'blob',
    timeout: EXPORT_TIMEOUT_MS,
  });
  const exportId = headerValue(response.headers, 'x-export-id');
  return {
    blob: response.data,
    exportId: exportId !== null && exportId.trim() !== '' ? exportId.trim() : null,
    fileName: fileNameFromDisposition(headerValue(response.headers, 'content-disposition'), 'asset-activity-expiry.csv'),
  };
}

/** The server's answer for a manifest request, as the page needs it. */
export type ManifestLookup = { kind: 'found'; manifest: ExportManifest } | { kind: 'missing' };

/** Checks the fields the page relies on; a manifest without them is not trusted. */
export function parseManifest(body: unknown): ExportManifest | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const m = body as Record<string, unknown>;
  if (
    typeof m.exportId !== 'string' ||
    typeof m.sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(m.sha256) ||
    typeof m.bytes !== 'number' ||
    typeof m.rows !== 'number'
  ) {
    return null;
  }
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const record = (value: unknown) =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return {
    exportId: m.exportId,
    report: text(m.report),
    contractVersion: text(m.contractVersion),
    format: text(m.format),
    fileName: text(m.fileName),
    sha256: m.sha256,
    bytes: m.bytes,
    rows: m.rows,
    columns: Array.isArray(m.columns) ? m.columns.filter((c): c is string => typeof c === 'string') : [],
    asOf: text(m.asOf),
    mode: text(m.mode),
    filters: record(m.filters),
    source: record(m.source),
    completedAt: text(m.completedAt),
  };
}

/**
 * Fetches the manifest of a finished export. A 404 is a normal answer, not an error: it means the
 * export did not finish, expired, or was served by another instance. Anything else rethrows.
 *
 * @throws ReportShapeError when a 200 body lacks the manifest fields
 */
export async function fetchExportManifest(exportId: string): Promise<ManifestLookup> {
  let body: unknown;
  try {
    const response = await reportingApi.get<unknown>(`${EXPIRY_PATH}/exports/${encodeURIComponent(exportId)}/manifest`);
    body = response.data;
  } catch (error) {
    if (httpStatus(error) === 404) {
      return { kind: 'missing' };
    }
    throw error;
  }
  const manifest = parseManifest(body);
  if (manifest === null) {
    throw new ReportShapeError('The manifest is missing its checksum, size or row count.');
  }
  return { kind: 'found', manifest };
}

// ---------------------------------------------------------------------------------------------
// Integrity check
// ---------------------------------------------------------------------------------------------

/** The bytes of a blob; falls back to FileReader where Blob.arrayBuffer is missing. */
function blobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsArrayBuffer(blob);
  });
}

/** SHA-256 of a blob as lower-case hex, or null when this browser cannot compute it (no Web Crypto). */
export async function sha256Hex(
  blob: Blob,
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle
): Promise<string | null> {
  if (subtle === undefined) {
    return null;
  }
  const digest = await subtle.digest('SHA-256', new Uint8Array(await blobBytes(blob)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * How a downloaded file compares with its manifest.
 * - `verified`: size and SHA-256 both match.
 * - `mismatch`: the file is not the one the server described; do not trust it.
 * - `unchecked`: the size matches but this browser cannot compute SHA-256; check with sha256sum.
 * - `no-manifest`: the server has no manifest; the export did not finish, so the file is incomplete.
 */
export type IntegrityResult =
  | { kind: 'verified'; manifest: ExportManifest }
  | { kind: 'mismatch'; manifest: ExportManifest; reason: string }
  | { kind: 'unchecked'; manifest: ExportManifest }
  | { kind: 'no-manifest' };

/** Compares a downloaded blob with the manifest the server keeps for its export id. */
export async function verifyDownload(
  download: CsvDownload,
  lookup: ManifestLookup,
  subtle?: SubtleCrypto
): Promise<IntegrityResult> {
  if (lookup.kind === 'missing') {
    return { kind: 'no-manifest' };
  }
  const { manifest } = lookup;
  if (download.blob.size !== manifest.bytes) {
    return {
      kind: 'mismatch',
      manifest,
      reason: `The file is ${download.blob.size} bytes; the manifest says ${manifest.bytes}.`,
    };
  }
  const digest = subtle === undefined ? await sha256Hex(download.blob) : await sha256Hex(download.blob, subtle);
  if (digest === null) {
    return { kind: 'unchecked', manifest };
  }
  if (digest !== manifest.sha256) {
    return { kind: 'mismatch', manifest, reason: 'The SHA-256 of the file differs from the manifest.' };
  }
  return { kind: 'verified', manifest };
}

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('The response could not be read.'));
    reader.readAsText(blob);
  });
}

/** Reads the message out of a failed response whose body may be a Blob (a CSV request) or parsed JSON. */
export async function responseMessage(error: unknown): Promise<string | undefined> {
  const direct = serverMessage(error);
  if (direct !== undefined) {
    return direct;
  }
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const parsed: unknown = JSON.parse(await blobText(data));
      const message = (parsed as { message?: unknown } | null)?.message;
      return typeof message === 'string' && message.length > 0 ? message : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * One sentence for a failed report request. The report is never partial, so every failure is
 * shown as a failure and no rows are kept next to it.
 */
export async function describeReportError(error: unknown): Promise<string> {
  if (error instanceof ReportShapeError) {
    return error.message;
  }
  const status = httpStatus(error);
  const message = await responseMessage(error);
  switch (status) {
    case undefined:
      return 'The reporting service could not be reached.';
    case 400:
      return message ?? 'The filters were not accepted.';
    case 401:
      return 'Your session has expired. Sign in again.';
    case 403:
      return 'Your role cannot read reports.';
    case 413:
      return message ?? 'The result is larger than the export limit. Narrow the filters and try again.';
    case 503:
      return message ?? 'The catalog could not deliver the rows, so the report was not built. Try again shortly.';
    default:
      return message ?? `The report could not be loaded (HTTP ${status}).`;
  }
}

// ---------------------------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------------------------

/** Badge colours the design system offers. */
export type BadgeVariant = 'brand' | 'neutral' | 'error' | 'warning' | 'success';

/** How a read-signal state is worded and coloured. */
export interface ReadSignalView {
  state: ReadSignalState;
  label: string;
  variant: BadgeVariant;
  /** One sentence that says what the state allows and what it does not. */
  meaning: string;
}

/**
 * The five states in the order the legend shows them. "Not read" is worded only for NOT_READ,
 * which the service reaches only with FULL read coverage; every other state without a read says
 * that the logs could not tell.
 */
export const READ_SIGNAL_VIEWS: readonly ReadSignalView[] = [
  {
    state: 'READ',
    label: 'Read',
    variant: 'success',
    meaning:
      'A successful read is recorded. With partial or no coverage it is the latest read the logs saw, not necessarily the latest read.',
  },
  {
    state: 'NOT_READ',
    label: 'Not read',
    variant: 'brand',
    meaning: 'No read is recorded and read logging covers this asset completely, so it was not read while logging was on.',
  },
  {
    state: 'PARTIAL_COVERAGE',
    label: 'Partly logged',
    variant: 'warning',
    meaning: 'No read is recorded, but read logging covers only part of the asset. Reads may have gone unseen.',
  },
  {
    state: 'NO_COVERAGE',
    label: 'Not logged',
    variant: 'warning',
    meaning: 'No read is recorded and read logging does not watch this asset, so nothing could have been seen.',
  },
  {
    state: 'UNKNOWN',
    label: 'Unknown',
    variant: 'neutral',
    meaning: 'No read is recorded and the catalog holds no read coverage for this asset. Nothing can be said about reads.',
  },
];

const UNKNOWN_VIEW = READ_SIGNAL_VIEWS[READ_SIGNAL_VIEWS.length - 1];

/**
 * The wording for a row. A state this page does not know, a missing state, and a NOT_READ that
 * the row's own coverage text contradicts all fall back to Unknown, so a defect upstream can
 * only make the page say less, never claim "not read".
 */
export function readSignalView(row: Pick<ExpiryReportRow, 'readSignalState' | 'readCoverage'>): ReadSignalView {
  const found = READ_SIGNAL_VIEWS.find((view) => view.state === row.readSignalState);
  if (found === undefined) {
    return UNKNOWN_VIEW;
  }
  if (found.state === 'NOT_READ' && (row.readCoverage ?? '').trim().toUpperCase() !== 'FULL') {
    return UNKNOWN_VIEW;
  }
  return found;
}

/** Shown for a value the service did not deliver. */
export const MISSING = '-';

/** Whole bytes as a short size; null is unknown, 0 is a real size. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return MISSING;
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const text = unit === 0 ? String(value) : value >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${text} ${units[unit]}`;
}

/** A timestamp as its UTC calendar date (YYYY-MM-DD), or the missing marker. Locale and time zone never change it. */
export function formatUtcDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return MISSING;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? MISSING : parsed.toISOString().slice(0, 10);
}

/** A whole-number count or the missing marker. */
export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? MISSING : String(value);
}
