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
    FeatherDatabase,
    FeatherPieChart,
    FeatherRefreshCw,
    FeatherSettings,
    FeatherTrash2,
    FeatherTrendingUp,
    FeatherZap
} from "@subframe/core";
import { useEffect, useState } from "react";
import { PendingApprovalsNotice, SoftDeleteRestorePanel } from "../components/ApprovalPanels";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { LineChart } from "../ui/components/LineChart";
import { PieChart } from "../ui/components/PieChart";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { deleteAgentApi } from "../utils/api";

// TypeScript interfaces mirroring da-autodelete dashboard DTOs
// (da-autodelete/src/main/java/com/dlap/autodelete/dto/*.java)
interface IDeleteKpis {
  activePolicies: number;
  assetsDeleted: number;
  assetsDeletedLast24h: number;
  pendingDeletion: number;
  failedDeletion: number;
  storageReclaimed: string;
  estimatedMonthlySavings: number;
  totalSavingsToDate: number;
  complianceScore: number;
  averageDeletionTime: number;
  lastPolicyRun: string;
}

interface IStorageReclaimedTrend {
  date: string;
  retention: number;
  gdpr: number;
  duplicateData: number;
  qualityIssues: number;
  storageOptimization: number;
  totalReclaimed: number;
}

interface IDeletionByPolicyData {
  name: string;
  value: number;
  color?: string;
}

interface IRecentActivity {
  id: string;
  event: string;
  assetName: string;
  policy: string;
  assetSize: string;
  reason: string;
  status: string; // Success | Pending | Failed | Approved | Review Required
  timestamp: string; // ISO LocalDateTime from backend
  details?: string;
}

interface IRiskAsset {
  name: string;
  type: string;
  size: string;
  lastAccessed: string | null; // ISO LocalDateTime or null
  risk: string; // High | Medium | Low
  scheduledDeletion: string | null; // ISO LocalDateTime or null (backend may not persist it yet)
  reason: string;
}

// Real API calls against da-autodelete DeleteAgentDashboardController
// (base path /api/v1/delete-agent/dashboard via the shared deleteAgentApi client).
const fetchDeleteKpis = async (): Promise<IDeleteKpis> => {
  const response = await deleteAgentApi.get('/dashboard/kpis');
  const d = response.data ?? {};
  return {
    activePolicies: d.activePolicies ?? 0,
    assetsDeleted: d.assetsDeleted ?? 0,
    assetsDeletedLast24h: d.assetsDeletedLast24h ?? 0,
    pendingDeletion: d.pendingDeletion ?? 0,
    failedDeletion: d.failedDeletion ?? 0,
    storageReclaimed: d.storageReclaimed ?? '0 GB',
    estimatedMonthlySavings: d.estimatedMonthlySavings ?? 0,
    totalSavingsToDate: d.totalSavingsToDate ?? 0,
    complianceScore: d.complianceScore ?? 0,
    averageDeletionTime: d.averageDeletionTime ?? 0,
    lastPolicyRun: d.lastPolicyRun ?? '',
  };
};

const fetchStorageReclaimedTrends = async (weeks: number = 7): Promise<IStorageReclaimedTrend[]> => {
  const response = await deleteAgentApi.get('/dashboard/trends/storage-reclaimed', { params: { weeks } });
  const rows: Array<Partial<IStorageReclaimedTrend>> = Array.isArray(response.data) ? response.data : [];
  return rows.map((r) => ({
    date: r.date ?? '',
    retention: r.retention ?? 0,
    gdpr: r.gdpr ?? 0,
    duplicateData: r.duplicateData ?? 0,
    qualityIssues: r.qualityIssues ?? 0,
    storageOptimization: r.storageOptimization ?? 0,
    totalReclaimed: r.totalReclaimed ?? 0,
  }));
};

const fetchDeletionByPolicyData = async (): Promise<IDeletionByPolicyData[]> => {
  const response = await deleteAgentApi.get('/dashboard/policies/deletion-stats');
  const rows: Array<Partial<IDeletionByPolicyData>> = Array.isArray(response.data) ? response.data : [];
  return rows.map((r) => ({
    name: r.name ?? '',
    value: r.value ?? 0,
    color: r.color ?? undefined,
  }));
};

