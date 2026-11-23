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

import {
  FeatherAlertTriangle,
  FeatherCheck,
  FeatherChevronLeft,
  FeatherChevronRight,
  FeatherInbox,
  FeatherList,
  FeatherRefreshCw,
  FeatherX,
} from "@subframe/core";
import React, { useEffect, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { TextArea } from "../ui/components/TextArea";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { confirmAction } from "../utils/confirm";
import { useCurrentUser } from "../utils/currentUser";
import {
  CLASS_FILTERS,
  MIN_JUSTIFICATION_LENGTH,
  MISSING,
  NO_APPROVAL_FILTERS,
  STATUS_FILTERS,
  abilityFor,
  approvalProgress,
  assetLabel,
  canApprove,
  canReadApprovals,
  classLabel,
  describeApprovalError,
  fetchApprovals,
  fetchApproval,
  fetchInbox,
  formatUtcMinute,
  requesterLabel,
  statusView,
  submitBreakGlass,
  submitDecision,
  validateComment,
  validateJustification,
  type Actor,
  type ApprovalFilters,
  type ApprovalPage,
  type ApprovalRequestView,
} from "../utils/approvalApi";
import { httpStatus } from "../utils/httpError";

/**
 * The approval inbox (APPR-02 over APPR-01, docs/specs/approvals.md, ADR-0095).
 *
 * The page shows what the policy engine delivers and decides nothing. The inbox is the server's
 * list of requests the signed-in person may still decide. Controls are shown only where the
 * server would accept them (a role, not a party to the request, not decided yet), and every
 * refusal the server still gives, such as 403 self-approval, is shown in words next to the form.
 */

/** The state of the list area: one request in flight, its page, or its failure. Never both. */
type Loaded =
  | { key: string; page: ApprovalPage; error?: undefined }
  | { key: string; page?: undefined; error: string };

type Tab = "inbox" | "all";

/** Plain select styled like the report page's selects. */
const SELECT_CLASS =
  "h-8 rounded-md border border-solid border-neutral-border bg-default-background px-2 text-body font-body text-default-font";

/** One labelled fact of the detail panel. */
function Fact(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[200px] flex-col items-start gap-1">
      <dt className="text-caption-bold font-caption-bold text-subtext-color">{props.label}</dt>
      <dd className="m-0 break-all text-body font-body text-default-font">{props.children}</dd>
    </div>
  );
}

/** The approve, reject and break-glass forms of one pending request. */
function DecisionForms(props: {
  view: ApprovalRequestView;
  canBreakGlass: boolean;
  onDone: (updated: ApprovalRequestView) => void;
  onStale: () => void;
}) {
  const { view, canBreakGlass, onDone, onStale } = props;
  const [comment, setComment] = useState("");
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const id = view.id ?? "";

  /** Runs a call, shows the server's refusal in words, and refreshes when the request moved on. */
  const run = async (call: () => Promise<ApprovalRequestView>) => {
    setBusy(true);
    setProblem(null);
    setRefusal(null);
    try {
      onDone(await call());
    } catch (error) {
      setRefusal(describeApprovalError(error));
      const status = httpStatus(error);
      if (status === 404 || status === 409) {
        onStale();
      }
    } finally {
      setBusy(false);
    }
  };

  const decide = (decision: "APPROVE" | "REJECT") => {
    const invalid = validateComment(comment);
    if (invalid !== null) {
      setProblem(invalid);
      return;
    }
    void run(() => submitDecision(id, decision, comment));
  };

  const glass = () => {
    const invalid = validateJustification(justification);
    if (invalid !== null) {
      setProblem(invalid);
      return;
    }
    const ok = confirmAction(
      "Break glass releases this request without the other approvals. It is logged at ERROR, counted and published as an alert. Continue?"
    );
    if (ok) {
      void run(() => submitBreakGlass(id, justification));
    }
  };

  const justificationLength = justification.trim().length;

  return (
    <div className="flex w-full flex-col gap-4">
      <form
        aria-label="Decide this request"
        className="flex w-full flex-col gap-3 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <TextArea label="Comment (required)" helpText="Your comment is recorded with your decision and cannot be edited.">
          <TextArea.Input
            aria-label="Comment"
            placeholder="Why do you approve or reject?"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={busy}
          />
        </TextArea>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="brand-primary"
            icon={<FeatherCheck />}
            disabled={busy || comment.trim() === ""}
            onClick={() => decide("APPROVE")}
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="destructive-secondary"
            icon={<FeatherX />}
            disabled={busy || comment.trim() === ""}
            onClick={() => decide("REJECT")}
          >
            Reject
          </Button>
        </div>
      </form>

      {canBreakGlass ? (
        <form
          aria-label="Break glass"
          className="flex w-full flex-col gap-3 rounded-md border border-solid border-error-200 bg-error-50 px-4 py-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <span className="text-body-bold font-body-bold text-error-800">Break glass (administrators only)</span>
          <span className="text-body font-body text-error-800">
            Releases this request without the other approvals. It is logged at ERROR, counted and published as an alert. Use it only for an emergency.
          </span>
          <TextArea
            label={`Justification (at least ${MIN_JUSTIFICATION_LENGTH} characters)`}
            helpText={`${justificationLength} of ${MIN_JUSTIFICATION_LENGTH} characters`}
          >
            <TextArea.Input
              aria-label="Justification"
              placeholder="Why can this not wait for the other approvers?"
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              disabled={busy}
            />
          </TextArea>
          <div>
            <Button
              type="button"
              variant="destructive-primary"
              icon={<FeatherAlertTriangle />}
              disabled={busy || justificationLength < MIN_JUSTIFICATION_LENGTH}
              onClick={glass}
            >
              Break glass
            </Button>
          </div>
        </form>
      ) : null}

      {problem !== null ? (
        <span role="alert" className="text-body font-body text-error-700">
          {problem}
        </span>
      ) : null}
      {refusal !== null ? (
        <div role="alert" className="w-full rounded-md border border-solid border-error-200 bg-error-50 px-4 py-3 text-body font-body text-error-800">
          {refusal}
        </div>
      ) : null}
    </div>
  );
}

