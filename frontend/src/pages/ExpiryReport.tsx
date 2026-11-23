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

import {
  FeatherChevronLeft,
  FeatherChevronRight,
  FeatherDownload,
  FeatherRefreshCw,
} from "@subframe/core";
import React, { useEffect, useRef, useState } from "react";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { Table } from "../ui/components/Table";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { useCurrentUser } from "../utils/currentUser";
import {
  COVERAGE_OPTIONS,
  DEFAULT_PAGING,
  EMPTY_FILTERS,
  MISSING,
  PAGE_SIZES,
  PROVIDER_OPTIONS,
  READ_SIGNAL_VIEWS,
  RETENTION_STATUS_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  canReadExpiryReport,
  describeReportError,
  downloadExpiryCsv,
  fetchExpiryPage,
  fetchExportManifest,
  formatBytes,
  formatUtcDate,
  readSignalView,
  validateFilters,
  verifyDownload,
  type BadgeVariant,
  type Choice,
  type CsvDownload,
  type ExpiryFilters,
  type ExpiryPage,
  type ExpiryRow,
  type IntegrityResult,
  type Paging,
} from "../utils/reportApi";

/**
 * The Asset Activity and Expiry report (RPT-02 over RPT-01, ADR-0082).
 *
 * The page shows what the reporting service delivers and decides nothing: ages, idle days,
 * retention results and the read signal are the services' values, and a missing value is shown
 * as unknown. The one rule it keeps for itself is wording: "Not read" appears only for the state
 * the service reaches with complete read logging (see utils/reportApi.readSignalView).
 */

/**
 * The gaps in what read logging can see, as the log specs and coverage code state them. Shown on
 * the page so nobody reads a missing read as proof. Each entry names its source for the next
 * maintainer; the sources are not shown to the reader.
 */
export const KNOWN_LOGGING_GAPS: ReadonlyArray<{ title: string; text: string; source: string }> = [
  {
    title: "Read logging is off until it is switched on",
    text: "For Amazon S3 the trail needs data events, and for Google Cloud Storage the Data Access audit logs must be enabled. Both are off by default. Until they are on, DLAP sees no reads and the report says Not logged or Unknown, never Not read. BigQuery data access logs are on by default.",
    source: "research/hardening/06-log-layer-design.md risk 3; ADR-0080 decision 5",
  },
  {
    title: "Public Cloud Storage objects are not logged",
    text: "Cloud Audit Logs does not record reads of public objects. A bucket that is public, or that keeps per-object permissions without enforced public access prevention, is at most Partly logged.",
    source: "GcpAuditConfigEvaluator.java rules",
  },
  {
    title: "Exempted principals leave no read records",
    text: "A principal exempted from Data Access audit logging in a Google Cloud project is invisible. One exemption makes the project Partly logged. The report counts exemptions and never names the principals.",
    source: "GcpAuditConfigEvaluator.java rules; ADR-0080 decision 8",
  },
  {
    title: "BigQuery: cached results, other projects and job history",
    text: "A query answered from the cache leaves no table-read record. Reads by jobs that run in another project are not yet confirmed to be logged in the table's project, so a BigQuery project is at most Partly logged until an operator confirms it. Where only the job-history view is connected, reads are job reads only: Storage Read API and tabledata.list reads never appear in it.",
    source: "research/hardening/02-logs-gcp.md; ReadCoverageCombiner.java; ADR-0080 decision 8",
  },
  {
    title: "Azure: storage read logging needs a diagnostic setting",
    text: "Blob reads are logged only when the storage account has a diagnostic setting with read logging switched on. A request for a blob's properties, metadata or tags is not a read.",
    source: "research/hardening/03-logs-azure.md; ExpiryReport package-info",
  },
  {
    title: "Only successful reads count, and the last read may not be the latest",
    text: "A failed request is not a read. With Partly logged or Not logged coverage, the last read shown is the latest one the logs saw. Log delivery is not instant, so a very recent read may not have arrived yet.",
    source: "ADR-0082 decision 2; ReadSignalState.java",
  },
  {
    title: "Not read counts only from when complete logging began",
    text: "Not read means no read while logging was complete. The report prints \"not read since\" that date when the catalog has recorded when complete logging began, and says only Not read when it has not. Reads before logging was switched on are unknown, not zero. The line under the coverage shows when the catalog last read the logging configuration, so an old date means the coverage may have changed since.",
    source: "ADR-0082 consequences (Q-444); ADR-0129; Q-832",
  },
];

