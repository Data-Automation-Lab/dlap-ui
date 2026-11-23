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

import { FeatherAlertCircle, FeatherAlertTriangle, FeatherBell, FeatherCheck, FeatherCheckCircle, FeatherClock, FeatherDatabase, FeatherGitBranch, FeatherList, FeatherSettings, FeatherShieldCheck, FeatherTrendingUp, FeatherWifiOff } from "@subframe/core";
import { useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Avatar } from "../ui/components/Avatar";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Progress } from "../ui/components/Progress";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";

// Import our new API services
import { useCurrentUser } from "../utils/currentUser";
import { formatDate } from "../utils/safeDate";
import {
    NOT_AVAILABLE_YET,
    actionItemTotal,
    actionItemsFailed,
    actionItemsOf,
    costFigure,
    getActionItems,
    getConnectionHealthStatus,
    getCostSavings,
    getDirectorDashboardKpis,
    getGovernanceScore,
    getTeamPolicyOverview,
    governanceBreakdown,
    isNum,
    openActionItem,
    priorityBand,
    type ActionItem
} from "../utils/apiServices";

/** Route an action item to the most relevant view (real navigate helpers only). */
const navigateForActionItem = (item: ActionItem) => openActionItem(item, 'navigateToAdminControlHub');

/** One decimal place, or null when the value is missing. */
const oneDecimal = (value: number | null | undefined): number | null =>
  isNum(value) ? Math.round(value * 10) / 10 : null;

// Types for dashboard data (aligned with API responses)
interface IDirectorDashboardKpis {
  activePolicies: number;
  /** Null when no service reports it. */
  recentDatasets: number | null;
  missingMetadata: number;
  qualityIssues: number;
  /** Policy-compliance score, or null when it could not be computed. */
  policyConfigStatus: number | null;
  connectionHealth: number;
  activePoliciesGrowth: string;
  qualityIssuesLevel: 'critical' | 'warning' | 'low';
}

interface IPolicyOverviewItem {
  id: string;
  name: string;
  /** Null when the policy record has no category. */
  type: string | null;
  status: 'Active' | 'Pending' | 'Draft' | 'Error';
  /** Null when the policy engine does not report per-team reach. */
  teamsAffected: number | null;
  lastUpdated: string;
  /** Null when the policy engine does not score impact. */
  impactLevel: 'High' | 'Medium' | 'Low' | null;
  teamSpecificData?: {
    affectedAssets: number;
    compliance: number;
  };
}

interface ITechnicalStatusItem {
  id: string;
  component: string;
  status: 'Healthy' | 'Warning' | 'Error';
  uptime: string;
  lastCheck: string;
  actionRequired: boolean;
  metrics?: {
    assetsScanned: number;
    errorRate: number;
    avgResponseTime: number;
  };
}

interface IDataInsight {
  id: string;
  title: string;
  description: string;
  trend: 'up' | 'down' | 'stable';
  value: string;
  changePercent?: string;
}

// Real API functions using our Director-specific endpoints
// Returns null on failure so the page can render an ErrorState rather than
// falling back to fabricated KPI numbers (CLAUDE.md §9).
const fetchDirectorKpis = async (): Promise<IDirectorDashboardKpis | null> => {
  try {
    const directorData = await getDirectorDashboardKpis();

    return {
      activePolicies: directorData.activePolicies,
      recentDatasets: directorData.recentDatasets,
      missingMetadata: directorData.missingMetadata,
      qualityIssues: directorData.qualityIssues,
      policyConfigStatus: directorData.policyConfigStatus,
      connectionHealth: directorData.connectionHealth,
      activePoliciesGrowth: directorData.activePoliciesGrowth,
      qualityIssuesLevel: directorData.qualityIssuesLevel,
    };
  } catch (error) {
    console.error('Director KPIs Error:', error);
    return null;
  }
};

