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
    FeatherArchive,
    FeatherBell,
    FeatherCheck,
    FeatherClock,
    FeatherDatabase,
    FeatherExternalLink,
    FeatherRefreshCw,
    FeatherSearch,
    FeatherShield,
    FeatherTag,
    FeatherTrendingUp
} from "@subframe/core";
import { useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Avatar } from "../ui/components/Avatar";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Table } from "../ui/components/Table";
import { TextField } from "../ui/components/TextField";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";

// Import our new API services
import { useCurrentUser } from "../utils/currentUser";
import {
    getDataEngineerKpis,
    getDataTasks,
    getPolicyNotifications,
    getWatchedDatasets
} from "../utils/apiServices";

// Types for dashboard data (aligned with API responses)
interface IDataEngineerKpis {
  newRelevantDatasets: number;
  recentlyLabeled: number;
  flaggedForArchival: number;
  newRelevantDatasetsGrowth: string;
  recentlyLabeledPeriod: string;
  archivalImpactLevel: 'high' | 'medium' | 'low';
  personalTasks: number;
  watchedAssets: number;
}

interface IWatchedDataset {
  id: string;
  name: string;
  description: string;
  labels: string[];
  lastAccessed: string;
  lineageStatus: 'Validated' | 'Needs Review' | 'Missing' | 'Processing';
  dataType: string;
  size: string;
  usage: 'high' | 'medium' | 'low';
  isWatched?: boolean;
}

interface IDataTask {
  id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate: string;
  type: 'quality' | 'lineage' | 'pipeline' | 'governance';
  assignee?: string;
  progress: number;
  assetId?: string;
}

interface IPolicyNotification {
  id: string;
  policyName: string;
  type: 'new' | 'updated' | 'violation' | 'impact';
  message: string;
  affectedDatasets: string[];
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
  actionRequired: boolean;
}

// Real API functions using our Data Engineer-specific endpoints.
// Returns null on failure so the page can render an ErrorState rather than
// fabricated KPI numbers (CLAUDE.md §9). userId is the real Keycloak subject.
const fetchDataEngineerKpis = async (userId: string): Promise<IDataEngineerKpis | null> => {
  try {
    const engineerData = await getDataEngineerKpis(userId);

    return {
      newRelevantDatasets: engineerData.newRelevantDatasets,
      recentlyLabeled: engineerData.recentlyLabeled,
      flaggedForArchival: engineerData.flaggedForArchival,
      newRelevantDatasetsGrowth: engineerData.newRelevantDatasetsGrowth,
      recentlyLabeledPeriod: engineerData.recentlyLabeledPeriod,
      archivalImpactLevel: engineerData.archivalImpactLevel,
      personalTasks: engineerData.personalTasks,
      watchedAssets: engineerData.watchedAssets,
    };
  } catch (error) {
    console.error('Data Engineer KPIs Error:', error);
    return null;
  }
};

const fetchWatchedDatasets = async (userId: string): Promise<IWatchedDataset[]> => {
  try {
    const watchedData = await getWatchedDatasets(userId);

    return watchedData.map(dataset => ({
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      labels: dataset.labels,
      lastAccessed: dataset.lastAccessed,
      lineageStatus: mapLineageStatus(dataset.lineageStatus),
      dataType: dataset.dataType,
      size: dataset.size,
      usage: dataset.usage,
      isWatched: dataset.isWatched,
    }));
  } catch (error) {
    console.error('❌ Watched Datasets Error:', error);
    return [];
  }
};

const fetchDataTasks = async (userId: string): Promise<IDataTask[]> => {
  try {
    const tasksData = await getDataTasks(userId);

    return tasksData.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      type: task.type,
      assignee: task.assignee,
      progress: task.progress,
      assetId: task.assetId,
    }));
  } catch (error) {
    console.error('❌ Data Tasks Error:', error);
    return [];
  }
};

const fetchPolicyNotifications = async (userId: string): Promise<IPolicyNotification[]> => {
  try {
    const notificationsData = await getPolicyNotifications(userId);

    return notificationsData.map(notification => ({
      id: notification.id,
      policyName: notification.policyName,
      type: notification.type,
      message: notification.message,
      affectedDatasets: notification.affectedDatasets,
      severity: notification.severity,
      timestamp: notification.timestamp,
      actionRequired: notification.actionRequired,
    }));
  } catch (error) {
    console.error('Policy Notifications Error:', error);
    return [];
  }
};

