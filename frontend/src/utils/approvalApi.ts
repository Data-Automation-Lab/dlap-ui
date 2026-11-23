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

import type { ApprovalPageView, ApprovalView } from '../api/generated/policyengine';
import type { DeletionTaskListResponse, DeletionTaskStatusDTO, RestoreRequest, operations } from '../api/generated/autodelete';
import { autodeleteApi, deletionApi, policyengineApi } from './api';
import { ROUTES } from './useAppNavigate';

/**
 * Client for the approval API of da-policyengine (APPR-01, docs/specs/approvals.md, ADR-0095) and
 * for the restore of soft-deleted assets of da-autodelete (RestoreController).
 *
 * This module holds no business rules. Who may decide, how many approvals a request needs, whether
 * a request is executable and whether a restore is still possible are decided by the services.
 * What lives here is the request shape, the checks that spare a round trip (a comment is not
 * blank, a justification has 20 characters), the wording of the server's refusals, and the role
 * lists that decide what the interface offers. The services enforce every one of them again and
 * answer 403 or 409 to anyone the page should not have offered the action to.
 */

/** Route of the approval inbox page: the entry of the shared route table (useAppNavigate.ts), kept under this name for its callers. */
export const APPROVALS_ROUTE = ROUTES.approvals;

/** Realm roles that may be asked to decide (spec section 5); the server narrows this with approver-roles. */
export const APPROVER_ROLES: readonly string[] = ['ROLE_ADMIN', 'ROLE_CDO', 'ROLE_DIRECTOR', 'ROLE_POLICY_MANAGER'];

/** Realm roles that may read requests: the approvers and the three read-only roles of spec section 5. */
export const APPROVAL_READ_ROLES: readonly string[] = [
  ...APPROVER_ROLES,
  'ROLE_DATA_ENGINEER',
  'ROLE_DATA_SCIENTIST',
  'ROLE_AUDITOR',
];

/** The only role that may break glass. */
export const BREAK_GLASS_ROLE = 'ROLE_ADMIN';

/** A machine principal never decides, even when its token also carries a human role (spec section 5). */
export const MACHINE_ROLE = 'ROLE_SERVICE_ACCOUNT';

/** Shortest break-glass justification (spec section 2, rule 9). The server may be configured for more. */
export const MIN_JUSTIFICATION_LENGTH = 20;

/** Longest comment the server can be configured to accept (max-comment-length ceiling, spec section 12). */
export const MAX_COMMENT_LENGTH = 10000;

/** Roles of RestoreController.restore (da-autodelete). */
export const RESTORE_ROLES: readonly string[] = ['ROLE_ADMIN', 'ROLE_POLICY_MANAGER', 'ROLE_DIRECTOR'];

/**
 * Roles of DeletionTaskController.listDeletionTasks that a person can hold (the machine role is left out).
 * Everyone who can restore can also find what to restore (Q-624): the list allows the three restore roles.
 */
export const SOFT_DELETE_LIST_ROLES: readonly string[] = [
  'ROLE_ADMIN',
  'ROLE_CDO',
  'ROLE_DATA_ENGINEER',
  'ROLE_POLICY_MANAGER',
  'ROLE_DIRECTOR',
];

const hasAny = (roles: readonly string[], wanted: readonly string[]): boolean => roles.some((role) => wanted.includes(role));

/** Whether the roles may be asked to approve or reject: an approver role and no machine role. */
export function canApprove(roles: readonly string[]): boolean {
  return !roles.includes(MACHINE_ROLE) && hasAny(roles, APPROVER_ROLES);
}

/** Whether the roles may open the approvals page at all (read or decide), for a person. */
export function canReadApprovals(roles: readonly string[]): boolean {
  return !roles.includes(MACHINE_ROLE) && hasAny(roles, APPROVAL_READ_ROLES);
}

/** Whether the roles may break glass: ADMIN, and no machine role. */
export function canBreakGlassRole(roles: readonly string[]): boolean {
  return !roles.includes(MACHINE_ROLE) && roles.includes(BREAK_GLASS_ROLE);
}

/** Whether the roles may restore a soft-deleted asset. */
export function canRestore(roles: readonly string[]): boolean {
  return !roles.includes(MACHINE_ROLE) && hasAny(roles, RESTORE_ROLES);
}

