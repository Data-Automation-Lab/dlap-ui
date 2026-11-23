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

import { FeatherAlertOctagon, FeatherAlertTriangle, FeatherBell, FeatherClock, FeatherDatabase, FeatherDollarSign, FeatherFileText, FeatherPieChart, FeatherPlus, FeatherShield, FeatherTrendingUp } from "@subframe/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Avatar } from "../ui/components/Avatar";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Progress } from "../ui/components/Progress";
import { Table } from "../ui/components/Table";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";

// Import our new API services
import { useCurrentUser } from "../utils/currentUser";
import { formatDate } from "../utils/safeDate";
import {
    ActionItem,
    ActionItemsResponse,
    NOT_AVAILABLE_YET,
    actionItemButtonText,
    actionItemsFailed,
    actionItemsOf,
    costFigure,
    getActionItems,
    getCostSavings,
    getGovernanceScore,
    getJobStatuses,
    governanceBreakdown,
    isComplianceItem,
    isNum,
    listPolicies,
    openActionItem,
    priorityBand
} from "../utils/apiServices";

/** One decimal place, or null when the value is missing. */
const oneDecimal = (value: number | null | undefined): number | null =>
  isNum(value) ? Math.round(value * 10) / 10 : null;

/** The action items request, shared so the page calls the endpoint once per load. */
type ActionItemsRequest = Promise<ActionItemsResponse | null>;

// Updated types for dashboard data using API response types
interface IDashboardKpis {
  /** Null when the governance score could not be computed. */
  governanceScore: number | null;
  activePolicies: number;
  /** Monthly dollar savings, or null while no billing source is connected. */
  costSavings: number | null;
  complianceAlerts: number;
  /** Null when the lineage component could not be computed. */
  dataLineageCoverage: number | null;
  costSavingsGrowth: string;
  complianceAlertsHigh: number;
}

interface IActionItem {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'error' | 'success';
  buttonText: string;
  action: () => void;
}

interface IPolicyActivity {
  id: string;
  name: string;
  type: string;
  status: 'Active' | 'Processing' | 'Draft' | 'Error';
  date: string;
}

// Real API functions. Returns null on failure so the page renders an
// ErrorState instead of fabricated KPI numbers (CLAUDE.md section 9).
const fetchDashboardKpis = async (actionsRequest: ActionItemsRequest): Promise<IDashboardKpis | null> => {
  try {
    const [governanceData, costData, policies, actionItems] = await Promise.all([
      getGovernanceScore(),
      getCostSavings(),
      listPolicies(),
      actionsRequest
    ]);
    if (!actionItems) {
      throw new Error('Action items request failed');
    }

    // Real active-policy count from the policy engine (ENABLED policies).
    const activePolicies = policies.filter(p => p.status === 'ENABLED').length;

    // Compliance alerts come from real action items, not a governance estimate.
    const complianceItems = actionItemsOf(actionItems).filter(isComplianceItem);
    const complianceAlerts = complianceItems.length;
    const complianceAlertsHigh = complianceItems.filter(i => priorityBand(i.severity) === 'HIGH').length;

    // Dollar figures are null until a billing source is connected.
    const monthly = costFigure(costData, costData.monthlySavingsRate);
    const total = costFigure(costData, costData.totalSavings);

    return {
      governanceScore: oneDecimal(governanceData.overallScore),
      activePolicies,
      costSavings: monthly,
      complianceAlerts,
      dataLineageCoverage: oneDecimal(governanceBreakdown(governanceData).lineageCoverageScore),
      // Real ratio of this month's savings to total-to-date. No historical
      // month-over-month series exists, so this is framed as a share, not a
      // fabricated "+X% from last month".
      costSavingsGrowth:
        monthly !== null && total !== null && total > 0
          ? `${((monthly / total) * 100).toFixed(1)}% of total savings`
          : '',
      complianceAlertsHigh,
    };
  } catch (error) {
    console.error('Failed to fetch dashboard KPIs:', error);
    return null;
  }
};

/** Action item widget rows, or null when the aggregation could not reach its source. */
const fetchActionItems = async (actionsRequest: ActionItemsRequest): Promise<IActionItem[] | null> => {
  try {
    const actionItemsData = await actionsRequest;
    if (!actionItemsData || actionItemsFailed(actionItemsData)) {
      return null;
    }

    return actionItemsOf(actionItemsData).map((item, index) => ({
      id: `${item.id ?? 'item'}-${index}`,
      title: item.title || 'Untitled action item',
      description: item.description || '',
      type: priorityBand(item.severity) === 'HIGH' ? 'error' : priorityBand(item.severity) === 'MEDIUM' ? 'warning' : 'success',
      buttonText: actionItemButtonText(item),
      action: () => openActionItem(item, 'navigateToHome'),
    }));
  } catch (error) {
    console.error('Failed to fetch action items:', error);
    return null;
  }
};