const fetchPolicyOverview = async (): Promise<IPolicyOverviewItem[]> => {
  try {
    console.log('📋 Fetching Team Policy Overview...');
    
    // Get team-specific policy overview
    const policyData = await getTeamPolicyOverview();
    
    return policyData.map(policy => ({
      id: policy.id,
      name: policy.name,
      type: policy.type,
      status: mapPolicyStatus(policy.status),
      teamsAffected: policy.teamsAffected,
      lastUpdated: policy.lastUpdated,
      impactLevel: policy.impactLevel ? mapImpactLevel(policy.impactLevel) : null,
      teamSpecificData: policy.teamSpecificData,
    }));
  } catch (error) {
    console.error('❌ Policy Overview Error:', error);
    return [];
  }
};

const fetchTechnicalStatus = async (): Promise<ITechnicalStatusItem[]> => {
  try {
    console.log('🔧 Fetching Connection Health Status...');
    
    // Get connection health status using job status data
    const connectionData = await getConnectionHealthStatus();
    
    return connectionData.map(conn => ({
      id: conn.connectionId,
      component: conn.connectionName,
      status: mapConnectionStatus(conn.status),
      uptime: conn.uptime,
      lastCheck: conn.lastCheck,
      actionRequired: conn.actionRequired,
      metrics: conn.metrics,
    }));
  } catch (error) {
    console.error('❌ Technical Status Error:', error);
    return [];
  }
};

// Insight cards derived only from real reporting/governance values. No
// changePercent is emitted because none of these endpoints expose a
// period-over-period delta, and inventing one (previously Math.random) is banned.
const fetchDataInsights = async (): Promise<IDataInsight[]> => {
  try {
    const [governanceData, costSavingsData, actionItems] = await Promise.all([
      getGovernanceScore(),
      getCostSavings(),
      getActionItems()
    ]);

    // Trend from the stored score history; stable when there is no history.
    const history = (governanceData.historicalTrend ?? [])
      .map((point) => point?.score)
      .filter(isNum);
    const governanceTrend: IDataInsight['trend'] =
      history.length >= 2
        ? history[history.length - 1] > history[history.length - 2]
          ? 'up'
          : history[history.length - 1] < history[history.length - 2]
            ? 'down'
            : 'stable'
        : 'stable';

    const overall = oneDecimal(governanceData.overallScore);
    const policyScore = oneDecimal(governanceBreakdown(governanceData).policyComplianceScore);
    const monthlySavings = costFigure(costSavingsData, costSavingsData.monthlySavingsRate);
    const totalItems = actionItemTotal(actionItems);

    return [
      {
        id: '1',
        title: 'Governance Score',
        description: 'Overall data governance health',
        trend: governanceTrend,
        value: overall !== null ? `${overall}%` : NOT_AVAILABLE_YET,
      },
      {
        id: '2',
        title: 'Monthly Savings',
        description: 'Cost savings from automation',
        trend: 'stable',
        value: monthlySavings !== null ? `$${monthlySavings.toLocaleString()}` : NOT_AVAILABLE_YET,
      },
      {
        id: '3',
        title: 'Action Items',
        description: 'Outstanding tasks requiring attention',
        trend: totalItems > 20 ? 'up' : totalItems < 10 ? 'down' : 'stable',
        value: actionItemsFailed(actionItems) ? NOT_AVAILABLE_YET : `${totalItems} items`,
      },
      {
        id: '4',
        title: 'Policy Compliance',
        description: 'Share of evaluated assets that pass their policies',
        trend: 'stable',
        value: policyScore !== null ? `${policyScore}%` : NOT_AVAILABLE_YET,
      },
    ];
  } catch (error) {
    console.error('Data Insights Error:', error);
    return [];
  }
};

// Helper functions for status mapping
const mapPolicyStatus = (status: string): 'Active' | 'Pending' | 'Draft' | 'Error' => {
  switch (status) {
    case 'ACTIVE': return 'Active';
    case 'PENDING': return 'Pending';
    case 'DRAFT': return 'Draft';
    case 'ERROR': return 'Error';
    default: return 'Draft';
  }
};

const mapImpactLevel = (level: string): 'High' | 'Medium' | 'Low' => {
  switch (level) {
    case 'HIGH': return 'High';
    case 'MEDIUM': return 'Medium';
    case 'LOW': return 'Low';
    default: return 'Medium';
  }
};

const mapConnectionStatus = (status: string): 'Healthy' | 'Warning' | 'Error' => {
  switch (status) {
    case 'HEALTHY': return 'Healthy';
    case 'WARNING': return 'Warning';
    case 'ERROR': return 'Error';
    default: return 'Warning';
  }
};

