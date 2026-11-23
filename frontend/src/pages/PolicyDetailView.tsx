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
    FeatherArrowLeft,
    FeatherCheck,
    FeatherClock,
    FeatherCode,
    FeatherEdit2,
    FeatherEye,
    FeatherFilter,
    FeatherPower,
    FeatherPowerOff,
    FeatherSave,
    FeatherX
} from "@subframe/core";
import { useEffect, useState } from "react";
import { Badge } from "../ui/components/Badge";
import { Breadcrumbs } from "../ui/components/Breadcrumbs";
import { Button } from "../ui/components/Button";
import { IconButton } from "../ui/components/IconButton";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { setPolicyStatus } from "../utils/apiServices";
import { policyengineApi } from "../utils/api";
import { serverMessage } from '../utils/httpError';

/**
 * Full policy detail as returned by GET /api/v1/policyengine/policies/{id}
 * (PolicyOutputDTO). Optional fields are present only when the backend
 * populates them.
 */
interface IPolicyDetail {
  id: string;
  name?: string;
  description?: string;
  status?: string; // ENABLED | DISABLED | DRAFT — may be absent on legacy records
  conditionLogic?: string;
  rules?: Array<Record<string, unknown>>;
  actions?: Record<string, unknown>;
  policyDocument?: string; // ADR-0031: canonical dlap/v1 DSL
  // C2b: 'Policy' (lifecycle) | 'AccessPolicy' — may be absent; when absent we
  // detect AccessPolicy from the policyDocument text (see isAccessPolicyDoc).
  kind?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
}

const readSelectedPolicyId = (): string | null => {
  try {
    return sessionStorage.getItem('selectedPolicyId');
  } catch {
    return null;
  }
};

// C2b-access-PolicyDetailView: this view fetches the published policy
// (PolicyOutputDTO). The record carries no explicit `kind` field, so we detect
// AccessPolicy pragmatically from the dlap/v1 `policyDocument` text — a
// kind:AccessPolicy YAML round-trips through the raw editor unchanged, so the
// substring is a reliable signal. When detected we render a structured Access
// Model instead of only the raw rules table.
const isAccessPolicyDoc = (policy: IPolicyDetail | null): boolean => {
  const kind = policy?.kind;
  if (typeof kind === 'string' && kind.toLowerCase() === 'accesspolicy') return true;
  const doc = policy?.policyDocument ?? '';
  return /kind:\s*AccessPolicy/.test(doc);
};

/**
 * Minimal, dependency-free reader for the AccessPolicy spec. We avoid adding a
 * YAML parser (no new deps): the wizard-authored document is well-formed and
 * predictable, so scan its lines for the fields we render. Anything we can't
 * confidently extract falls back to the raw document shown below.
 */
interface IAccessModel {
  tiers: string[];
  roles: string[];
  actions: string[];
  matchLabels: string[];
  purpose: string[];
  region: string[];
  consent?: string;
  effect?: string;
  obligations: Array<{ type: string; labels: string[] }>;
}

// Collect the inline-list values on a line like `  anyOf: [PII, PHI]` or the
// following bullet lines under a key. Returns a flat, trimmed string list.
const parseInlineList = (raw: string): string[] =>
  raw
    .replace(/^\s*[^:]*:\s*/, '')
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter((s) => s.length > 0);

const extractAccessModel = (doc: string): IAccessModel => {
  const model: IAccessModel = {
    tiers: [],
    roles: [],
    actions: [],
    matchLabels: [],
    purpose: [],
    region: [],
    obligations: [],
  };
  if (!doc) return model;
  const lines = doc.split(/\r?\n/);

  const grabList = (label: string): string[] => {
    for (const line of lines) {
      const re = new RegExp(`^\\s*${label}:\\s*(.+)$`);
      const m = line.match(re);
      if (m && m[1].trim().length > 0) return parseInlineList(line);
    }
    return [];
  };

  model.tiers = grabList('tiers');
  model.roles = grabList('roles');
  model.actions = grabList('actions');
  model.purpose = grabList('purpose');
  model.region = grabList('region');
  // spec.match label conditions (anyOf/noneOf/allOf under labels).
  model.matchLabels = [
    ...grabList('anyOf'),
    ...grabList('noneOf'),
    ...grabList('allOf'),
  ];

  for (const line of lines) {
    const consent = line.match(/^\s*consent:\s*(true|false)\s*$/);
    if (consent) model.consent = consent[1];
    const effect = line.match(/^\s*effect:\s*([A-Za-z]+)\s*$/);
    if (effect) model.effect = effect[1];
  }
  return model;
};