/** Whether the roles may list soft-delete records (the restore list). */
export function canListSoftDeletes(roles: readonly string[]): boolean {
  return !roles.includes(MACHINE_ROLE) && hasAny(roles, SOFT_DELETE_LIST_ROLES);
}

// ---------------------------------------------------------------------------------------------
// Views and wording
// ---------------------------------------------------------------------------------------------

/** One approval request as the service delivers it. */
export type ApprovalRequestView = ApprovalView;

/** One page of requests. */
export type ApprovalPage = ApprovalPageView;

/** Badge colours of the design system. */
export type BadgeVariant = 'brand' | 'neutral' | 'error' | 'warning' | 'success';

/** The request states of spec section 4, as the filter offers them. */
export const STATUS_FILTERS: readonly string[] = ['PENDING', 'APPROVED', 'APPROVED_BREAK_GLASS', 'REJECTED', 'EXPIRED'];

/** The action classes of spec section 3, as the filter offers them. */
export const CLASS_FILTERS: readonly string[] = ['ARCHIVE', 'SOFT_DELETE', 'HARD_DELETE', 'OTHER'];

/** The text shown for a missing value; a dash, never a zero. */
export const MISSING = '-';

const STATUS_VIEWS: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Waiting for decisions', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  APPROVED_BREAK_GLASS: { label: 'Released by break-glass', variant: 'error' },
  REJECTED: { label: 'Rejected', variant: 'neutral' },
  EXPIRED: { label: 'Expired', variant: 'neutral' },
  // Withdrawn by the executor's service account when the record it asked for was restored (ADR-0108, Q-696).
  WITHDRAWN: { label: 'Withdrawn', variant: 'neutral' },
};

/** The label and badge colour of a request state; an unknown state is shown as sent. */
export function statusView(status: string | undefined): { label: string; variant: BadgeVariant } {
  if (status === undefined || status === '') {
    return { label: MISSING, variant: 'neutral' };
  }
  return STATUS_VIEWS[status] ?? { label: status, variant: 'neutral' };
}

const CLASS_LABELS: Record<string, string> = {
  ARCHIVE: 'Archive',
  SOFT_DELETE: 'Soft delete',
  HARD_DELETE: 'Hard delete',
  OTHER: 'Other action',
};

/** The label of an action class; an unknown class is shown as sent. */
export function classLabel(actionClass: string | undefined): string {
  if (actionClass === undefined || actionClass === '') {
    return MISSING;
  }
  return CLASS_LABELS[actionClass] ?? actionClass;
}

/** "1 of 2": approvals so far against the quorum. Missing numbers show a dash. */
export function approvalProgress(view: ApprovalRequestView): string {
  const have = view.approvals;
  const need = view.requiredApprovals;
  if (typeof have !== 'number' || typeof need !== 'number') {
    return MISSING;
  }
  return `${have} of ${need}`;
}

/** Who asked, in words: a policy by its name, anyone else as the service recorded them. */
export function requesterLabel(view: ApprovalRequestView): string {
  if (view.requesterKind === 'POLICY') {
    const policy = view.policyName ?? view.policyId ?? view.requestedBy;
    return policy ? `Policy ${policy}` : 'A policy';
  }
  return view.requestedBy && view.requestedBy !== '' ? view.requestedBy : MISSING;
}

/** The asset a request is about, for a table cell. */
export function assetLabel(view: ApprovalRequestView): string {
  return view.assetUri && view.assetUri !== '' ? view.assetUri : (view.assetId ?? MISSING);
}