/** What a person sees for one retention status. */
const RETENTION_VARIANT: Record<string, BadgeVariant> = {
  DUE: "warning",
  RETAINED: "success",
  ON_HOLD: "brand",
  UNKNOWN: "neutral",
  NO_POLICY: "neutral",
};

/** The state of the table area: one request in flight, its page, or its failure. Never both. */
type Loaded =
  | { key: string; page: ExpiryPage; error?: undefined }
  | { key: string; page?: undefined; error: string };

/** The state of the CSV export, from the click to the integrity check. */
type ExportState =
  | { phase: "idle" }
  | { phase: "working" }
  | { phase: "saved"; fileName: string; integrity: IntegrityResult | null; note?: string }
  | { phase: "withheld"; fileName: string; integrity: IntegrityResult; download: CsvDownload }
  | { phase: "error"; message: string };

/** Hands a blob to the browser as a file download. */
function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke after the click has been handled; the browser keeps the blob alive for the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A group of tick boxes for one multi-valued filter. */
function CheckGroup(props: {
  legend: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { legend, options, selected, onChange } = props;
  return (
    <fieldset className="flex min-w-[160px] flex-col gap-1 border-0 p-0">
      <legend className="mb-1 text-caption-bold font-caption-bold text-subtext-color">{legend}</legend>
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 text-body font-body text-default-font">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={(event) => {
              // Keep the options in their listed order so the same ticks always give the same request.
              const next = event.target.checked ? [...selected, option] : selected.filter((value) => value !== option);
              onChange(options.filter((candidate) => next.includes(candidate)));
            }}
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}

/** A labelled yes/no/either choice. */
function ChoiceField(props: {
  id: string;
  label: string;
  value: Choice;
  yes: string;
  no: string;
  onChange: (next: Choice) => void;
}) {
  const { id, label, value, yes, no, onChange } = props;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-caption-bold font-caption-bold text-subtext-color">
        {label}
      </label>
      <select
        id={id}
        className="h-8 rounded-md border border-solid border-neutral-border bg-default-background px-2 text-body font-body text-default-font"
        value={value}
        onChange={(event) => onChange(event.target.value as Choice)}
      >
        <option value="">Either</option>
        <option value="true">{yes}</option>
        <option value="false">{no}</option>
      </select>
    </div>
  );
}