const formatDate = (value?: string): string => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

function PolicyDetailView() {
  const [policyId] = useState<string | null>(() => readSelectedPolicyId());
  const [policy, setPolicy] = useState<IPolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'conditions'>('overview');

  const loadPolicy = async () => {
    if (!policyId) {
      setLoading(false);
      setError(false);
      setPolicy(null);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const response = await policyengineApi.get<IPolicyDetail>(`/policies/${policyId}`);
      setPolicy(response.data);
    } catch (e) {
      console.error('Failed to load policy detail', e);
      setError(true);
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyId]);

  const getStatusVariant = (status?: string) => {
    switch ((status ?? '').toUpperCase()) {
      case 'ENABLED': return 'success';
      case 'DISABLED': return 'neutral';
      case 'DRAFT': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch ((status ?? '').toUpperCase()) {
      case 'ENABLED': return <FeatherCheck />;
      case 'DISABLED': return <FeatherX />;
      case 'DRAFT': return <FeatherEdit2 />;
      default: return <FeatherClock />;
    }
  };

  // Human-readable status label without throwing on undefined.
  const formatStatus = (status?: string): string => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  const handleToggleStatus = async () => {
    if (!policy) return;
    setActionLoading(true);
    setActionError(null);
    try {
      // ADR-0031: use the dedicated status-toggle endpoint. It returns 400
      // (with a message) if the policy's DSL is invalid and cannot be enabled.
      const next = (policy.status ?? '').toUpperCase() === 'ENABLED' ? 'DISABLED' : 'ENABLED';
      await setPolicyStatus(policy.id, next);
      await loadPolicy();
    } catch (e) {
      console.error('Failed to toggle policy status', e);
      setActionError(serverMessage(e) ?? 'Failed to update policy status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = () => {
    if (!policy) return;
    const blob = new Blob([JSON.stringify(policy, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `policy-${(policy.name ?? 'policy').replace(/[^a-z0-9-_]+/gi, '_')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleEdit = () => {
    if (policy) {
      try { sessionStorage.setItem('selectedPolicyId', policy.id); } catch { /* no-op */ }
    }
    const nav = window.navigateToPolicyEditor;
    if (typeof nav === 'function') {
      nav();
    } else {
      window.location.assign('/policy-editor');
    }
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-body font-body text-subtext-color">Loading policy details...</div>
        </div>
      </DefaultPageLayout>
    );
  }

  if (!policyId) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center px-6 py-6">
          <EmptyState
            title="No policy selected"
            message="Open a policy from the Policy Center to view its details."
            icon={<IconWithBackground variant="neutral" size="large" icon={<FeatherEye />} />}
          />
        </div>
      </DefaultPageLayout>
    );
  }

  if (error || !policy) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center px-6 py-6">
          <ErrorState
            message="The requested policy could not be loaded."
            onRetry={loadPolicy}
          />
        </div>
      </DefaultPageLayout>
    );
  }

  const rules = Array.isArray(policy.rules) ? policy.rules : [];
  const isEnabled = (policy.status ?? '').toUpperCase() === 'ENABLED';
  const policyDocument = policy.policyDocument ?? '';
  // C2b: AccessPolicy detection + structured model for the Access Model panel.
  const accessPolicy = isAccessPolicyDoc(policy);
  const accessModel = accessPolicy ? extractAccessModel(policyDocument) : null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="flex w-full flex-col items-start gap-6">
            {/* Policy Information */}
            <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Policy Information
              </span>
              <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col items-start gap-2">
                  <span className="text-caption font-caption text-subtext-color">Policy Name</span>
                  <span className="text-body-bold font-body-bold text-default-font">{policy.name ?? '—'}</span>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <span className="text-caption font-caption text-subtext-color">Status</span>
                  <Badge variant={getStatusVariant(policy.status)} icon={getStatusIcon(policy.status)}>
                    {formatStatus(policy.status)}
                  </Badge>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <span className="text-caption font-caption text-subtext-color">Rules</span>
                  <span className="text-body-bold font-body-bold text-default-font">{rules.length}</span>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <span className="text-caption font-caption text-subtext-color">Created</span>
                  <span className="text-body font-body text-default-font">{formatDate(policy.createdAt)}</span>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <span className="text-caption font-caption text-subtext-color">Last Modified</span>
                  <span className="text-body font-body text-default-font">{formatDate(policy.updatedAt)}</span>
                </div>
                {policy.conditionLogic && (
                  <div className="flex flex-col items-start gap-2">
                    <span className="text-caption font-caption text-subtext-color">Condition Logic</span>
                    <span className="text-body font-body text-default-font font-mono">{policy.conditionLogic}</span>
                  </div>
                )}
              </div>
              <div className="flex w-full flex-col items-start gap-2">
                <span className="text-caption font-caption text-subtext-color">Description</span>
                <span className="text-body font-body text-default-font whitespace-pre-wrap">
                  {policy.description || '—'}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Quick Actions
              </span>
              <div className="flex w-full flex-wrap items-center gap-4">
                <Button
                  variant="brand-primary"
                  icon={<FeatherEdit2 />}
                  onClick={handleEdit}
                >
                  Edit Policy
                </Button>
                <Button
                  variant={isEnabled ? 'neutral-primary' : 'brand-primary'}
                  icon={isEnabled ? <FeatherPowerOff /> : <FeatherPower />}
                  loading={actionLoading}
                  onClick={handleToggleStatus}
                >
                  {isEnabled ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="neutral-tertiary"
                  icon={<FeatherSave />}
                  onClick={handleExport}
                >
                  Export Config
                </Button>
              </div>
              {actionError && (
                <span className="text-caption font-caption text-error-700">{actionError}</span>
              )}
            </div>
          </div>
        );

      case 'conditions':
        return (
          <div className="flex w-full flex-col items-start gap-6">
            {/* C2b-access-PolicyDetailView: structured Access Model for
                AccessPolicy records (subjects, actions, match labels, condition,
                effect, obligations). Rendered above the raw document. */}
            {accessPolicy && accessModel ? (
              <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <div className="flex w-full items-center justify-between">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Access Model
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="brand">Access Policy</Badge>
                    {accessModel.effect && (
                      <Badge
                        variant={accessModel.effect.toLowerCase() === 'deny' ? 'error' : 'success'}
                      >
                        {accessModel.effect.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex w-full flex-col items-start gap-2">
                  <span className="text-caption font-caption text-subtext-color">Subject Tiers</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {accessModel.tiers.length > 0
                      ? accessModel.tiers.map((t) => (
                          <Badge key={t} variant="neutral">{t}</Badge>
                        ))
                      : <span className="text-body font-body text-subtext-color">—</span>}
                  </div>
                </div>

                <div className="flex w-full flex-col items-start gap-2">
                  <span className="text-caption font-caption text-subtext-color">Subject Roles</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {accessModel.roles.length > 0
                      ? accessModel.roles.map((r) => (
                          <Badge key={r} variant="neutral">{r}</Badge>
                        ))
                      : <span className="text-body font-body text-subtext-color">—</span>}
                  </div>
                </div>

                <div className="flex w-full flex-col items-start gap-2">
                  <span className="text-caption font-caption text-subtext-color">Actions</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {accessModel.actions.length > 0
                      ? accessModel.actions.map((a) => (
                          <Badge key={a} variant="brand">{a}</Badge>
                        ))
                      : <span className="text-body font-body text-subtext-color">—</span>}
                  </div>
                </div>

                <div className="flex w-full flex-col items-start gap-2">
                  <span className="text-caption font-caption text-subtext-color">Match Labels</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {accessModel.matchLabels.length > 0
                      ? accessModel.matchLabels.map((l) => (
                          <Badge key={l} variant="neutral">{l}</Badge>
                        ))
                      : <span className="text-body font-body text-subtext-color">—</span>}
                  </div>
                </div>

                <div className="flex w-full flex-col items-start gap-2">
                  <span className="text-caption font-caption text-subtext-color">Condition</span>
                  <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-caption font-caption text-subtext-color">Purpose</span>
                      <span className="text-body font-body text-default-font">
                        {accessModel.purpose.length > 0 ? accessModel.purpose.join(', ') : '—'}
                      </span>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-caption font-caption text-subtext-color">Region</span>
                      <span className="text-body font-body text-default-font">
                        {accessModel.region.length > 0 ? accessModel.region.join(', ') : '—'}
                      </span>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-caption font-caption text-subtext-color">Consent</span>
                      <span className="text-body font-body text-default-font">
                        {accessModel.consent ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {accessModel.obligations.length > 0 && (
                  <div className="flex w-full flex-col items-start gap-2">
                    <span className="text-caption font-caption text-subtext-color">Obligations</span>
                    <Table
                      header={
                        <Table.HeaderRow>
                          <Table.HeaderCell>Type</Table.HeaderCell>
                          <Table.HeaderCell>Labels</Table.HeaderCell>
                        </Table.HeaderRow>
                      }
                    >
                      {accessModel.obligations.map((o, i) => (
                        <Table.Row key={i}>
                          <Table.Cell>
                            <Badge variant="neutral">{o.type}</Badge>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-body font-body text-default-font">
                              {o.labels.join(', ') || '—'}
                            </span>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table>
                  </div>
                )}
              </div>
            ) : null}

            {/* ADR-0031: render the canonical dlap/v1 DSL document. Falls back
                to the legacy rules table below when the document is empty. */}
            {policyDocument ? (
              <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Policy Document (dlap/v1)
                </span>
                <pre
                  className="w-full overflow-x-auto rounded-md border border-solid border-neutral-border bg-neutral-50 p-4 text-caption font-monospace"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 12, whiteSpace: 'pre', margin: 0 }}
                >
                  {policyDocument}
                </pre>
              </div>
            ) : null}

            <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center justify-between">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Policy Rules
                </span>
                <Badge variant="neutral">{rules.length} rules</Badge>
              </div>

              {rules.length > 0 ? (
                <Table
                  header={
                    <Table.HeaderRow>
                      <Table.HeaderCell>#</Table.HeaderCell>
                      <Table.HeaderCell>Rule</Table.HeaderCell>
                    </Table.HeaderRow>
                  }
                >
                  {rules.map((rule, index) => (
                    <Table.Row key={index}>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <IconWithBackground variant="neutral" icon={<FeatherFilter />} size="small" />
                          <span className="text-body-bold font-body-bold text-default-font">
                            {index + 1}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-body font-body text-default-font font-mono whitespace-pre-wrap">
                          {JSON.stringify(rule)}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table>
              ) : (
                <EmptyState
                  title="No rules defined"
                  message="This policy has no rules defined."
                  icon={<IconWithBackground variant="neutral" size="large" icon={<FeatherFilter />} />}
                />
              )}
            </div>

            {policy.actions && Object.keys(policy.actions).length > 0 && (
              <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Policy Actions
                </span>
                <span className="text-body font-body text-default-font font-mono whitespace-pre-wrap">
                  {JSON.stringify(policy.actions, null, 2)}
                </span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6 overflow-auto">
        {/* Header */}
        <div className="flex w-full flex-col items-start gap-4">
          <Breadcrumbs>
            <Breadcrumbs.Item>Administration</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item onClick={() => window.navigateToPolicyHub2?.()}>
              Policy Center
            </Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item active={true}>Policy Details</Breadcrumbs.Item>
          </Breadcrumbs>

          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-4">
              <IconButton
                icon={<FeatherArrowLeft />}
                onClick={() => window.navigateToPolicyHub2?.()}
              />
              <div className="flex flex-col items-start gap-1">
                <span className="text-heading-2 font-heading-2 text-default-font">
                  {policy.name ?? 'Untitled policy'}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(policy.status)} icon={getStatusIcon(policy.status)}>
                    {formatStatus(policy.status)}
                  </Badge>
                  <span className="text-caption font-caption text-subtext-color">
                    Last modified {formatDate(policy.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs>
          <Tabs.Item
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={<FeatherEye />}
          >
            Overview
          </Tabs.Item>
          <Tabs.Item
            active={activeTab === 'conditions'}
            onClick={() => setActiveTab('conditions')}
            icon={<FeatherCode />}
          >
            Rules & Actions
          </Tabs.Item>
        </Tabs>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </DefaultPageLayout>
  );
}

export default PolicyDetailView;