const fetchPolicyActivity = async (): Promise<IPolicyActivity[]> => {
  try {
    // Fetch from job statuses to get recent policy activity
    const jobData = await getJobStatuses();
    
    // Helper function to map job status to policy activity status
    const mapJobStatus = (jobStatus: string): 'Active' | 'Processing' | 'Draft' | 'Error' => {
      switch (jobStatus) {
        case 'SUCCESS': return 'Active';
        case 'RUNNING': return 'Processing';
        case 'PENDING': return 'Draft';
        case 'FAILED': return 'Error';
        default: return 'Error';
      }
    };
    
    // Transform job data to policy activity format
    return jobData.services
      .filter(service => service.serviceName.toLowerCase().includes('policy'))
      .map((service, index) => ({
        id: `policy-${index}`,
        name: `Policy Engine ${service.serviceName}`,
        type: 'Policy Management',
        status: mapJobStatus(service.lastJobStatus),
        date: formatDate(service.lastJobTime),
      }))
      .slice(0, 5); // Limit to 5 items
  } catch (error) {
    console.error('Failed to fetch policy activity:', error);
    return [];
  }
};

function HomePageCdo() {
  const currentUser = useCurrentUser();
  const [kpis, setKpis] = useState<IDashboardKpis | null>(null);
  const [kpisError, setKpisError] = useState(false);
  const [actionItems, setActionItems] = useState<IActionItem[]>([]);
  const [actionItemsError, setActionItemsError] = useState(false);
  const [policyActivity, setPolicyActivity] = useState<IPolicyActivity[]>([]);
  const [notifications, setNotifications] = useState<ActionItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setKpisError(false);

      // One request feeds the KPIs, the widget and the notification menu.
      const actionsRequest: ActionItemsRequest = getActionItems().catch(() => null);
      const [kpisData, actionItemsData, policyActivityData, rawActionItems] = await Promise.all([
        fetchDashboardKpis(actionsRequest),
        fetchActionItems(actionsRequest),
        fetchPolicyActivity(),
        actionsRequest,
      ]);

      if (kpisData === null) setKpisError(true);
      setKpis(kpisData);
      setActionItems(actionItemsData ?? []);
      setActionItemsError(actionItemsData === null);
      setPolicyActivity(policyActivityData);
      setNotifications(actionItemsOf(rawActionItems));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
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

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount);
  }, []);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Processing': return 'neutral';
      case 'Draft': return 'warning';
      case 'Error': return 'error';
      default: return 'neutral';
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'Labeling': return 'brand';
      case 'Archival': return 'warning';
      case 'Compliance': return 'error';
      case 'Deletion': return 'neutral';
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
                Chief Data Officer Dashboard
              </span>
            </div>
          </div>
          <div className="relative" ref={notificationsRef}>
            <Button
              icon={<FeatherBell />}
              onClick={() => setNotificationsOpen((o) => !o)}
            >
              {notifications.length} {notifications.length === 1 ? 'Notification' : 'Notifications'}
            </Button>
            {notificationsOpen ? (
              <div className="absolute right-0 z-10 mt-2 flex w-96 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background p-4 shadow-lg">
                <span className="text-body-bold font-body-bold text-default-font">
                  Action Items
                </span>
                {actionItemsError ? (
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
                          openActionItem(item, 'navigateToHome');
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
            <ErrorState message="Could not load CDO dashboard metrics." onRetry={loadDashboardData} />
          ) : (
          <>
          {/* KPI Cards Row */}
          <div className="flex w-full flex-wrap items-start gap-4">
            {/* Overall Data Governance Score */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  Governance Score
                </span>
                <IconWithBackground
                  variant="success"
                  icon={<FeatherShield />}
                />
              </div>
              {kpis.governanceScore !== null ? (
                <span className="text-heading-1 font-heading-1 text-brand-700">
                  {kpis.governanceScore}%
                </span>
              ) : (
                <span className="text-heading-3 font-heading-3 text-subtext-color">
                  {NOT_AVAILABLE_YET}
                </span>
              )}
              <Progress value={kpis.governanceScore ?? 0} />
            </div>

            {/* Active Automated Policies */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  Active Policies
                </span>
                <IconWithBackground icon={<FeatherFileText />} />
              </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">
                {kpis.activePolicies}
              </span>
            </div>

            {/* Estimated Monthly Cost Savings */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  Cost Savings
                </span>
                <IconWithBackground
                  variant="success"
                  icon={<FeatherDollarSign />}
                />
              </div>
              {kpis.costSavings !== null ? (
                <span className="text-heading-1 font-heading-1 text-brand-700">
                  {formatCurrency(kpis.costSavings)}
                </span>
              ) : (
                <span className="text-heading-3 font-heading-3 text-subtext-color">
                  {NOT_AVAILABLE_YET}
                </span>
              )}
              {kpis.costSavingsGrowth ? (
                <span className="text-caption font-caption text-success-600">
                  {kpis.costSavingsGrowth}
                </span>
              ) : null}
            </div>

            {/* Critical Compliance Alerts */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  Compliance Alerts
                </span>
                <IconWithBackground
                  variant="warning"
                  icon={<FeatherAlertTriangle />}
                />
              </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">
                {kpis.complianceAlerts}
              </span>
              <span className="text-caption font-caption text-warning-600">
                {kpis.complianceAlertsHigh} high priority
              </span>
            </div>

            {/* Data Lineage Coverage */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  Lineage Coverage
                </span>
                <IconWithBackground
                  variant="brand"
                  icon={<FeatherTrendingUp />}
                />
              </div>
              {kpis.dataLineageCoverage !== null ? (
                <span className="text-heading-1 font-heading-1 text-brand-700">
                  {kpis.dataLineageCoverage}%
                </span>
              ) : (
                <span className="text-heading-3 font-heading-3 text-subtext-color">
                  {NOT_AVAILABLE_YET}
                </span>
              )}
              <Progress value={kpis.dataLineageCoverage ?? 0} />
            </div>
          </div>

          {/* Action Items and Quick Actions Row */}
          <div className="flex w-full flex-wrap items-start gap-6">
            {/* Action Items Widget */}
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center justify-between">
                <span className="text-body-bold font-body-bold text-default-font">
                  Action Items
                </span>
                {actionItemsError ? null : <Badge variant="error">{actionItems.length} pending</Badge>}
              </div>
              <div className="flex w-full flex-col items-start gap-2">
                {actionItemsError ? (
                  <ErrorState message="Could not load action items from the reporting service." onRetry={loadDashboardData} />
                ) : actionItems.length === 0 ? (
                  <span className="text-body font-body text-subtext-color">
                    No action items right now.
                  </span>
                ) : null}
                {actionItems.map((item) => (
                  <div key={item.id} className="flex w-full items-center gap-4 rounded-md bg-neutral-50 px-4 py-4">
                  <IconWithBackground
                      variant={item.type}
                      icon={item.type === 'warning' ? <FeatherClock /> : <FeatherAlertOctagon />}
                  />
                  <div className="flex grow shrink-0 basis-0 flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                        {item.title}
                    </span>
                    <span className="text-body font-body text-subtext-color">
                        {item.description}
                    </span>
                  </div>
                  <Button
                    variant="brand-tertiary"
                      onClick={item.action}
                  >
                      {item.buttonText}
                  </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Access Links/Actions */}
            <div className="flex w-72 flex-none flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <span className="text-body-bold font-body-bold text-default-font">
                Quick Actions
              </span>
              <div className="flex w-full flex-col items-start gap-2">
                <Button
                  className="h-8 w-full flex-none"
                  icon={<FeatherPlus />}
                  onClick={() => window.navigateToPolicyWizardFlow?.()}
                >
                  Create New Policy
                </Button>
                <Button
                  className="h-8 w-full flex-none"
                  variant="neutral-primary"
                  icon={<FeatherPieChart />}
                  onClick={() => window.navigateToReportingInsightsHub?.()}
                >
                  View Reports
                </Button>
                <Button
                  className="h-8 w-full flex-none"
                  variant="neutral-primary"
                  icon={<FeatherDatabase />}
                  onClick={() => window.navigateToDataCatalog?.()}
                >
                  Data Estate
                </Button>
              </div>
            </div>
          </div>

          {/* Recent Policy Activity Widget */}
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center justify-between">
            <span className="text-body-bold font-body-bold text-default-font">
              Recent Policy Activity
            </span>
              <Button
                variant="neutral-tertiary"
                onClick={() => window.navigateToPolicyHub2?.()}
              >
                View All
              </Button>
            </div>
            {policyActivity.length === 0 ? (
              <EmptyState title="No recent policy activity" message="No policy-engine jobs have run recently." />
            ) : (
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>Policy</Table.HeaderCell>
                    <Table.HeaderCell>Type</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Date</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {policyActivity.map((policy) => (
                  <Table.Row key={policy.id}>
                  <Table.Cell>
                    <span className="text-body-bold font-body-bold text-default-font">
                        {policy.name}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                      <Badge variant={getTypeBadgeVariant(policy.type)}>{policy.type}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                      <Badge variant={getStatusBadgeVariant(policy.status)}>{policy.status}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                        {policy.date}
                    </span>
                  </Table.Cell>
                </Table.Row>
                ))}
              </Table>
            )}
          </div>
          </>
          )}
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default HomePageCdo; 