const fetchRecentActivities = async (limit: number = 10): Promise<IRecentActivity[]> => {
  const response = await deleteAgentApi.get('/dashboard/activities/recent', { params: { limit } });
  const rows: Array<Partial<IRecentActivity>> = Array.isArray(response.data) ? response.data : [];
  return rows.map((r, i) => ({
    id: r.id ?? `activity-${i + 1}`,
    event: r.event ?? '',
    assetName: r.assetName ?? '',
    policy: r.policy ?? '',
    assetSize: r.assetSize ?? '',
    reason: r.reason ?? '',
    status: r.status ?? '',
    timestamp: r.timestamp ?? '',
    details: r.details ?? undefined,
  }));
};

const fetchRiskAssets = async (limit: number = 10): Promise<IRiskAsset[]> => {
  const response = await deleteAgentApi.get('/dashboard/assets/risk', { params: { limit } });
  const rows: Array<Partial<IRiskAsset>> = Array.isArray(response.data) ? response.data : [];
  return rows.map((r) => ({
    name: r.name ?? '',
    type: r.type ?? '',
    size: r.size ?? '',
    lastAccessed: r.lastAccessed ?? null,
    risk: r.risk ?? '',
    scheduledDeletion: r.scheduledDeletion ?? null,
    reason: r.reason ?? '',
  }));
};

const triggerDeletionRun = async (): Promise<void> => {
  // POST /api/v1/delete-agent/dashboard/trigger-run — returns a plain string body.
  await deleteAgentApi.post('/dashboard/trigger-run');
};

// Presentation-only date formatting for ISO LocalDateTime strings from the backend.
const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

