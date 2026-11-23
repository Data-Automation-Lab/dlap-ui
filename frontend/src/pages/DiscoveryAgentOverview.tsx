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
    FeatherCheck,
    FeatherCheckCircle,
    FeatherClock,
    FeatherCloud,
    FeatherDatabase,
    FeatherPieChart,
    FeatherPlus,
    FeatherRefreshCw,
    FeatherSettings,
    FeatherTrendingUp,
    FeatherZap
} from "@subframe/core";
import { useEffect, useState } from "react";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { LineChart } from "../ui/components/LineChart";
import { Progress } from "../ui/components/Progress";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { ErrorState } from "../components/EmptyState";
import { formatDateOnly } from "../utils/safeDate";
import {
    getDiscoveryStats,
    getJobStatuses,
    getDiscoveryActivities,
    getDiscoveryTrends,
    getDataSources
} from "../utils/apiServices";
import { runDiscoveryScans, type ScanRunResult } from "../utils/discoveryApi";

// TypeScript interfaces for Discovery Agent data
interface IDiscoveryKpis {
  totalAssetsDiscovered: number;
  weeklyGrowth: number;
  newAssets24h: number;
  lastScanTime: string;
  dataSourcesConnected: number;
  totalDataSources: number;
  sourcesNeedingAttention: number;
  scanSuccessRate: number;
  averageScanTime: number;
  totalDataVolume: string;
}

interface IDiscoveryActivity {
  id: string;
  event: string;
  source: string;
  assetsNew: number;
  assetsUpdated: number;
  status: 'Success' | 'Partial' | 'Failed';
  timestamp: string;
  duration?: string;
  details?: string;
}

interface IDiscoveryTrend {
  date: string;
  totalAssets: number;
  newAssets: number;
  updatedAssets: number;
  dataVolume: number;
}

interface IDataSource {
  id?: string;               // cloud-connection id (present when the backend supplies it)
  name: string;
  // 'Not configured' added to match the shared IDataSource union in
  // utils/apiServices (da-discovery returns it for unconfigured providers).
  status: 'Connected' | 'Warning' | 'Error' | 'Not configured';
  assetsCount: number;
  lastScan: string;
}