/** A timestamp as an UTC date and minute, or a dash. */
export function formatUtcMinute(value: string | null | undefined): string {
  if (!value) {
    return MISSING;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? MISSING : `${parsed.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

// ---------------------------------------------------------------------------------------------
// What the page offers a person (a hint; the server decides)
// ---------------------------------------------------------------------------------------------

/** The signed-in person, as read from the token. */
export interface Actor {
  /** The JWT sub; empty when the token carries none. */
  id: string;
  roles: readonly string[];
}

/** What the page offers for one request. */
export interface Ability {
  /** Show the approve and reject controls. */
  canDecide: boolean;
  /** Show the break-glass controls. */
  canBreakGlass: boolean;
  /** Why the controls are hidden, for a pending request; null when they are shown or the request is closed. */
  reason: string | null;
}

/**
 * Works out which controls to show for a request. The rules are the server's (spec section 5):
 * a role, not a party to the request, not a machine, not yet decided. The page hides what the
 * server would refuse so nobody clicks into a 403, but the server still answers 403 if a hidden
 * control is reached another way.
 *
 * @param view the request, with its decisions when it was read by id
 * @param actor the signed-in person
 */
export function abilityFor(view: ApprovalRequestView, actor: Actor): Ability {
  const none = (reason: string | null): Ability => ({ canDecide: false, canBreakGlass: false, reason });
  if (view.status !== 'PENDING') {
    return none(null);
  }
  if (!canApprove(actor.roles)) {
    return none('Your role cannot decide approval requests.');
  }
  if (actor.id === '') {
    return none('Your sign-in carries no subject, so a decision cannot be attributed to you.');
  }
  const parties = new Set<string>([...(view.excludedSubjects ?? [])]);
  if (view.requestedBy) {
    parties.add(view.requestedBy);
  }
  if (view.submittedBy) {
    parties.add(view.submittedBy);
  }
  if (parties.has(actor.id)) {
    return none('You cannot decide this request: you asked for it, submitted it, or wrote its policy. Another approver must decide it.');
  }
  if ((view.decisions ?? []).some((decision) => decision.approverSub === actor.id)) {
    return none('You have already decided this request.');
  }
  return { canDecide: true, canBreakGlass: canBreakGlassRole(actor.roles), reason: null };
}

/** The first problem with a decision comment, or null. */
export function validateComment(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return 'A comment is required.';
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return `A comment may have at most ${MAX_COMMENT_LENGTH} characters.`;
  }
  return null;
}

/** The first problem with a break-glass justification, or null. */
export function validateJustification(text: string): string | null {
  const length = text.trim().length;
  if (length < MIN_JUSTIFICATION_LENGTH) {
    return `A break-glass justification needs at least ${MIN_JUSTIFICATION_LENGTH} characters (${length} so far).`;
  }
  if (length > MAX_COMMENT_LENGTH) {
    return `A justification may have at most ${MAX_COMMENT_LENGTH} characters.`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

/** The service answered 2xx with a body that is not the approval contract. */
export class ApprovalShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalShapeError';
  }
}

interface ErrorBody {
  response?: { status?: unknown; data?: { message?: unknown; reason?: unknown } | null };
}

const asErrorBody = (error: unknown): ErrorBody => (typeof error === 'object' && error !== null ? (error as ErrorBody) : {});

const REASON_TEXT: Record<string, string> = {
  'self-approval':
    'Refused: you cannot decide a request you asked for, submitted, or whose policy you wrote. Another approver must decide it.',
  'not-an-approver': 'Refused: your role is not an approver role for this deployment.',
  'mfa-required': 'Refused: your sign-in did not pass multi-factor authentication. Sign out, sign in again with your second factor, and retry.',
  'no-subject': 'Refused: your token carries no subject, so the decision cannot be attributed to you.',
  'break-glass-disabled': 'Refused: break-glass is switched off in this deployment.',
  'on-behalf-refused': 'Refused: only a service account may act on behalf of another person.',
  invalid: 'The request was not valid.',
  'not-found': 'This request no longer exists.',
  'not-pending': 'This request was already decided or closed, so it can no longer be changed.',
  expired: 'This request expired before the decision arrived. It can no longer be approved.',
  'already-decided': 'You have already decided this request.',
};

/**
 * The sentence to show for a failed approval call. A known machine reason gets a plain
 * explanation, then the server's own message in brackets when it adds something.
 */
export function describeApprovalError(error: unknown): string {
  if (error instanceof ApprovalShapeError) {
    return error.message;
  }
  const { response } = asErrorBody(error);
  if (response === undefined) {
    return 'The policy engine could not be reached. Check your connection and try again.';
  }
  const status = typeof response.status === 'number' ? response.status : undefined;
  const reason = typeof response.data?.reason === 'string' ? response.data.reason : undefined;
  const message = typeof response.data?.message === 'string' && response.data.message !== '' ? response.data.message : undefined;
  const known = reason !== undefined ? REASON_TEXT[reason] : undefined;
  if (known !== undefined) {
    return message !== undefined && !known.includes(message) ? `${known} (${message})` : known;
  }
  if (status === 403) {
    return message !== undefined ? `Refused: ${message}` : 'Refused: your role may not do this.';
  }
  if (status === 409) {
    return message !== undefined ? `Conflict: ${message}` : 'Conflict: the request is no longer in a state that allows this.';
  }
  if (status === 404) {
    return REASON_TEXT['not-found'];
  }
  if (status === 400) {
    return message !== undefined ? `Not accepted: ${message}` : REASON_TEXT.invalid;
  }
  return message !== undefined ? message : `The policy engine answered an error${status !== undefined ? ` (HTTP ${status})` : ''}.`;
}

// ---------------------------------------------------------------------------------------------
// Requests to the approval API
// ---------------------------------------------------------------------------------------------

const APPROVALS_PATH = '/approvals';

/** What the "all requests" list can be narrowed by. Empty values mean no filter. */
export interface ApprovalFilters {
  status: string;
  actionClass: string;
}

/** The filters of a fresh list: none. */
export const NO_APPROVAL_FILTERS: ApprovalFilters = { status: '', actionClass: '' };

/** Rows per page of the request lists; the service allows 1 to 200. */
export const APPROVAL_PAGE_SIZE = 25;

function checkPage(body: unknown): ApprovalPage {
  const page = body as ApprovalPage | null | undefined;
  if (typeof page !== 'object' || page === null || !Array.isArray(page.content)) {
    throw new ApprovalShapeError('The policy engine answered, but not with a page of approval requests.');
  }
  return page;
}

function checkView(body: unknown): ApprovalRequestView {
  const view = body as ApprovalRequestView | null | undefined;
  if (typeof view !== 'object' || view === null || typeof view.id !== 'string' || typeof view.status !== 'string') {
    throw new ApprovalShapeError('The policy engine answered, but not with an approval request.');
  }
  return view;
}

/** The requests the caller may still decide (GET /approvals/inbox), soonest expiry first. */
export async function fetchInbox(page = 0, size = APPROVAL_PAGE_SIZE): Promise<ApprovalPage> {
  const response = await policyengineApi.get<ApprovalPage>(`${APPROVALS_PATH}/inbox`, { params: { page, size } });
  return checkPage(response.data);
}

/** Requests newest first, narrowed by state and class (GET /approvals). Rows carry no decisions. */
export async function fetchApprovals(filters: ApprovalFilters, page = 0, size = APPROVAL_PAGE_SIZE): Promise<ApprovalPage> {
  const params: Record<string, string | number> = { page, size };
  if (filters.status !== '') {
    params.status = filters.status;
  }
  if (filters.actionClass !== '') {
    params.actionClass = filters.actionClass;
  }
  const response = await policyengineApi.get<ApprovalPage>(APPROVALS_PATH, { params });
  return checkPage(response.data);
}

/** One request with its decisions (GET /approvals/{id}). */
export async function fetchApproval(id: string): Promise<ApprovalRequestView> {
  const response = await policyengineApi.get<ApprovalRequestView>(`${APPROVALS_PATH}/${encodeURIComponent(id)}`);
  return checkView(response.data);
}

/** How many requests of the given classes are pending, for the notices on the agent pages. */
export async function countPending(actionClasses: readonly string[]): Promise<number> {
  const pages = await Promise.all(actionClasses.map((actionClass) => fetchApprovals({ status: 'PENDING', actionClass }, 0, 1)));
  return pages.reduce((sum, page) => sum + (typeof page.totalElements === 'number' ? page.totalElements : 0), 0);
}

/**
 * Approves or rejects a request (POST /approvals/{id}/decisions). The comment is sent trimmed;
 * the server refuses a blank one as well.
 *
 * @throws the transport error on 400, 403, 404 or 409; see {@link describeApprovalError}
 */
export async function submitDecision(id: string, decision: 'APPROVE' | 'REJECT', comment: string): Promise<ApprovalRequestView> {
  const response = await policyengineApi.post<ApprovalRequestView>(`${APPROVALS_PATH}/${encodeURIComponent(id)}/decisions`, {
    decision,
    comment: comment.trim(),
  });
  return checkView(response.data);
}

/**
 * Releases a request without the quorum (POST /approvals/{id}/break-glass). ADMIN only; the
 * server logs it at ERROR, counts it and publishes it on dlap.approvals.break-glass.
 *
 * @throws the transport error on 400, 403, 404 or 409; see {@link describeApprovalError}
 */
export async function submitBreakGlass(id: string, justification: string): Promise<ApprovalRequestView> {
  const response = await policyengineApi.post<ApprovalRequestView>(`${APPROVALS_PATH}/${encodeURIComponent(id)}/break-glass`, {
    justification: justification.trim(),
  });
  return checkView(response.data);
}

// ---------------------------------------------------------------------------------------------
// Restore of soft-deleted assets (da-autodelete)
// ---------------------------------------------------------------------------------------------

/**
 * The restore answer as the generated contract has it (autodelete.json, operation restore): an open map, because
 * RestoreController builds the answer by hand. The keys read below are the ones the controller puts in it.
 */
type RestoreAnswer = operations['restore']['responses'][200]['content']['*/*'];

/**
 * Where a soft-delete record stands, mapped from the status the task list uses. The service decides the
 * status; this page only words it (Q-696).
 */
export type SoftDeleteState =
  | 'SOFT_DELETED'
  | 'DRY_RUN'
  | 'RULE_IN_FORCE'
  | 'RULE_AWAITING_PROOF'
  | 'AWAITING_PROOF'
  | 'RULE_ENDED'
  | 'RULE_ENDED_UNPROVEN'
  | 'RESTORE_FAILED'
  | 'HARD_DELETED'
  | 'HARD_DELETE_FAILED'
  | 'HARD_DELETE_REFUSED'
  | 'RESTORED'
  | 'UNKNOWN';

/** One asset in the soft-delete lifecycle. */
export interface SoftDeleteRecord {
  /** The soft-delete record id, which the restore call takes. */
  recordId: string;
  assetUri: string;
  policyId: string | null;
  queuedAt: string | null;
  /** When the soft-delete window closes and the hard delete is due (ISO instant); null when the record has no window. */
  scheduledHardDeleteAt: string | null;
  /** When the container rule was applied; delivered for a rule in force and an applied rule waiting for proof. */
  ruleAppliedAt: string | null;
  /** Whole days since the rule was applied; null when the service does not deliver it. */
  ruleAgeDays: number | null;
  /** When the executor removes the rule at its maximum age; null when the service does not deliver it. */
  ruleEndsAt: string | null;
  state: SoftDeleteState;
  note: string | null;
  lastError: string | null;
}

/** One page of soft-delete records. */
export interface SoftDeletePage {
  records: SoftDeleteRecord[];
  page: number;
  totalPages: number;
  totalElements: number;
}

/**
 * What the task list calls each soft-delete state (DeletionTaskServiceImpl.mapSoftDeleteStatus). IN_PROGRESS
 * (a record waiting for the proof of an applied delete) is mapped in softDeleteStateOf, because only the fields
 * of the row tell a rule from an engine delete.
 */
const SOFT_DELETE_STATES: Record<string, SoftDeleteState> = {
  QUEUED: 'SOFT_DELETED',
  // A dry run recorded what would be deleted and touched nothing (Q-636): never shown as deleted.
  DRY_RUN: 'DRY_RUN',
  // A lifecycle rule on a bucket or container that is proven to fire; the bucket itself stays (Q-631).
  RULE_IN_FORCE: 'RULE_IN_FORCE',
  // The rule reached its maximum age and the executor removed it (RET-06), proven or not (RET-08).
  RULE_ENDED: 'RULE_ENDED',
  RULE_ENDED_UNPROVEN: 'RULE_ENDED_UNPROVEN',
  // A restore could not find DLAP's rule to remove (RET-06, Q-682).
  RESTORE_FAILED: 'RESTORE_FAILED',
  COMPLETED: 'HARD_DELETED',
  FAILED: 'HARD_DELETE_FAILED',
  // The hard delete was refused; the record is still restorable (SoftDeleteRecordEntity.RESTORABLE).
  REJECTED: 'HARD_DELETE_REFUSED',
  CANCELLED: 'RESTORED',
};

/**
 * The state of one task-list row. A row IN_PROGRESS carries ruleAppliedAt when its delete is an applied container
 * rule, which a restore removes (Q-696); without it the row is an engine delete or a table expiration that the
 * restore cannot take back.
 */
function softDeleteStateOf(status: string, ruleAppliedAt: string | null): SoftDeleteState {
  if (status === 'IN_PROGRESS') {
    return ruleAppliedAt !== null ? 'RULE_AWAITING_PROOF' : 'AWAITING_PROOF';
  }
  return SOFT_DELETE_STATES[status] ?? 'UNKNOWN';
}

/** The label of a soft-delete state. */
export const SOFT_DELETE_LABELS: Record<SoftDeleteState, string> = {
  SOFT_DELETED: 'Soft-deleted, can be restored',
  DRY_RUN: 'Dry run, nothing deleted',
  RULE_IN_FORCE: 'Lifecycle rule in force',
  RULE_AWAITING_PROOF: 'Lifecycle rule applied, waiting for proof',
  AWAITING_PROOF: 'Delete applied, waiting for proof',
  RULE_ENDED: 'Lifecycle rule ended',
  RULE_ENDED_UNPROVEN: 'Lifecycle rule ended, never proven',
  RESTORE_FAILED: 'Restore failed, rule not found',
  HARD_DELETED: 'Hard-deleted',
  HARD_DELETE_FAILED: 'Hard delete failed',
  HARD_DELETE_REFUSED: 'Hard delete refused, can be restored',
  RESTORED: 'Restored',
  UNKNOWN: 'Unknown',
};

const textOrNull = (value: string | null | undefined): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** Records per page of the restore list. */
export const SOFT_DELETE_PAGE_SIZE = 10;

/**
 * The states in which the service accepts a restore: nothing was deleted, the hard delete was refused, or a
 * container rule is in force or applied and waiting for its proof (Q-631, Q-696). The service still decides.
 */
export const RESTORABLE_STATES: readonly SoftDeleteState[] = [
  'SOFT_DELETED',
  'DRY_RUN',
  'RULE_IN_FORCE',
  'RULE_AWAITING_PROOF',
  'HARD_DELETE_REFUSED',
];

/** The states that hold a lifecycle rule on the platform, which a restore removes. */
export const RULE_STATES: readonly SoftDeleteState[] = ['RULE_IN_FORCE', 'RULE_AWAITING_PROOF'];

/**
 * Short lines for a record whose rule is on the platform: when the rule was applied and how old it is, and when
 * the executor removes it. The values are the service's; a missing one is left out. Null when the row carries
 * neither.
 */
export function ruleTimingLines(record: Pick<SoftDeleteRecord, 'ruleAppliedAt' | 'ruleAgeDays' | 'ruleEndsAt'>): string[] | null {
  const lines: string[] = [];
  if (record.ruleAppliedAt !== null) {
    const age = record.ruleAgeDays === null ? '' : `, ${record.ruleAgeDays} ${record.ruleAgeDays === 1 ? 'day' : 'days'} ago`;
    lines.push(`Rule applied ${formatUtcMinute(record.ruleAppliedAt)}${age}`);
  }
  if (record.ruleEndsAt !== null) {
    lines.push(`Rule ends ${formatUtcMinute(record.ruleEndsAt)}`);
  }
  return lines.length === 0 ? null : lines;
}

/**
 * Lists soft-delete records, newest first (GET /api/v1/deletion/tasks). The service lists the
 * records of the soft-delete window; only a record that nothing deleted yet (SOFT_DELETED, DRY_RUN) or
 * whose lifecycle rule is in force (RULE_IN_FORCE) can be restored.
 *
 * @throws ApprovalShapeError when the body is not a task list
 */
export async function fetchSoftDeletes(page = 0, size = SOFT_DELETE_PAGE_SIZE): Promise<SoftDeletePage> {
  const response = await deletionApi.get<DeletionTaskListResponse | null>('/tasks', { params: { page, size } });
  const body = response.data;
  if (typeof body !== 'object' || body === null || !Array.isArray(body.tasks)) {
    throw new ApprovalShapeError('The deletion service answered, but not with a list of soft-delete records.');
  }
  const records: SoftDeleteRecord[] = [];
  for (const task of body.tasks as Array<DeletionTaskStatusDTO | null>) {
    // A null entry or one without an id cannot be restored; the type says the id is optional.
    const recordId = task === null ? null : textOrNull(task.taskId);
    if (task === null || recordId === null) {
      continue;
    }
    const ruleAppliedAt = textOrNull(task.ruleAppliedAt);
    records.push({
      recordId,
      assetUri: textOrNull(task.taskName) ?? MISSING,
      policyId: textOrNull(task.triggeredBy),
      queuedAt: textOrNull(task.submittedAt),
      scheduledHardDeleteAt: textOrNull(task.scheduledHardDeleteAt),
      ruleAppliedAt,
      ruleAgeDays: typeof task.ruleAgeDays === 'number' && Number.isFinite(task.ruleAgeDays) ? task.ruleAgeDays : null,
      ruleEndsAt: textOrNull(task.ruleEndsAt),
      state: softDeleteStateOf(String(task.status), ruleAppliedAt),
      note: textOrNull(task.justification),
      lastError: Array.isArray(task.errorMessages) && typeof task.errorMessages[0] === 'string' ? task.errorMessages[0] : null,
    });
  }
  return {
    records,
    page: typeof body.pageNumber === 'number' ? body.pageNumber : page,
    totalPages: typeof body.totalPages === 'number' ? body.totalPages : 0,
    totalElements: typeof body.totalElements === 'number' ? body.totalElements : records.length,
  };
}

/** What the service says about a restore that happened. */
export interface RestoreResult {
  /** True when the restore removed a lifecycle rule (the record was RULE_IN_FORCE). */
  ruleRemoved: boolean;
  /** What became of the pending hard-delete approval, for example WITHDRAWN or REFUSED:self-approval. */
  approvalWithdrawal: string | null;
  /** The service's sentence, set when a rule was removed: objects it already expired are gone. */
  message: string | null;
}

/**
 * Restores a soft-deleted asset (POST /api/v1/autodelete/restores/{id}). Only the note is sent:
 * the service records the acting user itself, and a user id in the body would let a caller name
 * someone else. A record whose lifecycle rule is in force is restored by removing the rule.
 *
 * @throws the transport error: 403 for a role that may not restore, 409 when the record is not
 *         restorable any more; see {@link describeRestoreError}
 */
export async function restoreSoftDeleted(recordId: string, notes: string): Promise<RestoreResult> {
  const request: RestoreRequest = { notes: notes.trim() };
  const response = await autodeleteApi.post<RestoreAnswer | null>(`/restores/${encodeURIComponent(recordId)}`, request);
  const body: Record<string, unknown> = response?.data ?? {};
  return {
    ruleRemoved: body.ruleRemoved === true,
    approvalWithdrawal: textOrNull(typeof body.approvalWithdrawal === 'string' ? body.approvalWithdrawal : null),
    message: textOrNull(typeof body.message === 'string' ? body.message : null),
  };
}

/**
 * A plain sentence for what became of the pending hard-delete approval (RestoreController answers it as
 * approvalWithdrawal: WITHDRAWN, APPROVAL_ALREADY_DECIDED:status, ENDPOINT_NOT_AVAILABLE:http-N, REQUEST_NOT_FOUND,
 * REFUSED:reason, UNREACHABLE:detail, NOT_ATTEMPTED). Null when nothing was attempted, so the success text stays
 * short. A value this page does not know is shown as sent.
 */
export function describeApprovalWithdrawal(outcome: string | null): string | null {
  if (outcome === null || outcome === '') {
    return null;
  }
  const colon = outcome.indexOf(':');
  const code = colon < 0 ? outcome : outcome.slice(0, colon);
  const detail = colon < 0 ? '' : outcome.slice(colon + 1);
  const neverRuns = 'A restored record is never deleted.';
  switch (code) {
    case 'NOT_ATTEMPTED':
      return null;
    case 'WITHDRAWN':
      return 'The pending hard-delete approval was withdrawn.';
    case 'APPROVAL_ALREADY_DECIDED':
      return `The pending hard-delete approval had already been decided${detail !== '' && detail !== 'unknown' ? ` (${detail})` : ''}, so it was not withdrawn. ${neverRuns}`;
    case 'ENDPOINT_NOT_AVAILABLE':
      return `The policy engine cannot withdraw approvals, so the hard-delete request stays until it is decided or expires. ${neverRuns}`;
    case 'REQUEST_NOT_FOUND':
      return 'The policy engine does not know the hard-delete request, so nothing waits on it.';
    case 'REFUSED':
      return `The policy engine refused to withdraw the hard-delete approval${detail !== '' ? ` (${detail})` : ''}. The restore stands. ${neverRuns}`;
    case 'UNREACHABLE':
      return `The policy engine could not be reached to withdraw the hard-delete approval. The restore stands. ${neverRuns}`;
    default:
      return `Approval withdrawal: ${outcome}.`;
  }
}

/** The sentence to show after a restore: a removed rule says that objects it already expired are gone. */
export function describeRestoreSuccess(assetUri: string, result: RestoreResult): string {
  const base = `Restored ${assetUri}.`;
  const rule = result.ruleRemoved
    ? ' The lifecycle rule was removed. Objects it already expired are gone and are not restored.'
    : '';
  const withdrawal = describeApprovalWithdrawal(result.approvalWithdrawal);
  return `${base}${rule}${withdrawal === null ? '' : ` ${withdrawal}`}`;
}

/** What a record in each state needs said when a restore is refused because of it. */
const NOT_RESTORABLE_BY_STATE: Record<string, string> = {
  HARD_DELETED: 'the asset was already hard-deleted and cannot be taken back.',
  HARD_DELETE_FAILED: 'the hard delete was attempted and failed, and what it deleted cannot be taken back.',
  AWAITING_PROOF: 'the delete was applied and is waiting for its proof, so it cannot be taken back.',
  RULE_ENDED: 'the lifecycle rule already ended, so there is no rule left to remove.',
  RULE_ENDED_UNPROVEN: 'the lifecycle rule already ended without proof that it fired, so there is no rule left to remove.',
  RESTORE_FAILED: "an earlier restore could not find DLAP's rule. Check the lifecycle configuration of the bucket.",
  RESTORED: 'the record was already restored.',
};

/** A machine reason of the restore answer, split from the server sentence behind it. */
function splitRestoreReason(reason: string): { code: string; detail: string | null } {
  const match = /^(record-is-[A-Z_]+|[a-z][a-z0-9-]*)(?::\s*([\s\S]*))?$/.exec(reason);
  if (match === null) {
    return { code: '', detail: reason };
  }
  return { code: match[1], detail: match[2] !== undefined && match[2] !== '' ? match[2] : null };
}

/**
 * The plain sentence for a machine reason of a refused restore (RestoreController 409: record-not-found,
 * record-is-STATE, rule-removal-failed, rule-not-found); null for a reason this page does not know.
 */
export function describeRestoreReason(code: string): string | null {
  if (code === 'record-not-found') {
    return 'this soft-delete record does not exist.';
  }
  if (code.startsWith('record-is-')) {
    const state = code.slice('record-is-'.length);
    return NOT_RESTORABLE_BY_STATE[state] ?? `the record is ${state}, which cannot be restored.`;
  }
  if (code === 'rule-removal-failed') {
    return 'the lifecycle rule could not be removed, so nothing changed and objects keep expiring. Try again later.';
  }
  if (code === 'rule-not-found') {
    return "DLAP's lifecycle rule was not found on the platform, so nothing was removed and the record is marked as restore failed. Check the bucket's lifecycle configuration.";
  }
  return null;
}

/**
 * The sentence to show for a failed restore. A 409 carries "<reason>: <server sentence>"; a reason this page
 * knows becomes a plain sentence with the server's sentence kept in brackets as detail, and any other reason is
 * shown as sent.
 */
export function describeRestoreError(error: unknown): string {
  const { response } = asErrorBody(error);
  if (response === undefined) {
    return 'The deletion service could not be reached. Check your connection and try again.';
  }
  const status = typeof response.status === 'number' ? response.status : undefined;
  if (status === 403) {
    return 'Refused: your role may not restore deleted assets (ADMIN, POLICY_MANAGER or DIRECTOR may).';
  }
  if (status === 409) {
    const reason = (response.data as { reason?: unknown } | null | undefined)?.reason;
    if (typeof reason !== 'string' || reason === '') {
      return 'Not restorable: the asset is no longer in its soft-delete window.';
    }
    const { code, detail } = splitRestoreReason(reason);
    const plain = describeRestoreReason(code);
    if (plain === null) {
      return `Not restorable: ${reason}`;
    }
    const sentence = plain.charAt(0).toUpperCase() + plain.slice(1);
    return detail === null ? `Not restorable: ${sentence}` : `Not restorable: ${sentence} (${detail})`;
  }
  if (status === 404) {
    return 'This soft-delete record no longer exists.';
  }
  return `The deletion service answered an error${status !== undefined ? ` (HTTP ${status})` : ''}.`;
}
