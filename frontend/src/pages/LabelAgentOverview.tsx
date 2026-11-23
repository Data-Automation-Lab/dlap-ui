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
  FeatherBrain,
  FeatherCheckCircle,
  FeatherClock,
  FeatherEdit,
  FeatherPercent,
  FeatherPlay,
  FeatherRefreshCw,
  FeatherSettings,
  FeatherTag,
  FeatherTrendingUp,
  FeatherZap
} from "@subframe/core";
import { useEffect, useState } from "react";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Progress } from "../ui/components/Progress";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { EmptyState, ErrorState } from "../components/EmptyState";
import {
  getLabelAgentKpis,
  getRecentLabelActivities,
  getRuleActivities,
  getTopAppliedLabels,
  LabelAgentKpis,
  RecentLabelActivity,
  RuleActivity,
  TopAppliedLabel,
  triggerLabelingRun
} from "../utils/apiServices";

function LabelAgentOverview() {
  // State management
  const [kpis, setKpis] = useState<LabelAgentKpis | null>(null);
  const [topLabels, setTopLabels] = useState<TopAppliedLabel[]>([]);
  const [ruleActivities, setRuleActivities] = useState<RuleActivity[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentLabelActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Real API integration functions
  const fetchLabelAgentData = async () => {
    try {
      console.log('🏷️ Loading SmartLabel Agent data from real APIs...');
      setError(null);
      
      const [kpisData, topLabelsData, ruleActivitiesData, recentActivitiesData] = await Promise.all([
        getLabelAgentKpis(),
        getTopAppliedLabels(),
        getRuleActivities(),
        getRecentLabelActivities()
      ]);

      setKpis(kpisData);
      setTopLabels(topLabelsData);
      setRuleActivities(ruleActivitiesData);
      setRecentActivities(recentActivitiesData);

      console.log('✅ SmartLabel Agent data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading SmartLabel Agent data:', error);
      // No fabricated fallback: surface the failure so the page can render an
      // ErrorState instead of misleading canned numbers (CLAUDE.md §9).
      setKpis(null);
      setTopLabels([]);
      setRuleActivities([]);
      setRecentActivities([]);
      setError('Failed to load SmartLabel Agent data. Please try again.');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchLabelAgentData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleTriggerLabeling = async () => {
    setTriggering(true);
    setError(null);
    try {
      // Real POST /api/v1/label-agent/trigger-labeling via triggerLabelingRun.
      const success = await triggerLabelingRun();
      if (!success) {
        throw new Error('Failed to trigger labeling run');
      }
      // Refetch so the dashboard reflects the newly-triggered run.
      await fetchLabelAgentData();
    } catch (error) {
      console.error('❌ Error triggering labeling run:', error);
      setError('Failed to trigger labeling run. Please try again.');
    } finally {
      setTriggering(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await fetchLabelAgentData();
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Helper functions
  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'neutral' => {
    switch (status) {
      case 'Success': return 'success';
      case 'Warning': return 'warning';
      case 'Failed': return 'error';
      default: return 'neutral';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'ML Model': return <FeatherBrain className="h-3 w-3" />;
      case 'Rule-Based': return <FeatherSettings className="h-3 w-3" />;
      case 'Manual': return <FeatherEdit className="h-3 w-3" />;
      default: return <FeatherTag className="h-3 w-3" />;
    }
  };

  const getCategoryColor = (category: string): string => {
    const colorMap: Record<string, string> = {
      'Security': '#ef4444',
      'Classification': '#3b82f6',
      'Domain': '#10b981',
      'Status': '#84cc16',
      'PII': '#ef4444',
      'Financial': '#f59e0b',
      'Customer Data': '#10b981',
      'Temporary': '#6b7280'
    };
    return colorMap[category] || '#8b5cf6';
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FeatherRefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-neutral-400" />
            <p className="text-body font-body text-subtext-color">Loading SmartLabel Agent...</p>
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6">
        {/* Header Section */}
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-3">
              <IconWithBackground size="large" icon={<FeatherTag />} />
              <div className="flex flex-col items-start">
                <span className="text-heading-2 font-heading-2 text-default-font">
                  SmartLabel Agent
                </span>
                <span className="text-caption font-caption text-subtext-color">
                  AI-powered data labeling and classification
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="neutral-secondary"
              size="medium"
              icon={<FeatherRefreshCw />}
              loading={refreshing}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            <Button
              variant="brand-primary"
              size="medium"
              icon={<FeatherPlay />}
              loading={triggering}
              onClick={handleTriggerLabeling}
            >
              Trigger Labeling
            </Button>
          </div>
        </div>

        {/* Hard failure with no data: honest ErrorState instead of blank UI. */}
        {error && !kpis && (
          <ErrorState message={error} onRetry={handleRefresh} />
        )}

        {/* Non-fatal error while some data is present. */}
        {error && kpis && (
          <div className="w-full bg-warning-50 border border-warning-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <FeatherAlertCircle className="h-4 w-4 text-warning-600" />
              <span className="text-body font-body text-warning-800">{error}</span>
            </div>
          </div>
        )}

        {/* KPIs Grid */}
        {kpis && (
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-neutral-border bg-default-background p-6">
              <div className="flex w-full items-center justify-between">
                <IconWithBackground size="medium" icon={<FeatherTag />} />
                <div className="flex items-center gap-1">
                  <FeatherTrendingUp className="h-3 w-3 text-success-600" />
                  <span className="text-caption font-caption text-success-600">
                    +{kpis.appliedLabelsLast24h}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className="text-caption font-caption text-subtext-color">Total Labels Applied</span>
                <span className="text-heading-3 font-heading-3 text-default-font">
                  {kpis.appliedLabelsTotal.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-neutral-border bg-default-background p-6">
              <div className="flex w-full items-center justify-between">
                <IconWithBackground size="medium" icon={<FeatherBrain />} />
                <div className="flex items-center gap-1">
                  <FeatherPercent className="h-3 w-3 text-success-600" />
                  <span className="text-caption font-caption text-success-600">
                    {kpis.modelAccuracy}%
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className="text-caption font-caption text-subtext-color">ML Model Accuracy</span>
                <div className="flex items-center gap-2">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    {kpis.activeModels}
                  </span>
                  <span className="text-caption font-caption text-subtext-color">models</span>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-neutral-border bg-default-background p-6">
              <div className="flex w-full items-center justify-between">
                <IconWithBackground size="medium" icon={<FeatherSettings />} />
                <div className="flex items-center gap-1">
                  <FeatherCheckCircle className="h-3 w-3 text-success-600" />
                  <span className="text-caption font-caption text-success-600">
                    {kpis.rulePoliciesActive + kpis.mlPoliciesActive} active
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className="text-caption font-caption text-subtext-color">Active Policies</span>
                <div className="flex items-center gap-2">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    {kpis.rulePoliciesActive}
                  </span>
                  <span className="text-caption font-caption text-subtext-color">rules</span>
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    {kpis.mlPoliciesActive}
                  </span>
                  <span className="text-caption font-caption text-subtext-color">ML</span>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-neutral-border bg-default-background p-6">
              <div className="flex w-full items-center justify-between">
                <IconWithBackground size="medium" icon={<FeatherClock />} />
                <div className="flex items-center gap-1">
                  <FeatherZap className="h-3 w-3 text-brand-600" />
                  <span className="text-caption font-caption text-brand-600">
                    {kpis.averageProcessingTime}s avg
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className="text-caption font-caption text-subtext-color">Assets Processed Today</span>
                <div className="flex items-center gap-2">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    {kpis.assetsProcessedLast24h}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-caption font-caption text-subtext-color">
                      {((1 - kpis.errorRate / 100) * 100).toFixed(1)}% success
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Tabs */}
        <div className="flex w-full flex-1 flex-col items-start gap-4">
          <Tabs>
            <Tabs.Item active={true}>Recent Activities</Tabs.Item>
            <Tabs.Item>Top Applied Labels</Tabs.Item>
            <Tabs.Item>Rule Performance</Tabs.Item>
          </Tabs>

          {/* Tab Content - Activities */}
          <div className="flex w-full flex-col items-start gap-6">
            <div className="flex w-full flex-col items-start gap-4">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Recent Activities
              </span>
              {recentActivities.length === 0 ? (
                <EmptyState
                  title="No recent labeling activity"
                  message="No labels have been applied yet."
                />
              ) : (
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>Asset & Event</Table.HeaderCell>
                    <Table.HeaderCell>Labels Applied</Table.HeaderCell>
                    <Table.HeaderCell>Method</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Time</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {recentActivities.map((activity) => (
                  <Table.Row key={activity.id}>
                    <Table.Cell>
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-body-bold font-body-bold text-default-font">
                          {activity.assetName}
                        </span>
                        <span className="text-caption font-caption text-subtext-color">
                          {activity.event}
                        </span>
                        {activity.details && (
                          <span className="text-caption font-caption text-subtext-color">
                            {activity.details}
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap items-center gap-1">
                        {activity.labelsApplied.map((label, index) => (
                          <Badge key={index} variant="neutral">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        {getMethodIcon(activity.method)}
                        <span className="text-body font-body text-default-font">
                          {activity.method}
                        </span>
                        {activity.confidence && (
                          <span className="text-caption font-caption text-subtext-color">
                            ({activity.confidence}%)
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={getStatusVariant(activity.status)}>
                        {activity.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-caption font-caption text-subtext-color">
                        {activity.timestamp}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table>
              )}
            </div>

            {/* Tab Content - Top Labels */}
            <div className="flex w-full flex-col items-start gap-4">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Top Applied Labels
              </span>
              {topLabels.length === 0 ? (
                <EmptyState
                  title="No labels applied yet"
                  message="Top applied labels will appear here once the agent runs."
                />
              ) : (
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {topLabels.map((label, index) => (
                  <div
                    key={index}
                    className="flex w-full flex-col items-start gap-4 rounded-lg border border-neutral-border bg-default-background p-6"
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: label.color || getCategoryColor(label.category) }}
                        />
                        <span className="text-body-bold font-body-bold text-default-font">
                          {label.name}
                        </span>
                      </div>
                      <Badge variant="neutral">{label.category}</Badge>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-heading-2 font-heading-2 text-default-font">
                        {label.value.toLocaleString()}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        times applied
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>

            {/* Tab Content - Rule Performance */}
            <div className="flex w-full flex-col items-start gap-4">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Rule Performance
              </span>
              {ruleActivities.length === 0 ? (
                <EmptyState
                  title="No rule activity"
                  message="Rule performance will appear here once rules are triggered."
                />
              ) : (
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>Rule Name</Table.HeaderCell>
                    <Table.HeaderCell>Category</Table.HeaderCell>
                    <Table.HeaderCell>Hit Count</Table.HeaderCell>
                    <Table.HeaderCell>Success Rate</Table.HeaderCell>
                    <Table.HeaderCell>Assets Affected</Table.HeaderCell>
                    <Table.HeaderCell>Last Triggered</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {ruleActivities.map((rule, index) => (
                  <Table.Row key={index}>
                    <Table.Cell>
                      <span className="text-body-bold font-body-bold text-default-font">
                        {rule.ruleName}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="neutral">{rule.category}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-body font-body text-default-font">
                        {rule.hitCount.toLocaleString()}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={rule.successRate}
                          className="w-16"
                        />
                        <span className="text-body font-body text-default-font">
                          {rule.successRate}%
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-body font-body text-default-font">
                        {rule.assetsAffected}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-caption font-caption text-subtext-color">
                        {rule.lastTriggered}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table>
              )}
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default LabelAgentOverview;