function DiscoveryAgentOverview() {
  // State management
  const [kpis, setKpis] = useState<IDiscoveryKpis | null>(null);
  const [activities, setActivities] = useState<IDiscoveryActivity[]>([]);
  const [trends, setTrends] = useState<IDiscoveryTrend[]>([]);
  const [, setDataSources] = useState<IDataSource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Inline, non-blocking feedback for the manual-scan action. Replaces the
  // browser alert() dialogs used previously (CLAUDE.md §9: surface status
  // inline, never via browser popups).
  const [scanNotice, setScanNotice] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // Real API functions integrated with existing endpoints
  const fetchDiscoveryKpis = async (): Promise<IDiscoveryKpis> => {
    try {
      console.log('🔍 Fetching Discovery KPIs from real API...');
      const [statsResponse, jobStatuses, activitiesData, dataSourcesResponse] = await Promise.all([
        getDiscoveryStats(),
        getJobStatuses(),
        getDiscoveryActivities(),
        getDataSources()
      ]);

      console.log('Stats Response:', statsResponse);
      console.log('Job Statuses:', jobStatuses);
      console.log('Activities:', activitiesData);
      console.log('Data Sources:', dataSourcesResponse);

      // Calculate scan success rate from all job statuses
      let totalSuccessJobs = 0;
      let totalFailedJobs = 0;
      let totalRunningJobs = 0;

      // Sum up all job counts from all services
      if (Array.isArray(jobStatuses)) {
        jobStatuses.forEach(service => {
          if (service.jobCount) {
            totalSuccessJobs += service.jobCount.success || 0;
            totalFailedJobs += service.jobCount.failed || 0;
            totalRunningJobs += service.jobCount.running || 0;
          }
        });
      }

      const totalJobs = totalSuccessJobs + totalFailedJobs + totalRunningJobs;
      const scanSuccessRate = totalJobs > 0 ? Math.round((totalSuccessJobs / totalJobs) * 100) : 0;

      // Get last scan time directly from stats response
      const lastScanTime = statsResponse.lastScanTime || 'No recent scans';

      // Get data source info from data sources endpoint
      const connectedSources = dataSourcesResponse.filter(ds => ds.status === 'Connected') || [];
      const totalSources = dataSourcesResponse || [];
      const errorSources = dataSourcesResponse.filter(ds => ds.status === 'Error') || [];

      console.log('Data Source Statistics:', {
        connectedSources: connectedSources.length,
        totalSources: totalSources.length,
        errorSources: errorSources.length,
        sources: dataSourcesResponse
      });

      const kpisData: IDiscoveryKpis = {
        totalAssetsDiscovered: statsResponse.totalAssets || 0,
        weeklyGrowth: statsResponse.assetsDiscoveredThisWeek || 0,
        newAssets24h: statsResponse.assetsDiscoveredThisWeek || 0,
        lastScanTime: lastScanTime,
        dataSourcesConnected: connectedSources.length,
        totalDataSources: totalSources.length,
        sourcesNeedingAttention: errorSources.length,
        scanSuccessRate: scanSuccessRate,
        averageScanTime: statsResponse.averageScanTime || 0,
        totalDataVolume: statsResponse.totalDataVolume || '0 TB'
      };

      console.log('✅ Discovery KPIs loaded successfully:', kpisData);
      return kpisData;
    } catch (error) {
      console.error('❌ Error fetching Discovery KPIs:', error);
      // Return zeros instead of mock data
      return {
        totalAssetsDiscovered: 0,
        weeklyGrowth: 0,
        newAssets24h: 0,
        lastScanTime: 'No recent scans',
        dataSourcesConnected: 0,
        totalDataSources: 0,
        sourcesNeedingAttention: 0,
        scanSuccessRate: 0,
        averageScanTime: 0,
        totalDataVolume: '0 TB'
      };
    }
  };

  const fetchDiscoveryActivity = async (): Promise<IDiscoveryActivity[]> => {
    try {
      console.log('📊 Fetching Discovery Activities from real API...');
      const activities = await getDiscoveryActivities();
      console.log('✅ Discovery Activities loaded successfully:', activities.length, 'items');
      return activities.length > 0 ? activities : [];
    } catch (error) {
      console.error('❌ Error fetching Discovery Activities:', error);
      return []; // Return empty array instead of mock data
    }
  };

  const fetchDiscoveryTrends = async (): Promise<IDiscoveryTrend[]> => {
    try {
      console.log('📈 Fetching Discovery Trends from real API...');
      const trends = await getDiscoveryTrends();
      console.log('✅ Discovery Trends loaded successfully:', trends.length, 'items');
      
      // Sort trends by date to ensure chronological order
      const sortedTrends = trends.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      return sortedTrends;
    } catch (error) {
      console.error('❌ Error fetching Discovery Trends:', error);
      return [];
    }
  };

  const fetchDataSources = async (): Promise<IDataSource[]> => {
    try {
      console.log('☁️ Fetching Data Sources from real API...');
      const dataSources = await getDataSources();
      console.log('✅ Data Sources loaded successfully:', dataSources.length, 'sources');
      return dataSources;
    } catch (error) {
      console.error('❌ Error fetching Data Sources:', error);
      // Return empty array instead of mock data
      return [];
    }
  };

  // Maps what a scan run achieved to the notice style. "Nothing to scan" is a warning, not a
  // success: before DISC-01 this page reported success while no scan had been started.
  const noticeFor = (result: ScanRunResult): { type: 'success' | 'warning' | 'error'; message: string } => {
    switch (result.kind) {
      case 'started':
        return { type: 'success', message: result.message };
      case 'failed':
        return { type: 'error', message: result.message };
      default:
        return { type: 'warning', message: result.message };
    }
  };

  // Load all data. Defined at component scope so the error state's Retry
  // action can re-invoke it directly instead of forcing a full page reload.
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisData, activitiesData, trendsData, sourcesData] = await Promise.all([
        fetchDiscoveryKpis(),
        fetchDiscoveryActivity(),
        fetchDiscoveryTrends(),
        fetchDataSources()
      ]);

      setKpis(kpisData);
      setActivities(activitiesData);
      setTrends(trendsData);
      setDataSources(sourcesData);
    } catch (error) {
      console.error('Error loading discovery data:', error);
      setError('Failed to load discovery agent data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load; loadData is recreated on every render and is also the Retry handler
  }, []);

  // Start a scan for every scannable cloud connection, report the outcome, then reload the
  // figures. runDiscoveryScans never throws; the catch below covers the reload only.
  const handleRefresh = async () => {
    setRefreshing(true);
    setScanNotice(null);
    try {
      const result = await runDiscoveryScans();
      setScanNotice(noticeFor(result));
      // Reload data after the scan request
      const [kpisData, activitiesData] = await Promise.all([
        fetchDiscoveryKpis(),
        fetchDiscoveryActivity()
      ]);
      setKpis(kpisData);
      setActivities(activitiesData);
    } catch (error) {
      console.error('Error during manual scan:', error);
      setScanNotice({ type: 'error', message: 'Manual scan failed. Please try again.' });
    } finally {
      setRefreshing(false);
    }
  };

  // Helper functions
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Success': return 'success';
      case 'Partial': return 'warning';
      case 'Failed': return 'error';
      default: return 'neutral';
    }
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-body font-body text-subtext-color">Loading discovery agent data...</span>
        </div>
      </DefaultPageLayout>
    );
  }

  if (error || !kpis) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6">
          <ErrorState
            message={error || 'Unable to load discovery agent information.'}
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
              icon={<FeatherZap />}
              variant="brand"
            />
            <div className="flex flex-col items-start">
              <span className="text-heading-2 font-heading-2 text-default-font">
                SmartDiscovery Management
              </span>
              <span className="text-body font-body text-subtext-color">
                Automated Data Discovery Agent
              </span>
            </div>
          </div>
          <Button
            variant="neutral-tertiary"
            icon={<FeatherRefreshCw />}
            onClick={handleRefresh}
            loading={refreshing}
            disabled={refreshing}
            title="Start a discovery scan now"
          >
            {refreshing ? 'Scanning...' : `Last scan: ${kpis.lastScanTime}`}
          </Button>
        </div>
        <Tabs>
          <Tabs.Item active={true} icon={<FeatherPieChart />} onClick={() => window.navigateToDiscoveryAgentOverview?.()}>
            Overview
          </Tabs.Item>
          <Tabs.Item icon={<FeatherSettings />} onClick={() => window.navigateToDataDiscoveryAgentConfig?.()}>
            Configuration
          </Tabs.Item>
          <Tabs.Item icon={<FeatherDatabase />} onClick={() => window.navigateToDiscoveryAgentAssetLog?.()}>
            Discovered Assets
          </Tabs.Item>
        </Tabs>
        {scanNotice && (
          <div
            className={`flex w-full items-center gap-2 rounded-md border border-solid px-4 py-3 ${
              scanNotice.type === 'success'
                ? 'border-success-200 bg-success-50 text-success-800'
                : scanNotice.type === 'warning'
                  ? 'border-warning-200 bg-warning-50 text-warning-800'
                  : 'border-error-200 bg-error-50 text-error-800'
            }`}
            role="status"
          >
            {scanNotice.type === 'success' ? (
              <FeatherCheckCircle className="h-4 w-4 flex-none" />
            ) : (
              <FeatherAlertCircle className="h-4 w-4 flex-none" />
            )}
            <span className="text-body font-body">{scanNotice.message}</span>
          </div>
        )}
        <div className="grid grid-cols-4 gap-4 w-full">
          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherDatabase />} variant="brand" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Total Assets Discovered
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis.totalAssetsDiscovered.toLocaleString()}
            </span>
            <Badge variant="success" icon={<FeatherTrendingUp />}>
              +{kpis.weeklyGrowth} this week
            </Badge>
          </div>
          
          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherPlus />} variant="success" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                New Assets (24h)
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis.newAssets24h}
            </span>
            <Badge icon={<FeatherClock />}>
              Last scan: {kpis.lastScanTime}
            </Badge>
          </div>
          
          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground 
                variant={kpis.sourcesNeedingAttention > 0 ? "warning" : "success"} 
                icon={<FeatherCloud />} 
              />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Data Sources Connected
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis.dataSourcesConnected}/{kpis.totalDataSources}
            </span>
            {kpis.sourcesNeedingAttention > 0 ? (
            <Badge variant="warning" icon={<FeatherAlertCircle />}>
                {kpis.sourcesNeedingAttention} needs attention
              </Badge>
            ) : (
              <Badge variant="success" icon={<FeatherCheck />}>
                All connected
            </Badge>
            )}
          </div>
          
          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground
                variant="success"
                icon={<FeatherCheckCircle />}
              />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Scan Success Rate
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {kpis.scanSuccessRate}%
            </span>
            <Progress value={kpis.scanSuccessRate} className="w-full" />
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-heading-3 font-heading-3 text-default-font">
            Assets Discovered Over Time
          </span>
            <Badge variant="neutral">
              Last 7 days
            </Badge>
          </div>
          <div className="w-full h-64 bg-white rounded-lg border border-neutral-border p-4">
            <LineChart
              className="h-64 w-full flex-none"
              data={trends.map(trend => ({
                // Format as MM-DD; a bad/missing date yields '' instead of an
                // "Invalid Date" label that would blank the chart axis.
                category: formatDateOnly(trend.date, { month: '2-digit', day: '2-digit' }, 'en-US', ''),
                "Total Assets": trend.totalAssets,
                "New Assets": trend.newAssets,
                "Updated Assets": trend.updatedAssets
              }))}
              index="category"
              categories={["Total Assets", "New Assets", "Updated Assets"]}
            />
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-4">
          <span className="text-body-bold font-body-bold text-default-font">
            Recent Discovery Activity
          </span>
          <Table
            header={
              <Table.HeaderRow>
                <Table.HeaderCell>Event</Table.HeaderCell>
                <Table.HeaderCell>Source</Table.HeaderCell>
                <Table.HeaderCell>Assets</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Duration</Table.HeaderCell>
                <Table.HeaderCell>Time</Table.HeaderCell>
              </Table.HeaderRow>
            }
          >
            {activities.map(activity => (
              <Table.Row key={activity.id}>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <IconWithBackground
                      variant={getStatusVariant(activity.status)}
                      size="small"
                  />
                  <span className="text-body-bold font-body-bold text-default-font">
                      {activity.event}
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                  <Badge variant="neutral">{activity.source}</Badge>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-subtext-color">
                    {activity.assetsNew > 0 && `${activity.assetsNew} new`}
                    {activity.assetsNew > 0 && activity.assetsUpdated > 0 && ', '}
                    {activity.assetsUpdated > 0 && `${activity.assetsUpdated} updated`}
                    {activity.assetsNew === 0 && activity.assetsUpdated === 0 && 'No changes'}
                </span>
              </Table.Cell>
              <Table.Cell>
                  <Badge variant={getStatusVariant(activity.status)} icon={
                    activity.status === 'Success' ? <FeatherCheck /> :
                    activity.status === 'Partial' ? <FeatherAlertCircle /> :
                    <FeatherAlertCircle />
                  }>
                    {activity.status}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-subtext-color">
                    {activity.duration || 'N/A'}
                  </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-subtext-color">
                    {activity.timestamp}
                </span>
              </Table.Cell>
            </Table.Row>
            ))}
          </Table>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default DiscoveryAgentOverview; 