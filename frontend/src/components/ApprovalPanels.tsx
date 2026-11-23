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

"use client";

import { FeatherCheckCircle, FeatherRotateCcw } from "@subframe/core";
import { useEffect, useState } from "react";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { Table } from "../ui/components/Table";
import { TextArea } from "../ui/components/TextArea";
import {
  APPROVALS_ROUTE,
  MISSING,
  RESTORABLE_STATES,
  RULE_STATES,
  SOFT_DELETE_LABELS,
  canListSoftDeletes,
  canReadApprovals,
  canRestore,
  countPending,
  describeApprovalError,
  describeRestoreError,
  describeRestoreSuccess,
  fetchSoftDeletes,
  formatUtcMinute,
  restoreSoftDeleted,
  ruleTimingLines,
  type SoftDeletePage,
  type SoftDeleteRecord,
  type SoftDeleteState,
} from "../utils/approvalApi";
import { useCurrentUser } from "../utils/currentUser";
import { useAppNavigate } from "../utils/useAppNavigate";

/**
 * Two panels the Smart Deletion and Smart Archival pages share with the approval inbox (APPR-02).
 * Both are views of what the services deliver; the rules (who may decide, what can be restored)
 * stay on the server.
 */

/**
 * A line that says how many requests wait for approval and opens the inbox. It shows nothing for a
 * role that cannot read approvals, while nothing waits, and when the count cannot be read: the
 * line is a convenience and never replaces or breaks the page it sits on.
 *
 * @param props.actionClasses the action classes the host page cares about, for example ["ARCHIVE"]
 */
export function PendingApprovalsNotice(props: { actionClasses: readonly string[] }) {
  const { roles } = useCurrentUser();
  const nav = useAppNavigate();
  const mayRead = canReadApprovals(roles);
  const classKey = props.actionClasses.join(",");
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!mayRead) {
      return;
    }
    let cancelled = false;
    countPending(classKey.split(","))
      .then((total) => {
        if (!cancelled) {
          setCount(total);
        }
      })
      .catch((failure: unknown) => {
        console.warn("Could not count pending approvals:", describeApprovalError(failure));
        if (!cancelled) {
          setCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mayRead, classKey]);

  if (!mayRead || count === null || count <= 0) {
    return null;
  }
  return (
    <div
      role="status"
      aria-label="Pending approvals"
      className="flex w-full items-center gap-4 rounded-md border border-solid border-warning-100 bg-warning-50 px-4 py-3"
    >
      <FeatherCheckCircle className="h-4 w-4 text-warning-800" />
      <span className="grow shrink-0 basis-0 text-body font-body text-warning-900">
        {count} {count === 1 ? "request is" : "requests are"} waiting for approval before anything runs.
      </span>
      <Button variant="neutral-secondary" size="small" onClick={() => nav.goTo(APPROVALS_ROUTE)}>
        Open approvals
      </Button>
    </div>
  );
}

const STATE_VARIANT: Record<SoftDeleteState, "success" | "warning" | "error" | "neutral"> = {
  SOFT_DELETED: "warning",
  DRY_RUN: "neutral",
  RULE_IN_FORCE: "warning",
  RULE_AWAITING_PROOF: "warning",
  AWAITING_PROOF: "warning",
  RULE_ENDED: "neutral",
  RULE_ENDED_UNPROVEN: "neutral",
  RESTORE_FAILED: "error",
  HARD_DELETED: "neutral",
  HARD_DELETE_FAILED: "error",
  HARD_DELETE_REFUSED: "warning",
  RESTORED: "success",
  UNKNOWN: "neutral",
};

/**
 * The soft-delete records with a Restore action. A soft-deleted asset can be restored until its
 * hard delete runs; the service decides whether a given record still can, and answers 409 when it
 * cannot. The Restore button is offered for the states the service restores (soft-deleted, dry run, hard delete
 * refused, lifecycle rule in force or applied and waiting for proof) and to the roles that may restore. A dry run
 * is its own state and never reads as a deletion (Q-636). A record whose rule is on the platform shows when the
 * rule was applied, how old it is and when the executor removes it (Q-696). The note is sent with the restore
 * and kept in the record's audit note.
 */