function HomePageDir() {
  const currentUser = useCurrentUser();
  const [kpis, setKpis] = useState<IDirectorDashboardKpis | null>(null);
  const [kpisError, setKpisError] = useState(false);
  const [policyOverview, setPolicyOverview] = useState<IPolicyOverviewItem[]>([]);
  const [technicalStatus, setTechnicalStatus] = useState<ITechnicalStatusItem[]>([]);
  const [dataInsights, setDataInsights] = useState<IDataInsight[]>([]);
  const [notifications, setNotifications] = useState<ActionItem[]>([]);
  const [notificationsFailed, setNotificationsFailed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'policy' | 'technical' | 'insights'>('policy');
  const notificationsRef = useRef<HTMLDivElement>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setKpisError(false);

      const [kpisData, policyData, statusData, insightsData, actionItemsData] = await Promise.all([
        fetchDirectorKpis(),
        fetchPolicyOverview(),
        fetchTechnicalStatus(),
        fetchDataInsights(),
        getActionItems().catch(() => null)
      ]);

      if (kpisData === null) setKpisError(true);
      setKpis(kpisData);
      setPolicyOverview(policyData);
      setTechnicalStatus(statusData);
      setDataInsights(insightsData);
      setNotifications(actionItemsOf(actionItemsData));
      setNotificationsFailed(actionItemsData === null || actionItemsFailed(actionItemsData));
    } catch (error) {
      console.error('Failed to load Director dashboard data:', error);
      setKpisError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Close the notifications dropdown on outside click.
  useEffect(() => {
    if (!notificationsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [notificationsOpen]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Active': case 'Healthy': return 'success';
      case 'Warning': return 'warning';
      case 'Pending': case 'Draft': return 'neutral';
      case 'Error': return 'error';
      default: return 'neutral';
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'Labeling': return 'brand';
      case 'Archival': return 'warning';
      case 'Deletion': return 'error';
      case 'Compliance': return 'neutral';
      default: return 'neutral';
    }
  };

  const getImpactBadgeVariant = (impact: string) => {
    switch (impact) {
      case 'High': return 'error';
      case 'Medium': return 'warning';
      case 'Low': return 'success';
      default: return 'neutral';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <FeatherTrendingUp />;
      case 'down': return <FeatherAlertTriangle />;
      case 'stable': return <FeatherCheck />;
      default: return <FeatherCheck />;
    }
  };

  const getTrendVariant = (trend: string) => {
    switch (trend) {
      case 'up': return 'success';
      case 'down': return 'error';
      case 'stable': return 'neutral';
      default: return 'neutral';
    }
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-body font-body text-subtext-color">Loading dashboard...</div>
        </div>
      </DefaultPageLayout>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'policy':
        if (policyOverview.length === 0) {
          return <EmptyState title="No policies found" message="No governance policies are configured yet." />;
        }
        return (
          <div className="flex w-full flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background shadow-sm">
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Policy Name</Table.HeaderCell>
                  <Table.HeaderCell>Type</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Teams Affected</Table.HeaderCell>
                  <Table.HeaderCell>Impact</Table.HeaderCell>
                  <Table.HeaderCell>Last Updated</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {policyOverview.map((policy) => (
                <Table.Row key={policy.id}>
                  <Table.Cell>
                    <span className="text-body-bold font-body-bold text-default-font">
                      {policy.name}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {policy.type ? (
                      <Badge variant={getTypeBadgeVariant(policy.type)}>{policy.type}</Badge>
                    ) : (
                      <span className="text-body font-body text-subtext-color">-</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={getStatusBadgeVariant(policy.status)} icon={policy.status === 'Active' ? <FeatherCheck /> : <FeatherClock />}>
                      {policy.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {policy.teamsAffected !== null ? `${policy.teamsAffected} teams` : '-'}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {policy.impactLevel ? (
                      <Badge variant={getImpactBadgeVariant(policy.impactLevel)}>
                        {policy.impactLevel}
                      </Badge>
                    ) : (
                      <span className="text-body font-body text-subtext-color">-</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {policy.lastUpdated || '-'}
                    </span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          </div>
        );

      case 'technical':
        if (technicalStatus.length === 0) {
          return <EmptyState title="No connection health data" message="No cloud connections or lifecycle services are reporting status yet." />;
        }
        return (
          <div className="flex w-full flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background shadow-sm">
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Component</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Uptime</Table.HeaderCell>
                  <Table.HeaderCell>Last Check</Table.HeaderCell>
                  <Table.HeaderCell>Action Required</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {technicalStatus.map((item) => (
                <Table.Row key={item.id}>
                  <Table.Cell>
                    <span className="text-body-bold font-body-bold text-default-font">
                      {item.component}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={getStatusBadgeVariant(item.status)} icon={
                      item.status === 'Healthy' ? <FeatherCheckCircle /> :
                      item.status === 'Warning' ? <FeatherAlertTriangle /> :
                      <FeatherWifiOff />
                    }>
                      {item.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {item.uptime || '-'}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {formatDate(item.lastCheck)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {item.actionRequired ? (
                      <Button
                        variant="brand-tertiary"
                        size="small"
                        onClick={() => window.navigateToAdminControlHub?.()}
                      >
                        Fix Issue
                      </Button>
                    ) : (
                      <span className="text-body font-body text-success-600">No action needed</span>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          </div>
        );

      case 'insights':
        if (dataInsights.length === 0) {
          return <EmptyState title="No insights available" message="Governance and cost data could not be loaded." />;
        }
        return (
          <div className="flex w-full flex-wrap items-start gap-4">
            {dataInsights.map((insight) => (
              <div key={insight.id} className="flex min-w-[280px] grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <div className="flex w-full items-center justify-between">
                  <span className="text-body-bold font-body-bold text-default-font">
                    {insight.title}
                  </span>
                  <IconWithBackground
                    variant={getTrendVariant(insight.trend)}
                    icon={getTrendIcon(insight.trend)}
                  />
                </div>
                <span className="text-heading-2 font-heading-2 text-brand-700">
                  {insight.value}
                </span>
                <span className="text-body font-body text-subtext-color">
                  {insight.description}
                </span>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        <div className="flex w-full items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <Avatar size="large">
              {(currentUser.name || currentUser.username || '?').charAt(0).toUpperCase()}
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Welcome{currentUser.name ? `, ${currentUser.name}` : ''}
              </span>
              <span className="text-body font-body text-subtext-color">
                Director Dashboard
              </span>
            </div>
          </div>
          <div className="relative" ref={notificationsRef}>
            <Button
              icon={<FeatherBell />}
              onClick={() => setNotificationsOpen((o) => !o)}
            >
              {notifications.length} {notifications.length === 1 ? 'Alert' : 'Alerts'}
            </Button>
            {notificationsOpen ? (
              <div className="absolute right-0 z-10 mt-2 flex w-96 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background p-4 shadow-lg">
                <span className="text-body-bold font-body-bold text-default-font">
                  Action Items
                </span>
                {notificationsFailed ? (
                  <span className="text-body font-body text-subtext-color">
                    Could not load action items.
                  </span>
                ) : notifications.length === 0 ? (
                  <span className="text-body font-body text-subtext-color">
                    No outstanding action items.
                  </span>
                ) : (
                  <div className="flex max-h-80 w-full flex-col items-start gap-2 overflow-auto">
                    {notifications.map((item, index) => (
                      <button
                        key={`${item.id ?? 'item'}-${index}`}
                        className="flex w-full flex-col items-start gap-1 rounded-md bg-neutral-50 px-3 py-2 text-left hover:bg-neutral-100"
                        onClick={() => {
                          setNotificationsOpen(false);
                          navigateForActionItem(item);
                        }}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-body-bold font-body-bold text-default-font">
                            {item.title || 'Untitled action item'}
                          </span>
                          <Badge variant={priorityBand(item.severity) === 'HIGH' ? 'error' : priorityBand(item.severity) === 'MEDIUM' ? 'warning' : 'neutral'}>
                            {item.severity || '-'}
                          </Badge>
                        </div>
                        <span className="text-caption font-caption text-subtext-color">
                          {item.description}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        
        <div className="flex w-full flex-col items-start gap-6 px-6 py-6 overflow-auto">
          {kpisError || !kpis ? (
            <ErrorState message="Could not load director dashboard metrics." onRetry={loadDashboardData} />
          ) : (
          <>
          {/* KPI Cards Row */}
          <div className="flex w-full flex-wrap items-start gap-4">
            {/* Active Data Policies Impacting My Teams */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  Active Policies
                </span>
                <IconWithBackground icon={<FeatherShieldCheck />} />
              </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">
                {kpis.activePolicies}
              </span>
              {kpis.activePoliciesGrowth ? (
                <Badge variant="success" icon={<FeatherTrendingUp />}>
                  {kpis.activePoliciesGrowth}
                </Badge>
              ) : null}
            </div>

            {/* Recently Discovered Datasets (Last 7 Days) */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  New Datasets
                </span>
                <IconWithBackground
                  variant="success"
                  icon={<FeatherDatabase />}
                />
              </div>
              {kpis.recentDatasets !== null ? (
                <>
                  <span className="text-heading-1 font-heading-1 text-brand-700">
                    {kpis.recentDatasets}
                  </span>
                  <Badge icon={<FeatherClock />}>Last 7 days</Badge>
                </>
              ) : (
                <span className="text-heading-3 font-heading-3 text-subtext-color">
                  {NOT_AVAILABLE_YET}
                </span>
              )}
            </div>

            {/* Assets with Missing Business Metadata */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  Missing Metadata
                </span>
                <IconWithBackground
                  variant="warning"
                  icon={<FeatherAlertTriangle />}
                />
              </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">
                {kpis.missingMetadata}
              </span>
              <Badge variant="warning" icon={<FeatherAlertCircle />}>
                Needs attention
              </Badge>
            </div>

            {/* Status of Automated Policy Configurations */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  Policy Config Status
                </span>
                <IconWithBackground
                  variant="brand"
                  icon={<FeatherSettings />}
                />
              </div>
              {kpis.policyConfigStatus !== null ? (
                <span className="text-heading-1 font-heading-1 text-brand-700">
                  {kpis.policyConfigStatus}%
                </span>
              ) : (
                <span className="text-heading-3 font-heading-3 text-subtext-color">
                  {NOT_AVAILABLE_YET}
                </span>
              )}
              <Progress value={kpis.policyConfigStatus ?? 0} />
            </div>

            {/* Data Source Connection Health */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  Connection Health
                </span>
                <IconWithBackground
                  variant="success"
                  icon={<FeatherCheckCircle />}
                />
              </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">
                {kpis.connectionHealth}%
              </span>
              <Progress value={kpis.connectionHealth || 0} />
            </div>
          </div>

          {/* Tabs and Content Section */}
          <div className="flex w-full flex-col items-start gap-4">
            <Tabs>
              <Tabs.Item 
                active={activeTab === 'policy'} 
                onClick={() => setActiveTab('policy')}
              >
                Policy Overview
              </Tabs.Item>
              <Tabs.Item 
                active={activeTab === 'technical'} 
                onClick={() => setActiveTab('technical')}
              >
                Technical Status
              </Tabs.Item>
              <Tabs.Item 
                active={activeTab === 'insights'} 
                onClick={() => setActiveTab('insights')}
              >
                Data Insights
              </Tabs.Item>
            </Tabs>
            {renderTabContent()}
          </div>

          {/* Quick Actions */}
          <div className="flex w-full items-center gap-4">
            <Button
              icon={<FeatherList />}
              onClick={() => window.navigateToPolicyHub2?.()}
            >
              View Active Policies
            </Button>
            <Button
              variant="neutral-secondary"
              icon={<FeatherDatabase />}
              onClick={() => window.navigateToDataCatalog?.()}
            >
              Browse Data Estate
            </Button>
            <Button
              variant="neutral-secondary"
              icon={<FeatherGitBranch />}
              onClick={() => window.navigateToDataCatalog?.()}
            >
              Check Lineage
            </Button>
            <Button
              variant="neutral-secondary"
              icon={<FeatherSettings />}
              onClick={() => window.navigateToPlatformSettings?.()}
            >
              System Settings
            </Button>
          </div>
          </>
          )}
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default HomePageDir; 