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
    FeatherAlertCircle,
    FeatherAlertTriangle,
    FeatherCheck,
    FeatherClock,
    FeatherEdit2,
    FeatherEye,
    FeatherFilter,
    FeatherPlus,
    FeatherPower,
    FeatherPowerOff,
    FeatherRefreshCw,
    FeatherSearch,
    FeatherShield,
    FeatherTrash2,
    FeatherX
} from "@subframe/core";
import { useEffect, useState } from "react";
import { Badge } from "../ui/components/Badge";
import { Breadcrumbs } from "../ui/components/Breadcrumbs";
import { Button } from "../ui/components/Button";
import { IconButton } from "../ui/components/IconButton";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Select } from "../ui/components/Select";
import { Table } from "../ui/components/Table";
import { TextField } from "../ui/components/TextField";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { EmptyState, ErrorState } from "../components/EmptyState";

// Real policy endpoints (see utils/apiServices.ts + da-policyengine PolicyController)
import {
    PolicyDraftResponse,
    PolicyRecord,
    deletePolicy,
    getPolicyDrafts,
    listPolicies,
    setPolicyStatus,
} from "../utils/apiServices";
import { policyengineApi } from "../utils/api";
import { serverMessage } from '../utils/httpError';
import { confirmAction } from '../utils/confirm';

// KPIs sourced from da-policyengine PolicyController metrics endpoints.
interface IPolicyKpis {
  activePolicies: number;
  pendingReview: number;
  policyViolations: number;
  totalPolicies: number;
  complianceRate: number;
}

// Unified row shape rendered by the table. Backing data is EITHER a
// published Policy (PolicyRecord, from /policies) or a PolicyDraft
// (PolicyDraftResponse, from /drafts). No fabricated columns.
interface IPolicyRow {
  id: string;
  name: string;
  description: string;
  status: string; // ENABLED | DISABLED | DRAFT | SUBMITTED | APPROVED | REJECTED | PUBLISHED
  lastModified: string;
  createdBy: string;
  ruleCount?: number;
  isDraft: boolean;
}

interface IFilterOptions {
  status: string;
  compliance: string;
}

/**
 * getPolicyDrafts() returns the raw axios payload typed as an array,
 * but da-policyengine serves GET /drafts as a Spring Page. Normalize
 * both shapes to a flat array.
 */
const normalizeDrafts = (data: unknown): PolicyDraftResponse[] => {
  if (Array.isArray(data)) return data as PolicyDraftResponse[];
  const page = data as { content?: PolicyDraftResponse[] } | null;
  if (page?.content && Array.isArray(page.content)) return page.content;
  return [];
};

const formatRelativeTime = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