// Helper functions for status mapping
const mapLineageStatus = (status: string): 'Validated' | 'Needs Review' | 'Missing' | 'Processing' => {
  switch (status) {
    case 'VALIDATED': return 'Validated';
    case 'NEEDS_REVIEW': return 'Needs Review';
    case 'MISSING': return 'Missing';
    case 'PROCESSING': return 'Processing';
    default: return 'Missing';
  }
};

function DataEngineerDashboard() {
  const currentUser = useCurrentUser();
  const [kpis, setKpis] = useState<IDataEngineerKpis | null>(null);
  const [kpisError, setKpisError] = useState(false);
  const [watchedDatasets, setWatchedDatasets] = useState<IWatchedDataset[]>([]);
  const [dataTasks, setDataTasks] = useState<IDataTask[]>([]);
  const [policyNotifications, setPolicyNotifications] = useState<IPolicyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setKpisError(false);
      const userId = currentUser.id;

      const [kpisData, watchedData, tasksData, notificationsData] = await Promise.all([
        fetchDataEngineerKpis(userId),
        fetchWatchedDatasets(userId),
        fetchDataTasks(userId),
        fetchPolicyNotifications(userId)
      ]);

      if (kpisData === null) setKpisError(true);
      setKpis(kpisData);
      setWatchedDatasets(watchedData);
      setDataTasks(tasksData);
      setPolicyNotifications(notificationsData);
    } catch (error) {
      console.error('Failed to load Data Engineer dashboard data:', error);
      setKpisError(true);
    } finally {
      setLoading(false);
    }
  };

  // Reload once the authenticated identity resolves (userId drives the queries).
  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

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

  const getLineageStatusVariant = (status: string) => {
    switch (status) {
      case 'Validated': return 'success';
      case 'Processing': return 'neutral';
      case 'Needs Review': return 'warning';
      case 'Missing': return 'error';
      default: return 'neutral';
    }
  };

  const getLineageStatusIcon = (status: string) => {
    switch (status) {
      case 'Validated': return <FeatherCheck />;
      case 'Processing': return <FeatherRefreshCw />;
      case 'Needs Review': return <FeatherAlertTriangle />;
      case 'Missing': return <FeatherAlertCircle />;
      default: return <FeatherCheck />;
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'neutral';
      case 'low': return 'success';
      default: return 'neutral';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <FeatherAlertCircle />;
      case 'high': return <FeatherAlertTriangle />;
      case 'medium': return <FeatherClock />;
      case 'low': return <FeatherCheck />;
      default: return <FeatherClock />;
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'neutral';
      default: return 'neutral';
    }
  };

  const getLabelVariant = (label: string) => {
    switch (label.toLowerCase()) {
      case 'pii': case 'financial': case 'confidential': return 'error';
      case 'compliance': case 'regulatory': case 'legal': return 'warning';
      case 'operational': case 'business': return 'brand';
      case 'analytics': case 'behavioral': return 'success';
      default: return 'neutral';
    }
  };

  const handleSearch = () => {
    // Data Catalog owns its own search box (internal state, not URL-driven), so
    // stash the query as a hint and navigate. If DataCatalog later reads this
    // key it can prefill; otherwise the user lands on the catalog to search.
    const q = searchQuery.trim();
    if (q) {
      try {
        sessionStorage.setItem('dataCatalogSearchQuery', q);
      } catch {
        /* sessionStorage unavailable — navigate anyway */
      }
    }
    window.navigateToDataCatalog?.();
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
                Data Engineer Workspace
              </span>
            </div>
          </div>
          <div className="relative" ref={notificationsRef}>
            <Button
              icon={<FeatherBell />}
              onClick={() => setNotificationsOpen((o) => !o)}
            >
              {policyNotifications.length} {policyNotifications.length === 1 ? 'Notification' : 'Notifications'}
            </Button>
            {notificationsOpen ? (
              <div className="absolute right-0 z-10 mt-2 flex w-96 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background p-4 shadow-lg">
                <span className="text-body-bold font-body-bold text-default-font">
                  Policy Notifications
                </span>
                {policyNotifications.length === 0 ? (
                  <span className="text-body font-body text-subtext-color">
                    No policy notifications.
                  </span>
                ) : (
                  <div className="flex max-h-80 w-full flex-col items-start gap-2 overflow-auto">
                    {policyNotifications.map((n) => (
                      <div
                        key={n.id}
                        className="flex w-full flex-col items-start gap-1 rounded-md bg-neutral-50 px-3 py-2"
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-body-bold font-body-bold text-default-font">
                            {n.policyName}
                          </span>
                          <Badge variant={getSeverityVariant(n.severity)}>{n.type}</Badge>
                        </div>
                        <span className="text-caption font-caption text-subtext-color">
                          {n.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-6 px-6 py-6 overflow-auto">
          {/* Quick Search Section */}
        <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
          <span className="text-body-bold font-body-bold text-default-font">
            Quick Search Data Estate
          </span>
            <div className="flex w-full gap-2">
          <TextField
            className="h-auto w-full flex-none"
            variant="filled"
            label=""
            helpText=""
            icon={<FeatherSearch />}
          >
            <TextField.Input
              placeholder="Search by keywords, labels, or business terms..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyPress={(event) => {
                    if (event.key === 'Enter') {
                      handleSearch();
                    }
                  }}
            />
          </TextField>
              <Button onClick={handleSearch}>
                Search
              </Button>
            </div>
        </div>

          {/* KPI Cards Row */}
        {kpisError || !kpis ? (
          <ErrorState message="Could not load your workspace metrics." onRetry={loadDashboardData} />
        ) : (
        <div className="flex w-full flex-wrap items-start gap-4">
            {/* New Datasets Discovered (Matching Interests/Projects) */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  New Relevant Datasets
                </span>
              <IconWithBackground icon={<FeatherDatabase />} />
            </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">
                {kpis.newRelevantDatasets}
            </span>
            {kpis.newRelevantDatasetsGrowth ? (
              <Badge variant="success" icon={<FeatherTrendingUp />}>
                {kpis.newRelevantDatasetsGrowth}
              </Badge>
            ) : null}
          </div>

            {/* Data Assets Recently Labeled/Governed */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  Recently Labeled
                </span>
              <IconWithBackground variant="success" icon={<FeatherTag />} />
              </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">
                {kpis.recentlyLabeled}
              </span>
              {kpis.recentlyLabeledPeriod ? (
                <Badge icon={<FeatherClock />}>
                  {kpis.recentlyLabeledPeriod}
                </Badge>
              ) : null}
            </div>

            {/* Data Flagged for Archival/Deletion Impacting Workflows */}
            <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                  Flagged for Archival
            </span>
                <IconWithBackground variant="warning" icon={<FeatherArchive />} />
          </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">
                {kpis.flaggedForArchival}
            </span>
            <Badge variant="warning" icon={<FeatherAlertCircle />}>
              Affects your workflows
            </Badge>
          </div>
        </div>
        )}

          {/* Main Content Grid */}
          <div className="flex w-full flex-wrap items-start gap-6">
            {/* My Watched/Recently Used Datasets */}
            <div className="flex min-w-[600px] grow shrink-0 basis-0 flex-col items-start gap-4">
              <div className="flex w-full items-center justify-between">
          <span className="text-body-bold font-body-bold text-default-font">
            My Watched Datasets
          </span>
                <Button
                  variant="neutral-tertiary"
                  onClick={() => window.navigateToDataCatalog?.()}
                >
                  View All
                </Button>
              </div>
          {watchedDatasets.length === 0 ? (
            <EmptyState
              title="No watched datasets yet"
              message="Datasets you watch or recently use will appear here. Browse the Data Estate to get started."
            />
          ) : (
          <div className="flex w-full flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background shadow-sm">
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Dataset Name</Table.HeaderCell>
                  <Table.HeaderCell>Labels</Table.HeaderCell>
                  <Table.HeaderCell>Last Accessed</Table.HeaderCell>
                  <Table.HeaderCell>Lineage Status</Table.HeaderCell>
                      <Table.HeaderCell>Actions</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
                  {watchedDatasets.map((dataset) => (
                    <Table.Row key={dataset.id}>
                <Table.Cell>
                        <div className="flex flex-col items-start">
                  <span className="text-body-bold font-body-bold text-default-font">
                            {dataset.name}
                          </span>
                          <span className="text-caption font-caption text-subtext-color">
                            {dataset.dataType} • {dataset.size}
                  </span>
                        </div>
                </Table.Cell>
                <Table.Cell>
                        <div className="flex flex-wrap gap-1">
                          {dataset.labels.map((label, index) => (
                            <Badge
                              key={index}
                              variant={getLabelVariant(label)}
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                </Table.Cell>
                <Table.Cell>
                        <span className="text-body font-body text-subtext-color">
                          {dataset.lastAccessed}
                  </span>
                </Table.Cell>
                <Table.Cell>
                        <Badge
                          variant={getLineageStatusVariant(dataset.lineageStatus)}
                          icon={getLineageStatusIcon(dataset.lineageStatus)}
                        >
                          {dataset.lineageStatus}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                        <Button
                          variant="neutral-tertiary"
                          size="small"
                          icon={<FeatherExternalLink />}
                          onClick={() => window.navigateToDataCatalog?.()}
                        >
                          View
                        </Button>
                </Table.Cell>
              </Table.Row>
                  ))}
            </Table>
          </div>
          )}
        </div>

            {/* Data Engineering Tasks */}
            <div className="flex min-w-[400px] flex-none flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background p-6 shadow-sm">
              <div className="flex w-full items-center justify-between">
            <span className="text-body-bold font-body-bold text-default-font">
              Data Engineering Tasks
            </span>
                <Badge variant="error">{dataTasks.filter(t => t.priority === 'urgent').length} urgent</Badge>
              </div>
              <div className="flex w-full flex-col items-start gap-3">
                {dataTasks.length === 0 ? (
                  <span className="text-body font-body text-subtext-color">
                    No tasks assigned right now.
                  </span>
                ) : null}
                {dataTasks.map((task) => (
                  <div key={task.id} className="flex w-full items-center gap-3 rounded-md bg-neutral-50 px-4 py-3">
                    <IconWithBackground
                      variant={getPriorityVariant(task.priority)}
                      icon={getPriorityIcon(task.priority)}
                    />
              <div className="flex grow flex-col items-start">
                <span className="text-body-bold font-body-bold text-default-font">
                        {task.title}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {task.description}
                </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {task.dueDate}
                </span>
                    </div>
                    <Badge variant={getPriorityVariant(task.priority)}>
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Policy Impact Notifications */}
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center justify-between">
              <span className="text-body-bold font-body-bold text-default-font">
                Policy Impact Notifications
              </span>
              <Badge variant="warning">{policyNotifications.filter(n => n.actionRequired).length} require action</Badge>
            </div>
            {policyNotifications.length === 0 ? (
              <span className="text-body font-body text-subtext-color">
                No policy impact notifications.
              </span>
            ) : (
            <div className="flex w-full flex-col items-start gap-2">
              {policyNotifications.map((notification) => (
                <div key={notification.id} className="flex w-full items-center gap-4 rounded-md bg-neutral-50 px-4 py-4">
                  <IconWithBackground
                    variant={getSeverityVariant(notification.severity)}
                    icon={notification.severity === 'critical' ? <FeatherAlertCircle /> :
                          notification.severity === 'warning' ? <FeatherAlertTriangle /> :
                          <FeatherShield />}
                  />
              <div className="flex grow flex-col items-start">
                    <div className="flex items-center gap-2">
                <span className="text-body-bold font-body-bold text-default-font">
                        {notification.policyName}
                </span>
                      <Badge variant={getSeverityVariant(notification.severity)}>
                        {notification.type}
                      </Badge>
                    </div>
                <span className="text-body font-body text-subtext-color">
                      {notification.message}
                    </span>
                    {notification.affectedDatasets.length > 0 ? (
                      <span className="text-caption font-caption text-subtext-color">
                        Affects: {notification.affectedDatasets.join(', ')}
                      </span>
                    ) : null}
              </div>
                  {notification.actionRequired && (
                    <Button
                      variant="brand-tertiary"
                      size="small"
                      onClick={() => window.navigateToPolicyHub2?.()}
                    >
                      Review
                    </Button>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default DataEngineerDashboard; 