function DeleteAgentOverview() {
  // State management
  const [kpis, setKpis] = useState<IDeleteKpis | null>(null);
  const [storageReclaimedTrends, setStorageReclaimedTrends] = useState<IStorageReclaimedTrend[]>([]);
  const [deletionByPolicyData, setDeletionByPolicyData] = useState<IDeletionByPolicyData[]>([]);
  const [recentActivities, setRecentActivities] = useState<IRecentActivity[]>([]);
  const [riskAssets, setRiskAssets] = useState<IRiskAsset[]>([]);
  const [showAllRiskAssets, setShowAllRiskAssets] = useState<boolean>(false);
  const [showAllActivities, setShowAllActivities] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisData, trendsData, policyData, activitiesData, riskData] = await Promise.all([
        fetchDeleteKpis(),
        fetchStorageReclaimedTrends(),
        fetchDeletionByPolicyData(),
        fetchRecentActivities(),
        fetchRiskAssets()
      ]);

      setKpis(kpisData);
      setStorageReclaimedTrends(trendsData);
      setDeletionByPolicyData(policyData);
      setRecentActivities(activitiesData);
      setRiskAssets(riskData);
      setShowAllRiskAssets(false);
      setShowAllActivities(false);
    } catch (error) {
      console.error('Error loading delete agent data:', error);
      setError('Failed to load delete agent data from da-autodelete.');
    } finally {
      setLoading(false);
    }
  };

  // Load all data
  useEffect(() => {
    loadData();
  }, []);

  // Trigger a manual deletion run, then refetch the dashboard.
  const handleRefresh = async () => {
    setRefreshing(true);
    setActionError(null);
    try {
      await triggerDeletionRun();
      const [kpisData, activitiesData, riskData] = await Promise.all([
        fetchDeleteKpis(),
        fetchRecentActivities(showAllActivities ? 100 : 10),
        fetchRiskAssets(showAllRiskAssets ? 100 : 10)
      ]);
      setKpis(kpisData);
      setRecentActivities(activitiesData);
      setRiskAssets(riskData);
    } catch (error) {
      console.error('Error during manual deletion run:', error);
      setActionError('Manual deletion run failed. Check da-autodelete service logs.');
    } finally {
      setRefreshing(false);
    }
  };

  // 'View All' controls — real refetch with a larger limit against the same endpoints.
  const handleViewAllRiskAssets = async () => {
    try {
      const riskData = await fetchRiskAssets(100);
      setRiskAssets(riskData);
      setShowAllRiskAssets(true);
    } catch (error) {
      console.error('Error loading all risk assets:', error);
      setActionError('Failed to load the full scheduled-deletion list.');
    }
  };

  const handleViewAllActivities = async () => {
    try {
      const activitiesData = await fetchRecentActivities(100);
      setRecentActivities(activitiesData);
      setShowAllActivities(true);
    } catch (error) {
      console.error('Error loading all activities:', error);
      setActionError('Failed to load the full activity list.');
    }
  };

  // Helper functions
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Success': return 'success';
      case 'Pending': return 'warning';
      case 'Approved': return 'brand';
      case 'Review Required': return 'warning';
      case 'Failed': return 'error';
      default: return 'neutral';
    }
  };

  const getRiskVariant = (risk: string) => {
    switch (risk) {
      case 'High': return 'error';
      case 'Medium': return 'warning';
      case 'Low': return 'success';
      default: return 'neutral';
    }
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-body font-body text-subtext-color">Loading delete agent data...</span>
        </div>
      </DefaultPageLayout>
    );
  }

  if (error || !kpis) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full flex-col items-center justify-center px-6 py-6">
          <ErrorState
            message={error || 'Unable to load delete agent information.'}
            onRetry={loadData}
          />
        </div>
      </DefaultPageLayout>
    );
  }

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
        <div className="flex w-full items-start justify-between">
          <div className="flex items-center gap-4">
            <IconWithBackground
              size="large"
              icon={<FeatherTrash2 />}
              variant="error"
            />
            <div className="flex flex-col items-start">
              <span className="text-heading-2 font-heading-2 text-default-font">
                SmartDelete Management
              </span>
              <span className="text-body font-body text-subtext-color">
                Automated Data Deletion Agent
              </span>
            </div>
          </div>
          <Button
            variant="neutral-tertiary"
            icon={<FeatherRefreshCw />}
            onClick={handleRefresh}
            loading={refreshing}
            disabled={refreshing}
          >
            {refreshing ? 'Running...' : kpis.lastPolicyRun ? `Last run: ${kpis.lastPolicyRun}` : 'Run deletion now'}
          </Button>
        </div>

        {actionError && (
          <div className="w-full rounded-md border border-solid border-error-200 bg-error-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <FeatherAlertCircle className="h-4 w-4 text-error-600" />
              <span className="text-body font-body text-error-800">{actionError}</span>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <Tabs>
          <Tabs.Item active={true} icon={<FeatherPieChart />} onClick={() => window.navigateToDeleteAgentOverview?.()}>
            Overview
          </Tabs.Item>
          <Tabs.Item icon={<FeatherSettings />} onClick={() => window.navigateToDeleteAgentConfig?.()}>
            Policy Configuration
          </Tabs.Item>
        </Tabs>

        <PendingApprovalsNotice actionClasses={["SOFT_DELETE", "HARD_DELETE"]} />

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4 w-full">
          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherSettings />} variant="brand" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Active Policies
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis.activePolicies}
            </span>
            {kpis.activePolicies > 0 ? (
              <Badge variant="success" icon={<FeatherCheck />}>
                Operational
              </Badge>
            ) : (
              <Badge variant="neutral">None configured</Badge>
            )}
          </div>

          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherTrash2 />} variant="error" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Assets Deleted
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis.assetsDeleted.toLocaleString()}
            </span>
            <Badge variant="success" icon={<FeatherTrendingUp />}>
              +{kpis.assetsDeletedLast24h} today
            </Badge>
          </div>

          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherAlertTriangle />} variant="warning" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Pending Deletion
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis.pendingDeletion}
            </span>
            <Badge variant="warning" icon={<FeatherClock />}>
              {kpis.failedDeletion} failed
            </Badge>
          </div>

          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherDatabase />} variant="success" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Storage Reclaimed
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis.storageReclaimed}
            </span>
            <Badge variant={kpis.totalSavingsToDate > 0 ? 'success' : 'neutral'}>
              ${kpis.totalSavingsToDate.toLocaleString()} saved
            </Badge>
          </div>
        </div>

        {/* Charts Section */}
        <div className="flex w-full gap-6">
          {/* Storage Reclaimed Chart */}
          <div className="flex w-2/3 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex items-center justify-between w-full">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Storage Reclaimed Over Time
              </span>
              <Badge variant="neutral">
                Last 7 weeks
              </Badge>
            </div>
            {storageReclaimedTrends.length > 0 ? (
              <LineChart
                className="h-64 w-full flex-none"
                data={storageReclaimedTrends.map(trend => ({
                  category: trend.date.slice(-5), // Show MM-DD format
                  "Retention": trend.retention,
                  "GDPR": trend.gdpr,
                  "Duplicate Data": trend.duplicateData,
                  "Quality Issues": trend.qualityIssues,
                  "Storage Optimization": trend.storageOptimization
                }))}
                index="category"
                categories={["Retention", "GDPR", "Duplicate Data", "Quality Issues", "Storage Optimization"]}
              />
            ) : (
              <EmptyState
                title="No trend data yet"
                message="Storage-reclaimed trends appear after deletion runs complete."
              />
            )}
          </div>

          {/* Deletion by Policy Type Donut Chart */}
          <div className="flex w-1/3 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex items-center justify-between w-full">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Deletion by Policy Type
              </span>
              <Badge variant="neutral">
                Current
              </Badge>
            </div>
            {deletionByPolicyData.length > 0 ? (
              <>
                <div className="flex w-full items-center justify-center">
                  <PieChart
                    className="h-48 w-48 flex-none"
                    data={deletionByPolicyData.map(policy => ({
                      name: policy.name,
                      value: policy.value
                    }))}
                    index="name"
                    category="value"
                  />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {deletionByPolicyData.slice(0, 4).map((policy) => (
                    <div key={policy.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: policy.color || '#6b7280' }}
                        />
                        <span className="text-body font-body text-subtext-color">
                          {policy.name}
                        </span>
                      </div>
                      <span className="text-body-bold font-body-bold text-default-font">
                        {policy.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="No deletions recorded"
                message="Per-policy deletion statistics appear once policies delete assets."
              />
            )}
          </div>
        </div>

        {/* Assets Scheduled for Deletion Table */}
        <div className="flex w-full flex-col items-start gap-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Assets Scheduled for Deletion
            </span>
            {!showAllRiskAssets && riskAssets.length > 0 && (
              <Button
                variant="neutral-tertiary"
                size="small"
                onClick={handleViewAllRiskAssets}
              >
                View All
              </Button>
            )}
          </div>
          {riskAssets.length > 0 ? (
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Asset Name</Table.HeaderCell>
                  <Table.HeaderCell>Type</Table.HeaderCell>
                  <Table.HeaderCell>Size</Table.HeaderCell>
                  <Table.HeaderCell>Last Accessed</Table.HeaderCell>
                  <Table.HeaderCell>Risk Level</Table.HeaderCell>
                  <Table.HeaderCell>Scheduled Deletion</Table.HeaderCell>
                  <Table.HeaderCell>Reason</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {riskAssets.map((asset, index) => (
                <Table.Row key={index}>
                  <Table.Cell>
                    <span className="text-body-bold font-body-bold text-default-font">
                      {asset.name}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="neutral">{asset.type}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-default-font">
                      {asset.size}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {formatDate(asset.lastAccessed)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={getRiskVariant(asset.risk)}>
                      {asset.risk}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {formatDate(asset.scheduledDeletion)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {asset.reason}
                    </span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          ) : (
            <EmptyState
              title="No assets scheduled for deletion"
              message="Assets flagged by deletion policies appear here."
            />
          )}
        </div>

        {/* Recent Activity Log */}
        <div className="flex w-full flex-col items-start gap-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Recent Deletion Activity
            </span>
            {!showAllActivities && recentActivities.length > 0 && (
              <Button
                variant="neutral-tertiary"
                size="small"
                onClick={handleViewAllActivities}
              >
                View All Activity
              </Button>
            )}
          </div>
          {recentActivities.length > 0 ? (
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Event</Table.HeaderCell>
                  <Table.HeaderCell>Asset</Table.HeaderCell>
                  <Table.HeaderCell>Policy</Table.HeaderCell>
                  <Table.HeaderCell>Asset Size</Table.HeaderCell>
                  <Table.HeaderCell>Reason</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Time</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {recentActivities.map(activity => (
                <Table.Row key={activity.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <IconWithBackground
                        variant={getStatusVariant(activity.status)}
                        size="small"
                        icon={<FeatherTrash2 />}
                      />
                      <span className="text-body-bold font-body-bold text-default-font">
                        {activity.event}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-default-font">
                      {activity.assetName}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="neutral">{activity.policy}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {activity.assetSize}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {activity.reason}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={getStatusVariant(activity.status)} icon={
                      activity.status === 'Success' ? <FeatherCheck /> :
                      activity.status === 'Pending' ? <FeatherClock /> :
                      activity.status === 'Approved' ? <FeatherZap /> :
                      activity.status === 'Review Required' ? <FeatherAlertTriangle /> :
                      <FeatherAlertCircle />
                    }>
                      {activity.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {formatDateTime(activity.timestamp)}
                    </span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          ) : (
            <EmptyState
              title="No deletion activity yet"
              message="Deletion events appear here after the agent processes tasks."
            />
          )}
        </div>

        <SoftDeleteRestorePanel />
      </div>
    </DefaultPageLayout>
  );
}

export default DeleteAgentOverview;