function PolicyManagementHub2() {
  const [kpis, setKpis] = useState<IPolicyKpis | null>(null);
  const [rows, setRows] = useState<IPolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<IFilterOptions>({
    status: 'all',
    compliance: 'all',
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      // Metrics endpoints return bare scalars (Long/Double).
      const [
        activeRes,
        violationsRes,
        complianceRes,
        policies,
        draftsRaw,
      ] = await Promise.all([
        policyengineApi.get<number>('/policies/count/active'),
        policyengineApi.get<number>('/policies/violations/count'),
        policyengineApi.get<number>('/policies/compliance-rate'),
        listPolicies(),
        getPolicyDrafts(),
      ]);

      const drafts = normalizeDrafts(draftsRaw);
      const pendingReview = drafts.filter((d) => d.status === 'SUBMITTED').length;

      setKpis({
        activePolicies: Number(activeRes.data) || 0,
        pendingReview,
        policyViolations: Number(violationsRes.data) || 0,
        totalPolicies: policies.length + drafts.length,
        complianceRate: Math.round(Number(complianceRes.data) || 0),
      });

      const policyRows: IPolicyRow[] = policies.map((p: PolicyRecord) => ({
        id: p.id,
        name: p.name,
        description: p.description || '—',
        status: p.status,
        lastModified: formatRelativeTime(p.updatedAt),
        createdBy: '—',
        ruleCount: p.ruleCount,
        isDraft: false,
      }));

      const draftRows: IPolicyRow[] = drafts.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description || '—',
        status: d.status,
        lastModified: formatRelativeTime(d.updatedAt),
        createdBy: d.createdBy || '—',
        isDraft: true,
      }));

      setRows([...policyRows, ...draftRows]);
    } catch (e) {
      console.error('Failed to load policy data', e);
      setError(true);
      setKpis(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStatusVariant = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ENABLED':
      case 'PUBLISHED':
      case 'APPROVED':
        return 'success';
      case 'SUBMITTED':
        return 'warning';
      case 'DISABLED':
      case 'DRAFT':
        return 'neutral';
      case 'REJECTED':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ENABLED':
      case 'PUBLISHED':
      case 'APPROVED':
        return <FeatherCheck />;
      case 'SUBMITTED':
        return <FeatherClock />;
      case 'DISABLED':
        return <FeatherX />;
      case 'DRAFT':
        return <FeatherEdit2 />;
      case 'REJECTED':
        return <FeatherX />;
      default:
        return <FeatherCheck />;
    }
  };

  const filteredRows = rows.filter((row) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        row.name.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.createdBy.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filters.status !== 'all' && row.status.toUpperCase() !== filters.status.toUpperCase()) {
      return false;
    }
    return true;
  });

  // View → PolicyDetailView. Pass the real id via sessionStorage so the
  // detail view can read it (App.tsx nav is prop-less).
  const handleView = (row: IPolicyRow) => {
    try {
      sessionStorage.setItem('selectedPolicyId', row.id);
      sessionStorage.setItem('selectedPolicyIsDraft', row.isDraft ? '1' : '0');
    } catch { /* sessionStorage unavailable — detail view will show ErrorState */ }
    window.navigateToPolicyDetailView?.();
  };

  // Edit → PolicyEditor (published policies) or PolicyWizardFlow (drafts).
  const handleEdit = (row: IPolicyRow) => {
    try {
      sessionStorage.setItem('selectedPolicyId', row.id);
    } catch { /* no-op */ }
    if (row.isDraft) {
      window.navigateToPolicyWizardFlow?.();
    } else {
      // No dedicated nav global for PolicyEditor yet (see return notes);
      // prefer it if App.tsx exposes one, else route directly.
      const nav = window.navigateToPolicyEditor;
      if (typeof nav === 'function') {
        nav();
      } else {
        window.location.assign('/policy-editor');
      }
    }
  };

  // Enable/Disable only applies to published policies (PolicyRecord).
  // ADR-0031: use the dedicated status-toggle endpoint, which returns 400
  // (with a message) if enabling a policy whose DSL is invalid.
  const handleToggleStatus = async (row: IPolicyRow) => {
    if (row.isDraft) return;
    setActionLoading(row.id);
    setActionError(null);
    try {
      const next = row.status.toUpperCase() === 'ENABLED' ? 'DISABLED' : 'ENABLED';
      await setPolicyStatus(row.id, next);
      await loadData();
    } catch (e) {
      console.error('Failed to update policy status', e);
      setActionError(serverMessage(e) ?? 'Failed to update policy status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (row: IPolicyRow) => {
    if (row.isDraft) return; // drafts are deleted from the wizard/editor flow
    if (!confirmAction(`Delete policy "${row.name}"? This action cannot be undone.`)) return;
    setActionLoading(row.id);
    try {
      await deletePolicy(row.id);
      await loadData();
    } catch (e) {
      console.error('Failed to delete policy', e);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-body font-body text-subtext-color">Loading policies...</div>
        </div>
      </DefaultPageLayout>
    );
  }

  if (error) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center px-6 py-6">
          <ErrorState
            message="Failed to load policy data from the policy engine."
            onRetry={loadData}
          />
        </div>
      </DefaultPageLayout>
    );
  }

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6 overflow-auto">
        <div className="flex w-full flex-col items-start gap-4">
          <Breadcrumbs>
            <Breadcrumbs.Item>Administration</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item active={true}>Policy Center</Breadcrumbs.Item>
          </Breadcrumbs>
          <div className="flex w-full items-center justify-between">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Policy Center
            </span>
            <Button
              icon={<FeatherPlus />}
              onClick={() => window.navigateToPolicyWizardFlow?.()}
            >
              Create New Policy
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="flex w-full flex-wrap items-start gap-4">
          <div className="flex min-w-[200px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground variant="success" icon={<FeatherShield />} />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Active Policies
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis?.activePolicies ?? '—'}
            </span>
          </div>
          <div className="flex min-w-[200px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground variant="warning" icon={<FeatherClock />} />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Pending Review
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis?.pendingReview ?? '—'}
            </span>
          </div>
          <div className="flex min-w-[200px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground variant="error" icon={<FeatherAlertTriangle />} />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Policy Violations
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis?.policyViolations ?? '—'}
            </span>
          </div>
          <div className="flex min-w-[200px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground variant="brand" icon={<FeatherRefreshCw />} />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Total Policies
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis?.totalPolicies ?? '—'}
            </span>
            <Badge variant="neutral">
              {kpis ? `${kpis.complianceRate}% compliance` : '—'}
            </Badge>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex w-full items-center gap-4">
          <div className="flex grow shrink-0 basis-0 items-center gap-2">
            <TextField
              variant="filled"
              label=""
              helpText=""
              icon={<FeatherSearch />}
            >
              <TextField.Input
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </TextField>
          </div>
          <Select
            label=""
            placeholder="Status"
            helpText=""
            value={filters.status}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
          >
            <Select.Item value="all">All Status</Select.Item>
            <Select.Item value="ENABLED">Enabled</Select.Item>
            <Select.Item value="DISABLED">Disabled</Select.Item>
            <Select.Item value="DRAFT">Draft</Select.Item>
            <Select.Item value="SUBMITTED">Submitted</Select.Item>
            <Select.Item value="APPROVED">Approved</Select.Item>
            <Select.Item value="PUBLISHED">Published</Select.Item>
            <Select.Item value="REJECTED">Rejected</Select.Item>
          </Select>
        </div>

        {/* Results Summary */}
        <div className="flex w-full items-center justify-between">
          <span className="text-body font-body text-subtext-color">
            Showing {filteredRows.length} of {rows.length} policies
          </span>
        </div>

        {actionError && (
          <div className="flex w-full items-center gap-2 rounded-md border border-solid border-error-200 bg-error-50 px-4 py-3">
            <FeatherAlertCircle className="text-error-600" />
            <span className="text-body font-body text-error-700">{actionError}</span>
          </div>
        )}

        {/* Policies Table */}
        {rows.length === 0 ? (
          <EmptyState
            title="No policies yet"
            message="No policies or drafts have been created yet. Create your first policy to get started."
            icon={<IconWithBackground variant="neutral" size="large" icon={<FeatherShield />} />}
          />
        ) : (
          <div className="flex w-full flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background shadow-sm">
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Policy Name</Table.HeaderCell>
                  <Table.HeaderCell>Description</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Last Modified</Table.HeaderCell>
                  <Table.HeaderCell>Created By</Table.HeaderCell>
                  <Table.HeaderCell>Actions</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {filteredRows.map((row) => (
                <Table.Row key={`${row.isDraft ? 'draft' : 'policy'}-${row.id}`}>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <IconWithBackground variant="neutral" icon={<FeatherShield />} size="small" />
                      <div className="flex flex-col items-start">
                        <span className="text-body-bold font-body-bold text-default-font">
                          {row.name}
                        </span>
                        <span className="text-caption font-caption text-subtext-color">
                          {row.ruleCount != null ? `${row.ruleCount} rules` : row.isDraft ? 'Draft' : '—'}
                        </span>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {row.description}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={getStatusVariant(row.status)} icon={getStatusIcon(row.status)}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1).toLowerCase()}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {row.lastModified}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {row.createdBy}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <IconButton
                        icon={<FeatherEye />}
                        onClick={() => handleView(row)}
                      />
                      <IconButton
                        icon={<FeatherEdit2 />}
                        onClick={() => handleEdit(row)}
                      />
                      {!row.isDraft && (
                        <>
                          <IconButton
                            icon={row.status.toUpperCase() === 'ENABLED' ? <FeatherPowerOff /> : <FeatherPower />}
                            variant={row.status.toUpperCase() === 'ENABLED' ? 'neutral-tertiary' : 'brand-tertiary'}
                            loading={actionLoading === row.id}
                            onClick={() => handleToggleStatus(row)}
                          />
                          <IconButton
                            variant="destructive-tertiary"
                            icon={<FeatherTrash2 />}
                            loading={actionLoading === row.id}
                            onClick={() => handleDelete(row)}
                          />
                        </>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          </div>
        )}

        {/* Filtered-empty state */}
        {rows.length > 0 && filteredRows.length === 0 && (
          <div className="flex w-full flex-col items-center justify-center gap-4 py-12">
            <IconWithBackground variant="neutral" icon={<FeatherFilter />} size="large" />
            <div className="flex flex-col items-center gap-2">
              <span className="text-heading-3 font-heading-3 text-default-font">
                No policies match your filters
              </span>
              <span className="text-body font-body text-subtext-color text-center">
                Try adjusting your search or status filter.
              </span>
            </div>
          </div>
        )}
      </div>
    </DefaultPageLayout>
  );
}

export default PolicyManagementHub2;