/** A labelled text-like input. */
function TextInput(props: {
  id: string;
  label: string;
  value: string;
  type?: "text" | "number" | "date";
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  const { id, label, value, type = "text", placeholder, onChange } = props;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-caption-bold font-caption-bold text-subtext-color">
        {label}
      </label>
      <input
        id={id}
        type={type}
        className="h-8 rounded-md border border-solid border-neutral-border bg-default-background px-2 text-body font-body text-default-font"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/** One report row. */
function ReportRow({ row }: { row: ExpiryRow }) {
  const signal = readSignalView(row);
  const retention = row.retentionStatus ?? "UNKNOWN";
  const rule =
    row.retentionDays != null && row.retentionBasis
      ? `Rule: ${row.retentionDays} days from ${row.retentionBasis}${row.retentionSource ? ` (${row.retentionSource})` : ""}`
      : undefined;
  const coverageText = row.readCoverage ? row.readCoverage : "none recorded";
  // The service words "not read since YYYY-MM-DD" (readSignalText) only for a NOT_READ asset whose coverage start
  // is known. The page prints it only under the Not read badge, so a text next to any other state is never shown.
  const sinceText = signal.state === "NOT_READ" && row.readSignalText ? row.readSignalText : null;
  const observedAt = row.readCoverageObservedAt ? formatUtcDate(row.readCoverageObservedAt) : null;
  return (
    <Table.Row data-testid="expiry-row">
      <Table.Cell>
        <div className="flex max-w-[360px] flex-col">
          <span className="break-all text-body-bold font-body-bold text-default-font">{row.name || row.assetUri || MISSING}</span>
          <span className="break-all text-caption font-caption text-subtext-color" title={row.assetUri}>
            {row.assetUri ?? MISSING}
          </span>
        </div>
      </Table.Cell>
      <Table.Cell>
        <div className="flex flex-col">
          <span className="text-body font-body text-default-font">
            {row.provider ?? MISSING} {row.type ? `/ ${row.type}` : ""}
          </span>
          <span className="text-caption font-caption text-subtext-color">{row.account ?? row.region ?? MISSING}</span>
        </div>
      </Table.Cell>
      <Table.Cell>
        <div className="flex flex-col items-start gap-1">
          <span className="text-body font-body text-default-font">{row.lifecycleStatus ?? MISSING}</span>
          {row.legalHold ? <Badge variant="brand">Legal hold</Badge> : null}
        </div>
      </Table.Cell>
      <Table.Cell>
        <span className="whitespace-nowrap text-body font-body text-default-font">{formatBytes(row.sizeBytes)}</span>
      </Table.Cell>
      <Table.Cell>
        <div className="flex flex-col" title={row.createdSource ? `Creation time from ${row.createdSource}` : undefined}>
          <span className="whitespace-nowrap text-body font-body text-default-font">
            {row.ageDays == null ? MISSING : `${row.ageDays} d`}
          </span>
          <span className="text-caption font-caption text-subtext-color">{formatUtcDate(row.createdAt)}</span>
        </div>
      </Table.Cell>
      <Table.Cell>
        <div className="flex flex-col" title={row.lastReadSource ? `Last read seen in ${row.lastReadSource}` : undefined}>
          <span className="whitespace-nowrap text-body font-body text-default-font">{formatUtcDate(row.lastReadAt)}</span>
          <span className="text-caption font-caption text-subtext-color">
            {row.idleDays == null ? "idle: unknown" : `idle ${row.idleDays} d`}
          </span>
        </div>
      </Table.Cell>
      <Table.Cell>
        <div className="flex flex-col items-start gap-1">
          <span title={signal.meaning}>
            <Badge variant={signal.variant}>{signal.label}</Badge>
          </span>
          {sinceText !== null ? (
            <span data-testid="read-signal-text" className="whitespace-nowrap text-caption font-caption text-default-font">
              {sinceText}
            </span>
          ) : null}
          <span className="text-caption font-caption text-subtext-color">coverage: {coverageText}</span>
          {observedAt !== null && observedAt !== MISSING ? (
            <span data-testid="coverage-observed" className="whitespace-nowrap text-caption font-caption text-subtext-color">
              logging checked {observedAt}
            </span>
          ) : null}
        </div>
      </Table.Cell>
      <Table.Cell>
        <span className="whitespace-nowrap text-body font-body text-default-font">{formatUtcDate(row.lastModifiedAt)}</span>
      </Table.Cell>
      <Table.Cell>
        <div className="flex flex-col items-start gap-1" title={rule}>
          <Badge variant={RETENTION_VARIANT[retention] ?? "neutral"}>{retention}</Badge>
          <span className="whitespace-nowrap text-caption font-caption text-subtext-color">
            expires {formatUtcDate(row.retentionExpiresAt)}
          </span>
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

/** Shows how an export compares with its manifest. */
function ExportPanel(props: { state: ExportState; onSaveAnyway: () => void }) {
  const { state, onSaveAnyway } = props;
  if (state.phase === "idle") {
    return null;
  }
  if (state.phase === "working") {
    return (
      <div role="status" className="w-full rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-3 text-body font-body text-default-font">
        Building the CSV. A large export can take a few minutes. Keep this page open.
      </div>
    );
  }
  if (state.phase === "error") {
    return (
      <div role="alert" className="w-full rounded-md border border-solid border-error-200 bg-error-50 px-4 py-3 text-body font-body text-error-800">
        The CSV was not produced. {state.message}
      </div>
    );
  }
  const integrity = state.integrity;
  const tone =
    integrity?.kind === "verified"
      ? "border-success-200 bg-success-50 text-success-800"
      : "border-warning-200 bg-warning-50 text-warning-800";
  return (
    <div role="status" data-testid="export-result" className={`flex w-full flex-col gap-2 rounded-md border border-solid px-4 py-3 text-body font-body ${tone}`}>
      {integrity?.kind === "verified" ? (
        <>
          <span className="text-body-bold font-body-bold">{state.fileName} saved and checked against its manifest.</span>
          <span>
            {integrity.manifest.rows} rows, {integrity.manifest.bytes} bytes, report instant {integrity.manifest.asOf}.
          </span>
          <span className="break-all">SHA-256 {integrity.manifest.sha256}</span>
        </>
      ) : null}
      {integrity?.kind === "unchecked" ? (
        <>
          <span className="text-body-bold font-body-bold">{state.fileName} saved. Its size matches the manifest.</span>
          <span>This browser cannot compute SHA-256, so the checksum was not compared. Run sha256sum on the file and compare it with:</span>
          <span className="break-all">SHA-256 {integrity.manifest.sha256}</span>
        </>
      ) : null}
      {integrity === null ? (
        <>
          <span className="text-body-bold font-body-bold">{state.fileName} saved, but it could not be checked.</span>
          <span>{state.phase === "saved" ? state.note : null}</span>
        </>
      ) : null}
      {state.phase === "withheld" && integrity?.kind === "no-manifest" ? (
        <>
          <span className="text-body-bold font-body-bold">{state.fileName} was not saved: the export has no manifest.</span>
          <span>
            A file without a manifest is incomplete, or the manifest is held by another reporting instance. Run the export again.
          </span>
        </>
      ) : null}
      {state.phase === "withheld" && integrity?.kind === "mismatch" ? (
        <>
          <span className="text-body-bold font-body-bold">{state.fileName} was not saved: it does not match its manifest.</span>
          <span>{integrity.reason} Run the export again.</span>
        </>
      ) : null}
      {state.phase === "withheld" ? (
        <div>
          <Button variant="neutral-secondary" size="small" onClick={onSaveAnyway}>
            Save the file anyway, unverified
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** The page body; rendered only for a role that may read reports so no request goes out for anyone else. */
function ExpiryReportBody() {
  const [draft, setDraft] = useState<ExpiryFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<ExpiryFilters>(EMPTY_FILTERS);
  const [paging, setPaging] = useState<Paging>(DEFAULT_PAGING);
  const [reloadKey, setReloadKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ phase: "idle" });
  // The report instant of the current query. Page 1 lets the service pick "now"; every later page
  // and the CSV send that same instant back, so the rows on screen and the file agree.
  const asOfRef = useRef<string | null>(null);

  const requestKey = JSON.stringify({ applied, paging, reloadKey });

  useEffect(() => {
    let cancelled = false;
    fetchExpiryPage({ filters: applied, paging, asOf: asOfRef.current ?? undefined })
      .then((page) => {
        if (cancelled) {
          return;
        }
        if (asOfRef.current === null && page.asOf) {
          asOfRef.current = page.asOf;
        }
        setLoaded({ key: requestKey, page });
      })
      .catch(async (error: unknown) => {
        const message = await describeReportError(error);
        if (!cancelled) {
          // A failed request keeps no rows: the report is never shown partial.
          setLoaded({ key: requestKey, error: message });
        }
      });
    return () => {
      cancelled = true;
    };
    // requestKey encodes applied, paging and reloadKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const loading = loaded === null || loaded.key !== requestKey;
  const page = loaded?.page;
  const error = loaded?.error;

  const update = <K extends keyof ExpiryFilters>(name: K, value: ExpiryFilters[K]) =>
    setDraft((current) => ({ ...current, [name]: value }));

  const applyFilters = (event?: React.FormEvent) => {
    event?.preventDefault();
    const problem = validateFilters(draft);
    setFormError(problem);
    if (problem !== null) {
      return;
    }
    asOfRef.current = null;
    setApplied(draft);
    setPaging((current) => ({ ...current, page: 0 }));
    setExportState({ phase: "idle" });
  };

  const clearFilters = () => {
    asOfRef.current = null;
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setFormError(null);
    setPaging((current) => ({ ...current, page: 0 }));
    setExportState({ phase: "idle" });
  };

  const refresh = () => {
    asOfRef.current = null;
    setReloadKey((current) => current + 1);
  };

  const runExport = async () => {
    setExportState({ phase: "working" });
    try {
      const download = await downloadExpiryCsv({ filters: applied, paging, asOf: asOfRef.current ?? undefined });
      if (download.exportId === null) {
        saveBlob(download.blob, download.fileName);
        setExportState({
          phase: "saved",
          fileName: download.fileName,
          integrity: null,
          note: "The export id header was not readable in this browser, so the manifest could not be fetched. Find the manifest through the API with the X-Export-Id value.",
        });
        return;
      }
      let integrity: IntegrityResult;
      try {
        integrity = await verifyDownload(download, await fetchExportManifest(download.exportId));
      } catch (manifestError) {
        saveBlob(download.blob, download.fileName);
        setExportState({
          phase: "saved",
          fileName: download.fileName,
          integrity: null,
          note: `The manifest could not be fetched. ${await describeReportError(manifestError)}`,
        });
        return;
      }
      if (integrity.kind === "verified" || integrity.kind === "unchecked") {
        saveBlob(download.blob, download.fileName);
        setExportState({ phase: "saved", fileName: download.fileName, integrity });
      } else {
        setExportState({ phase: "withheld", fileName: download.fileName, integrity, download });
      }
    } catch (exportError) {
      setExportState({ phase: "error", message: await describeReportError(exportError) });
    }
  };

  const saveAnyway = () => {
    if (exportState.phase === "withheld") {
      saveBlob(exportState.download.blob, exportState.download.fileName);
      setExportState({
        phase: "saved",
        fileName: exportState.fileName,
        integrity: null,
        note: "You saved it without a passing manifest check. Treat it as incomplete.",
      });
    }
  };

  const totalPages = page?.page?.totalPages ?? 0;
  const totalElements = page?.page?.totalElements ?? 0;
  const currentPage = page?.page?.number ?? paging.page;
  const filtersActive = JSON.stringify(applied) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border px-12 py-4">
          <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">
            Asset Activity and Expiry
          </span>
          <Button variant="neutral-tertiary" icon={<FeatherRefreshCw />} onClick={refresh} disabled={loading}>
            Refresh
          </Button>
          <Button
            variant="brand-primary"
            icon={<FeatherDownload />}
            onClick={() => void runExport()}
            disabled={exportState.phase === "working" || loading || error !== undefined}
          >
            Download CSV
          </Button>
        </div>

        <div className="flex w-full flex-col items-start gap-6 px-12 py-8">
          <p className="max-w-[900px] text-body font-body text-subtext-color">
            Every asset with its age, size, last read, last write and retention state. A blank or dash is unknown, never zero.
            A missing last read means "not read" only when the Read signal says Not read; otherwise the logs could not tell.
          </p>

          {page?.mode === "shadow" ? (
            <div role="note" className="w-full rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-3 text-body font-body text-default-font">
              Shadow mode: this deployment only observes and acts on nothing.
            </div>
          ) : null}

          <form
            aria-label="Report filters"
            className="flex w-full flex-col gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-4"
            onSubmit={applyFilters}
          >
            <div className="flex flex-wrap items-start gap-6">
              <CheckGroup legend="Provider" options={PROVIDER_OPTIONS} selected={draft.provider} onChange={(next) => update("provider", next)} />
              <CheckGroup legend="Lifecycle status" options={STATUS_OPTIONS} selected={draft.status} onChange={(next) => update("status", next)} />
              <CheckGroup
                legend="Retention status"
                options={RETENTION_STATUS_OPTIONS}
                selected={draft.retentionStatus}
                onChange={(next) => update("retentionStatus", next)}
              />
              <CheckGroup legend="Read coverage" options={COVERAGE_OPTIONS} selected={draft.readCoverage} onChange={(next) => update("readCoverage", next)} />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <TextInput id="filter-kind" label="Asset kinds" value={draft.kind} placeholder="GCS_BUCKET, BIGQUERY_TABLE" onChange={(next) => update("kind", next)} />
              <ChoiceField id="filter-last-read-known" label="Has a recorded read" value={draft.lastReadKnown} yes="Yes" no="No" onChange={(next) => update("lastReadKnown", next)} />
              <ChoiceField id="filter-legal-hold" label="Legal hold" value={draft.legalHold} yes="On hold" no="Not on hold" onChange={(next) => update("legalHold", next)} />
              <TextInput id="filter-idle-days" label="Idle at least (days)" type="number" value={draft.idleDaysMin} onChange={(next) => update("idleDaysMin", next)} />
              <TextInput id="filter-read-before" label="Last read before" type="date" value={draft.lastReadBefore} onChange={(next) => update("lastReadBefore", next)} />
              <TextInput id="filter-read-after" label="Last read after" type="date" value={draft.lastReadAfter} onChange={(next) => update("lastReadAfter", next)} />
              <TextInput id="filter-as-of" label="Report as of (UTC)" type="date" value={draft.asOf} onChange={(next) => update("asOf", next)} />
            </div>
            {formError ? (
              <span role="alert" className="text-body font-body text-error-700">
                {formError}
              </span>
            ) : null}
            <div className="flex items-center gap-2">
              <Button type="submit" variant="brand-primary" size="small">
                Apply filters
              </Button>
              <Button type="button" variant="neutral-tertiary" size="small" onClick={clearFilters} disabled={!filtersActive && JSON.stringify(draft) === JSON.stringify(EMPTY_FILTERS)}>
                Clear filters
              </Button>
              <span className="grow" />
              <label htmlFor="sort-field" className="text-caption-bold font-caption-bold text-subtext-color">
                Sort by
              </label>
              <select
                id="sort-field"
                className="h-8 rounded-md border border-solid border-neutral-border bg-default-background px-2 text-body font-body text-default-font"
                value={paging.sort}
                onChange={(event) => setPaging({ ...paging, sort: event.target.value, page: 0 })}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label htmlFor="sort-direction" className="sr-only">
                Sort direction
              </label>
              <select
                id="sort-direction"
                className="h-8 rounded-md border border-solid border-neutral-border bg-default-background px-2 text-body font-body text-default-font"
                value={paging.direction}
                onChange={(event) => setPaging({ ...paging, direction: event.target.value as Paging["direction"], page: 0 })}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
              <label htmlFor="page-size" className="text-caption-bold font-caption-bold text-subtext-color">
                Rows per page
              </label>
              <select
                id="page-size"
                className="h-8 rounded-md border border-solid border-neutral-border bg-default-background px-2 text-body font-body text-default-font"
                value={paging.size}
                onChange={(event) => setPaging({ ...paging, size: Number(event.target.value), page: 0 })}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </form>

          <ExportPanel state={exportState} onSaveAnyway={saveAnyway} />

          {error !== undefined && !loading ? <ErrorState message={error} onRetry={refresh} /> : null}

          {loading ? (
            <div role="status" className="w-full text-body font-body text-subtext-color">
              Loading the report
            </div>
          ) : null}

          {page && !loading ? (
            <>
              <div className="flex w-full items-center gap-4 text-body font-body text-subtext-color" data-testid="report-summary">
                <span>
                  {totalElements} {totalElements === 1 ? "asset" : "assets"}
                  {filtersActive ? " match the filters" : ""}
                </span>
                <span>Day counts as of {formatUtcDate(page.asOf)} ({page.asOf})</span>
                <span>Contract {page.contractVersion ?? MISSING}</span>
              </div>

              {(page.items ?? []).length === 0 ? (
                <EmptyState
                  title={filtersActive ? "No asset matches these filters" : "No assets yet"}
                  message={
                    filtersActive
                      ? "Clear a filter to widen the report."
                      : "The catalog holds no assets. Run a discovery scan, then come back."
                  }
                />
              ) : (
                <div className="w-full overflow-x-auto rounded-md border border-solid border-neutral-border">
                  <Table
                    aria-label="Asset activity and expiry"
                    header={
                      <Table.HeaderRow>
                        <Table.HeaderCell>Asset</Table.HeaderCell>
                        <Table.HeaderCell>Provider / kind</Table.HeaderCell>
                        <Table.HeaderCell>Status</Table.HeaderCell>
                        <Table.HeaderCell>Size</Table.HeaderCell>
                        <Table.HeaderCell>Age</Table.HeaderCell>
                        <Table.HeaderCell>Last read</Table.HeaderCell>
                        <Table.HeaderCell>Read signal</Table.HeaderCell>
                        <Table.HeaderCell>Last write</Table.HeaderCell>
                        <Table.HeaderCell>Retention</Table.HeaderCell>
                      </Table.HeaderRow>
                    }
                  >
                    {(page.items ?? []).map((row, index) => (
                      <ReportRow key={row.assetId ?? row.assetUri ?? index} row={row} />
                    ))}
                  </Table>
                </div>
              )}

              <div className="flex w-full items-center justify-end gap-2">
                <span className="text-body font-body text-subtext-color" data-testid="page-position">
                  Page {totalPages === 0 ? 0 : currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="neutral-secondary"
                  size="small"
                  icon={<FeatherChevronLeft />}
                  disabled={currentPage <= 0}
                  onClick={() => setPaging({ ...paging, page: Math.max(0, currentPage - 1) })}
                >
                  Previous
                </Button>
                <Button
                  variant="neutral-secondary"
                  size="small"
                  iconRight={<FeatherChevronRight />}
                  disabled={currentPage + 1 >= totalPages}
                  onClick={() => setPaging({ ...paging, page: currentPage + 1 })}
                >
                  Next
                </Button>
              </div>
            </>
          ) : null}

          <section aria-labelledby="read-signal-help" className="flex w-full flex-col gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-4">
            <h2 id="read-signal-help" className="text-heading-3 font-heading-3 text-default-font">
              What the Read signal means
            </h2>
            <ul className="flex flex-col gap-2">
              {READ_SIGNAL_VIEWS.map((view) => (
                <li key={view.state} className="flex items-start gap-3" data-testid={`legend-${view.state}`}>
                  <span className="w-[120px] flex-none">
                    <Badge variant={view.variant}>{view.label}</Badge>
                  </span>
                  <span className="text-body font-body text-default-font">{view.meaning}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="logging-gaps-help" className="flex w-full flex-col gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-4">
            <h2 id="logging-gaps-help" className="text-heading-3 font-heading-3 text-default-font">
              Known logging gaps
            </h2>
            <p className="text-body font-body text-subtext-color">
              DLAP knows only what your cloud logs record. These gaps make a missing read an unreliable sign that nobody read the asset.
            </p>
            <ul className="flex list-disc flex-col gap-3 pl-6" data-testid="logging-gaps">
              {KNOWN_LOGGING_GAPS.map((gap) => (
                <li key={gap.title} className="text-body font-body text-default-font">
                  <span className="text-body-bold font-body-bold">{gap.title}. </span>
                  {gap.text}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="csv-help" className="flex w-full flex-col gap-2 rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-4">
            <h2 id="csv-help" className="text-heading-3 font-heading-3 text-default-font">
              About the CSV
            </h2>
            <p className="text-body font-body text-default-font">
              Download CSV exports every matching asset, not only this page, in asset URI order, using the same report instant as the rows above.
              Empty cells are unknown values. Each finished export has a manifest with its size, row count and SHA-256. This page checks the file
              against the manifest before it saves it. A file without a matching manifest is incomplete.
            </p>
          </section>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

/** Role gate: a user whose roles cannot read reports sees a notice and the page makes no request. */
function ExpiryReport() {
  const { roles } = useCurrentUser();
  if (!canReadExpiryReport(roles)) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full flex-col items-start bg-default-background px-12 py-8">
          <EmptyState
            title="Your role cannot read reports"
            message="The Asset Activity and Expiry report is open to the nine human roles. Ask an administrator to give you one."
          />
        </div>
      </DefaultPageLayout>
    );
  }
  return <ExpiryReportBody />;
}

export default ExpiryReport;