export function SoftDeleteRestorePanel() {
  const { roles } = useCurrentUser();
  const mayList = canListSoftDeletes(roles);
  const mayRestore = canRestore(roles);
  const [pageNo, setPageNo] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<{ key: string; page?: SoftDeletePage; error?: string } | null>(null);
  const [target, setTarget] = useState<SoftDeleteRecord | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const requestKey = `${pageNo}:${reloadKey}`;

  useEffect(() => {
    if (!mayList) {
      return;
    }
    let cancelled = false;
    fetchSoftDeletes(pageNo)
      .then((page) => {
        if (!cancelled) {
          setData({ key: requestKey, page });
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setData({ key: requestKey, error: describeApprovalError(failure) });
        }
      });
    return () => {
      cancelled = true;
    };
    // requestKey encodes pageNo and reloadKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mayList, requestKey]);

  if (!mayList) {
    return null;
  }

  const loading = data === null || data.key !== requestKey;
  const page = data?.page;
  const records = page?.records ?? [];
  const currentPage = page?.page ?? pageNo;

  const confirmRestore = async () => {
    if (target === null) {
      return;
    }
    if (note.trim() === "") {
      setProblem("A note is required: say why the asset is restored.");
      return;
    }
    setBusy(true);
    setProblem(null);
    setResult(null);
    try {
      const restored = await restoreSoftDeleted(target.recordId, note);
      setResult({ ok: true, text: describeRestoreSuccess(target.assetUri, restored) });
      setTarget(null);
      setNote("");
    } catch (failure) {
      setResult({ ok: false, text: describeRestoreError(failure) });
    } finally {
      setBusy(false);
      // Whatever the answer was, the list may have moved on (a hard delete may have run).
      setReloadKey((current) => current + 1);
    }
  };

  return (
    <section aria-label="Restore soft-deleted assets" className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-col gap-1">
        <span className="text-heading-3 font-heading-3 text-default-font">Soft-deleted assets</span>
        <span className="text-body font-body text-subtext-color">
          A soft-deleted asset can be restored until its hard delete runs. After that it is gone.
          {mayRestore ? "" : " Your role can see this list but cannot restore; ask an administrator, director or policy manager."}
        </span>
      </div>

      {result !== null ? (
        <div
          role={result.ok ? "status" : "alert"}
          className={
            result.ok
              ? "w-full rounded-md border border-solid border-success-100 bg-success-50 px-4 py-3 text-body font-body text-success-900"
              : "w-full rounded-md border border-solid border-error-200 bg-error-50 px-4 py-3 text-body font-body text-error-800"
          }
        >
          {result.text}
        </div>
      ) : null}

      {data?.error !== undefined && !loading ? (
        <div role="alert" className="w-full rounded-md border border-solid border-error-200 bg-error-50 px-4 py-3 text-body font-body text-error-800">
          {data.error}
        </div>
      ) : null}

      {loading ? (
        <div role="status" className="w-full text-body font-body text-subtext-color">
          Loading soft-deleted assets
        </div>
      ) : null}

      {page && !loading ? (
        records.length === 0 ? (
          <span className="text-body font-body text-subtext-color">No asset is in the soft-delete window.</span>
        ) : (
          <div className="w-full overflow-x-auto rounded-md border border-solid border-neutral-border">
            <Table
              aria-label="Soft-deleted assets"
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Asset</Table.HeaderCell>
                  <Table.HeaderCell>Deleted</Table.HeaderCell>
                  <Table.HeaderCell>Window closes</Table.HeaderCell>
                  <Table.HeaderCell>State</Table.HeaderCell>
                  <Table.HeaderCell>Restore</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {records.map((record) => (
                <Table.Row key={record.recordId}>
                  <Table.Cell>
                    <span className="break-all text-body font-body text-default-font">{record.assetUri}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-body font-body text-default-font">{formatUtcMinute(record.queuedAt)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-body font-body text-default-font">
                      {record.scheduledHardDeleteAt !== null ? formatUtcMinute(record.scheduledHardDeleteAt) : MISSING}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant={STATE_VARIANT[record.state]}>{SOFT_DELETE_LABELS[record.state]}</Badge>
                      {(ruleTimingLines(record) ?? []).map((line) => (
                        <span key={line} className="whitespace-nowrap text-caption font-caption text-subtext-color">
                          {line}
                        </span>
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {RESTORABLE_STATES.includes(record.state) && mayRestore ? (
                      <Button
                        variant="brand-secondary"
                        size="small"
                        icon={<FeatherRotateCcw />}
                        aria-label={`Restore ${record.assetUri}`}
                        onClick={() => {
                          setTarget(record);
                          setNote("");
                          setProblem(null);
                          setResult(null);
                        }}
                      >
                        Restore
                      </Button>
                    ) : (
                      <span className="text-body font-body text-subtext-color">{MISSING}</span>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          </div>
        )
      ) : null}

      {page && !loading && (page.totalPages > 1 || currentPage > 0) ? (
        <div className="flex w-full items-center justify-end gap-2">
          <span className="text-body font-body text-subtext-color">
            Page {currentPage + 1} of {page.totalPages}
          </span>
          <Button variant="neutral-secondary" size="small" disabled={currentPage <= 0} onClick={() => setPageNo(Math.max(0, currentPage - 1))}>
            Previous
          </Button>
          <Button variant="neutral-secondary" size="small" disabled={currentPage + 1 >= page.totalPages} onClick={() => setPageNo(currentPage + 1)}>
            Next
          </Button>
        </div>
      ) : null}

      {target !== null ? (
        <form
          aria-label="Restore this asset"
          className="flex w-full flex-col gap-3 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <span className="break-all text-body-bold font-body-bold text-default-font">Restore {target.assetUri}</span>
          {RULE_STATES.includes(target.state) ? (
            <span role="note" className="text-body font-body text-warning-900">
              Restoring removes the lifecycle rule. Objects the rule has already expired are gone and cannot be restored.
            </span>
          ) : null}
          <TextArea label="Note (required)" helpText="Kept with the record's audit note.">
            <TextArea.Input
              aria-label="Restore note"
              placeholder="Why is this asset restored?"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={busy}
            />
          </TextArea>
          {problem !== null ? (
            <span role="alert" className="text-body font-body text-error-700">
              {problem}
            </span>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="button" variant="brand-primary" disabled={busy || note.trim() === ""} onClick={() => void confirmRestore()}>
              Confirm restore
            </Button>
            <Button type="button" variant="neutral-tertiary" disabled={busy} onClick={() => setTarget(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