/** One request in full: facts, decisions so far, and the controls the person may use. */
function RequestDetail(props: { id: string; actor: Actor; onChanged: () => void; onClose: () => void }) {
  const { id, actor, onChanged, onClose } = props;
  const [view, setView] = useState<ApprovalRequestView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchApproval(id)
      .then((loaded) => {
        if (!cancelled) {
          setView(loaded);
          setError(null);
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setView(null);
          setError(describeApprovalError(failure));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (error !== null) {
    return (
      <section aria-label="Request detail" className="flex w-full flex-col gap-3">
        <ErrorState message={error} onRetry={() => setReloadKey((current) => current + 1)} />
        <div>
          <Button variant="neutral-secondary" size="small" onClick={onClose}>
            Close
          </Button>
        </div>
      </section>
    );
  }
  if (view === null) {
    return (
      <div role="status" className="w-full text-body font-body text-subtext-color">
        Loading the request
      </div>
    );
  }

  const ability = abilityFor(view, actor);
  const status = statusView(view.status);
  const decisions = view.decisions ?? [];

  return (
    <section aria-label="Request detail" className="flex w-full flex-col gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
      <div className="flex w-full items-center gap-3">
        <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
          {classLabel(view.actionClass)}: {assetLabel(view)}
        </span>
        <Badge variant={status.variant}>{status.label}</Badge>
        <Button variant="neutral-tertiary" size="small" onClick={onClose}>
          Close
        </Button>
      </div>

      <dl className="m-0 flex w-full flex-wrap gap-x-8 gap-y-4">
        <Fact label="Reason">{view.reason && view.reason !== "" ? view.reason : MISSING}</Fact>
        <Fact label="Action">{view.actionType ?? MISSING}</Fact>
        <Fact label="Asked by">{requesterLabel(view)}</Fact>
        <Fact label="Origin">{view.origin ?? MISSING}</Fact>
        <Fact label="Approvals">{approvalProgress(view)}</Fact>
        <Fact label="Created">{formatUtcMinute(view.createdAt)}</Fact>
        <Fact label="Expires">{formatUtcMinute(view.expiresAt)}</Fact>
        <Fact label="Resolved">{formatUtcMinute(view.resolvedAt)}</Fact>
        <Fact label="Ready to run">{view.executable ? "Yes" : "No"}</Fact>
      </dl>

      <div className="flex w-full flex-col gap-2">
        <span className="text-body-bold font-body-bold text-default-font">Decisions</span>
        {decisions.length === 0 ? (
          <span className="text-body font-body text-subtext-color">Nobody has decided yet.</span>
        ) : (
          <ul aria-label="Decisions" className="m-0 flex list-none flex-col gap-2 p-0">
            {decisions.map((decision, index) => (
              <li
                key={decision.approverSub ?? index}
                className="flex flex-col gap-1 rounded-md border border-solid border-neutral-border px-3 py-2"
              >
                <span className="text-body-bold font-body-bold text-default-font">
                  {decision.approverName ?? decision.approverSub ?? MISSING}: {decision.decision ?? MISSING}
                  <span className="ml-2 text-caption font-caption text-subtext-color">{formatUtcMinute(decision.decidedAt)}</span>
                </span>
                <span className="whitespace-pre-wrap text-body font-body text-default-font">{decision.comment ?? MISSING}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {notice !== null ? (
        <div role="status" className="w-full rounded-md border border-solid border-success-100 bg-success-50 px-4 py-3 text-body font-body text-success-900">
          {notice}
        </div>
      ) : null}

      {ability.canDecide ? (
        <DecisionForms
          key={`${view.id}-${view.status}-${decisions.length}`}
          view={view}
          canBreakGlass={ability.canBreakGlass}
          onDone={(updated) => {
            setView(updated);
            setNotice(`Recorded. The request is now: ${statusView(updated.status).label}.`);
            onChanged();
          }}
          onStale={() => {
            setReloadKey((current) => current + 1);
            onChanged();
          }}
        />
      ) : ability.reason !== null ? (
        <div role="note" className="w-full rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-3 text-body font-body text-default-font">
          {ability.reason}
        </div>
      ) : null}
    </section>
  );
}

/** The page body; rendered only for a role that may read approvals so no request goes out for anyone else. */
function ApprovalInboxBody(props: { actor: Actor; mayDecide: boolean }) {
  const { actor, mayDecide } = props;
  const [tab, setTab] = useState<Tab>(mayDecide ? "inbox" : "all");
  const [filters, setFilters] = useState<ApprovalFilters>(NO_APPROVAL_FILTERS);
  const [pageNo, setPageNo] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const requestKey = JSON.stringify({ tab, filters, pageNo, reloadKey });

  useEffect(() => {
    let cancelled = false;
    const load = tab === "inbox" ? fetchInbox(pageNo) : fetchApprovals(filters, pageNo);
    load
      .then((page) => {
        if (!cancelled) {
          setLoaded({ key: requestKey, page });
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          // A failed request keeps no rows: the list is never shown partial.
          setLoaded({ key: requestKey, error: describeApprovalError(failure) });
        }
      });
    return () => {
      cancelled = true;
    };
    // requestKey encodes tab, filters, pageNo and reloadKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const loading = loaded === null || loaded.key !== requestKey;
  const page = loaded?.page;
  const error = loaded?.error;
  const rows = page?.content ?? [];
  const totalPages = page?.totalPages ?? 0;
  const currentPage = page?.page ?? pageNo;

  const refresh = () => setReloadKey((current) => current + 1);
  const switchTab = (next: Tab) => {
    setTab(next);
    setPageNo(0);
    setSelectedId(null);
  };
  const filtersActive = filters.status !== "" || filters.actionClass !== "";

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border px-12 py-4">
          <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">Approvals</span>
          <Button variant="neutral-tertiary" icon={<FeatherRefreshCw />} onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>

        <div className="flex w-full flex-col items-start gap-6 px-12 py-8">
          <p className="max-w-[900px] text-body font-body text-subtext-color">
            Archive and delete actions wait here until enough different people approve them. A hard delete needs two approvers. Nobody
            decides a request they asked for, submitted, or whose policy they wrote.
          </p>

          <Tabs>
            {mayDecide ? (
              <Tabs.Item active={tab === "inbox"} icon={<FeatherInbox />} onClick={() => switchTab("inbox")}>
                Inbox
              </Tabs.Item>
            ) : null}
            <Tabs.Item active={tab === "all"} icon={<FeatherList />} onClick={() => switchTab("all")}>
              All requests
            </Tabs.Item>
          </Tabs>

          {tab === "inbox" ? (
            <p className="max-w-[900px] text-body font-body text-subtext-color">
              The requests you may still decide, soonest expiry first. A request leaves your inbox when you decide it or it closes.
            </p>
          ) : (
            <form aria-label="Request filters" className="flex flex-wrap items-end gap-4" onSubmit={(event) => event.preventDefault()}>
              <label className="flex flex-col gap-1 text-caption-bold font-caption-bold text-subtext-color">
                State
                <select
                  className={SELECT_CLASS}
                  value={filters.status}
                  onChange={(event) => {
                    setFilters({ ...filters, status: event.target.value });
                    setPageNo(0);
                  }}
                >
                  <option value="">Any state</option>
                  {STATUS_FILTERS.map((status) => (
                    <option key={status} value={status}>
                      {statusView(status).label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-caption-bold font-caption-bold text-subtext-color">
                Action class
                <select
                  className={SELECT_CLASS}
                  value={filters.actionClass}
                  onChange={(event) => {
                    setFilters({ ...filters, actionClass: event.target.value });
                    setPageNo(0);
                  }}
                >
                  <option value="">Any class</option>
                  {CLASS_FILTERS.map((actionClass) => (
                    <option key={actionClass} value={actionClass}>
                      {classLabel(actionClass)}
                    </option>
                  ))}
                </select>
              </label>
            </form>
          )}

          {error !== undefined && !loading ? <ErrorState message={error} onRetry={refresh} /> : null}

          {loading ? (
            <div role="status" className="w-full text-body font-body text-subtext-color">
              Loading approval requests
            </div>
          ) : null}

          {page && !loading ? (
            <>
              {rows.length === 0 ? (
                tab === "inbox" ? (
                  <EmptyState title="Nothing waits for your decision" message="When a policy asks to archive or delete data, the request appears here." />
                ) : (
                  <EmptyState
                    title={filtersActive ? "No request matches these filters" : "No approval requests yet"}
                    message={filtersActive ? "Choose another state or class to widen the list." : "Requests appear when a policy or a service asks to archive or delete data."}
                  />
                )
              ) : (
                <div className="w-full overflow-x-auto rounded-md border border-solid border-neutral-border">
                  <Table
                    aria-label={tab === "inbox" ? "Requests waiting for you" : "All approval requests"}
                    header={
                      <Table.HeaderRow>
                        <Table.HeaderCell>Asset</Table.HeaderCell>
                        <Table.HeaderCell>Action</Table.HeaderCell>
                        <Table.HeaderCell>Asked by</Table.HeaderCell>
                        <Table.HeaderCell>Approvals</Table.HeaderCell>
                        <Table.HeaderCell>Expires</Table.HeaderCell>
                        <Table.HeaderCell>State</Table.HeaderCell>
                        <Table.HeaderCell>Review</Table.HeaderCell>
                      </Table.HeaderRow>
                    }
                  >
                    {rows.map((row, index) => {
                      const status = statusView(row.status);
                      return (
                        <Table.Row key={row.id ?? index}>
                          <Table.Cell>
                            <span className="break-all text-body font-body text-default-font">{assetLabel(row)}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-body font-body text-default-font">
                              {classLabel(row.actionClass)}
                              {row.actionType ? ` (${row.actionType})` : ""}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="break-all text-body font-body text-default-font">{requesterLabel(row)}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-body font-body text-default-font">{approvalProgress(row)}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="whitespace-nowrap text-body font-body text-default-font">{formatUtcMinute(row.expiresAt)}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </Table.Cell>
                          <Table.Cell>
                            <Button
                              variant="brand-secondary"
                              size="small"
                              aria-label={`Review request for ${assetLabel(row)}`}
                              disabled={!row.id}
                              onClick={() => setSelectedId(row.id ?? null)}
                            >
                              Review
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
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
                  onClick={() => setPageNo(Math.max(0, currentPage - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="neutral-secondary"
                  size="small"
                  iconRight={<FeatherChevronRight />}
                  disabled={currentPage + 1 >= totalPages}
                  onClick={() => setPageNo(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          ) : null}

          {selectedId !== null ? (
            <RequestDetail
              key={selectedId}
              id={selectedId}
              actor={actor}
              onChanged={refresh}
              onClose={() => setSelectedId(null)}
            />
          ) : null}
        </div>
      </div>
    </DefaultPageLayout>
  );
}

/**
 * The approvals page. A role that can neither read nor decide gets a notice and no request goes
 * out; the services answer 403 to such a role as well.
 */
export default function ApprovalInbox() {
  const user = useCurrentUser();
  if (!canReadApprovals(user.roles)) {
    return (
      <DefaultPageLayout>
        <div className="flex w-full flex-col items-start gap-6 px-12 py-8">
          <EmptyState
            title="Your role cannot read approvals"
            message="Approval requests are open to administrators, chief data officers, directors, policy managers, data engineers, data scientists and auditors."
          />
        </div>
      </DefaultPageLayout>
    );
  }
  return <ApprovalInboxBody actor={{ id: user.id, roles: user.roles }} mayDecide={canApprove(user.roles)} />;
}
