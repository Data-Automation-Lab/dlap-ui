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
    FeatherClock,
    FeatherGrid,
    FeatherPieChart,
    FeatherRefreshCw,
    FeatherSettings,
    FeatherShield
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
import { EmptyState, ErrorState } from "../components/EmptyState";
import { complianceApi } from "../utils/api";
import { formatDate } from "../utils/safeDate";

// TypeScript interfaces for Compliance Agent data
interface IComplianceKpis {
  overallComplianceScore: number;
  activeChecks: number;
  violationsLast24h: number;
  violationsLast7Days: number;
  criticalViolations: number;
  resolvedViolations: number;
  averageResolutionTime: number;
  lastScanTime: string;
  regulationsMonitored: number;
  highRiskAssets: number;
}

interface IComplianceTrend {
  date: string;
  overallScore: number;
  hipaaScore: number;
  gdprScore: number;
  socScore: number;
  violations: number;
}

interface IComplianceHeatmapData {
  regulation: string;
  category: string;
  score: number;
  violations: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

interface IViolation {
  id: string;
  controlId: string;
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  regulation: string;
  affectedAssets: string[];
  detectedAt: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'False Positive';
  assignedTo?: string;
  dueDate?: string;
}

interface IMonitoredRegulation {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  lastUpdated: string;
  rulesCount: number;
  complianceScore: number;
}

function ComplianceAgentView() {
  // State management
  const [activeTab, setActiveTab] = useState<'overview' | 'configuration' | 'violations'>('overview');
  const [kpis, setKpis] = useState<IComplianceKpis | null>(null);
  const [complianceTrends, setComplianceTrends] = useState<IComplianceTrend[]>([]);
  const [heatmapData, setHeatmapData] = useState<IComplianceHeatmapData[]>([]);
  const [violations, setViolations] = useState<IViolation[]>([]);
  const [regulations, setRegulations] = useState<IMonitoredRegulation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Real API integration — da-autocompliance ComplianceController.
  // Base client complianceApi points at /api/v1/compliance; DTO field names
  // line up 1:1 with the frontend interfaces above.
  const fetchComplianceKpis = async (): Promise<IComplianceKpis> => {
    const { data } = await complianceApi.get('/kpis');
    return {
      overallComplianceScore: data?.overallComplianceScore ?? 0,
      activeChecks: data?.activeChecks ?? 0,
      violationsLast24h: data?.violationsLast24h ?? 0,
      violationsLast7Days: data?.violationsLast7Days ?? 0,
      criticalViolations: data?.criticalViolations ?? 0,
      resolvedViolations: data?.resolvedViolations ?? 0,
      averageResolutionTime: data?.averageResolutionTime ?? 0,
      lastScanTime: data?.lastScanTime ?? 'Never',
      regulationsMonitored: data?.regulationsMonitored ?? 0,
      highRiskAssets: data?.highRiskAssets ?? 0
    };
  };

  const fetchComplianceTrends = async (): Promise<IComplianceTrend[]> => {
    const { data } = await complianceApi.get('/trends');
    return Array.isArray(data)
      ? data.map((t: Partial<IComplianceTrend>) => ({
        date: t?.date ?? '',
        overallScore: t?.overallScore ?? 0,
        hipaaScore: t?.hipaaScore ?? 0,
        gdprScore: t?.gdprScore ?? 0,
        socScore: t?.socScore ?? 0,
        violations: t?.violations ?? 0
      }))
      : [];
  };

  const fetchHeatmapData = async (): Promise<IComplianceHeatmapData[]> => {
    const { data } = await complianceApi.get('/heatmap');
    return Array.isArray(data)
      ? data.map((h: Partial<IComplianceHeatmapData>) => ({
        regulation: h?.regulation ?? '',
        category: h?.category ?? '',
        score: h?.score ?? 0,
        violations: h?.violations ?? 0,
        riskLevel: (h?.riskLevel as IComplianceHeatmapData['riskLevel']) ?? 'Low'
      }))
      : [];
  };

  const fetchViolations = async (): Promise<IViolation[]> => {
    const { data } = await complianceApi.get('/violations');
    return Array.isArray(data)
      ? data.map((v: Partial<IViolation>, i: number) => ({
        id: v?.id ?? `violation-${i + 1}`,
        controlId: v?.controlId ?? '',
        title: v?.title ?? '',
        description: v?.description ?? '',
        severity: (v?.severity as IViolation['severity']) ?? 'Low',
        regulation: v?.regulation ?? '',
        affectedAssets: Array.isArray(v?.affectedAssets) ? v.affectedAssets : [],
        detectedAt: v?.detectedAt ?? '',
        status: (v?.status as IViolation['status']) ?? 'Open',
        assignedTo: v?.assignedTo ?? undefined,
        dueDate: v?.dueDate ?? undefined
      }))
      : [];
  };

  const fetchMonitoredRegulations = async (): Promise<IMonitoredRegulation[]> => {
    const { data } = await complianceApi.get('/regulations');
    return Array.isArray(data)
      ? data.map((r: Partial<IMonitoredRegulation>, i: number) => ({
        id: r?.id ?? `regulation-${i + 1}`,
        name: r?.name ?? '',
        version: r?.version ?? '',
        enabled: r?.enabled ?? false,
        lastUpdated: r?.lastUpdated ?? '',
        rulesCount: r?.rulesCount ?? 0,
        complianceScore: r?.complianceScore ?? 0
      }))
      : [];
  };

  // Load all data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisData, trendsData, heatmapDataRes, violationsData, regulationsData] = await Promise.all([
        fetchComplianceKpis(),
        fetchComplianceTrends(),
        fetchHeatmapData(),
        fetchViolations(),
        fetchMonitoredRegulations()
      ]);

      setKpis(kpisData);
      setComplianceTrends(trendsData);
      setHeatmapData(heatmapDataRes);
      setViolations(violationsData);
      setRegulations(regulationsData);
    } catch (error) {
      console.error('Error loading compliance data:', error);
      setError('Failed to load compliance data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load; loadData is recreated on every render and is also the Retry handler
  }, []);

  // Trigger a real manual compliance scan, then refetch KPIs + violations.
  // POST /api/v1/compliance/scan -> 202 { status, jobId }.
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await complianceApi.post('/scan');
      const [kpisData, violationsData] = await Promise.all([
        fetchComplianceKpis(),
        fetchViolations()
      ]);
      setKpis(kpisData);
      setViolations(violationsData);
    } catch (error) {
      console.error('Error during compliance scan:', error);
      setError('Compliance scan failed. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Helper functions
  const getRiskVariant = (risk: string) => {
    switch (risk) {
      case 'Low': return 'success';
      case 'Medium': return 'warning';
      case 'High': return 'error';
      case 'Critical': return 'error';
      default: return 'neutral';
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'Low': return 'success';
      case 'Medium': return 'warning';
      case 'High': return 'error';
      case 'Critical': return 'error';
      default: return 'neutral';
    }
  };

  const getViolationStatusVariant = (status: string) => {
    switch (status) {
      case 'Open': return 'error';
      case 'In Progress': return 'warning';
      case 'Resolved': return 'success';
      case 'False Positive': return 'neutral';
      default: return 'neutral';
    }
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-body font-body text-subtext-color">Loading compliance data...</span>
        </div>
      </DefaultPageLayout>
    );
  }

  if (error || !kpis) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6">
          <ErrorState
            message={error || 'Unable to load compliance information.'}
            onRetry={loadData}
          />
        </div>
      </DefaultPageLayout>
    );
  }

  const renderOverviewTab = () => (
    <div className="flex w-full flex-col gap-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 w-full">
        <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
          <div className="flex w-full items-center gap-2">
            <IconWithBackground icon={<FeatherShield />} variant="success" />
            <span className="text-body-bold font-body-bold text-subtext-color">
              Overall Compliance
            </span>
          </div>
          <span className="text-heading-1 font-heading-1 text-default-font">
            {kpis.overallComplianceScore}%
          </span>
          <Progress value={kpis.overallComplianceScore} className="w-full" />
        </div>
        
        <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
          <div className="flex w-full items-center gap-2">
            <IconWithBackground icon={<FeatherCheck />} variant="brand" />
            <span className="text-body-bold font-body-bold text-subtext-color">
              Active Checks
            </span>
          </div>
          <span className="text-heading-1 font-heading-1 text-default-font">
            {kpis.activeChecks}
          </span>
          <Badge variant="success">
            {kpis.regulationsMonitored} regulations
          </Badge>
        </div>
        
        <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
          <div className="flex w-full items-center gap-2">
            <IconWithBackground icon={<FeatherAlertTriangle />} variant="error" />
            <span className="text-body-bold font-body-bold text-subtext-color">
              Violations (24h)
            </span>
          </div>
          <span className="text-heading-1 font-heading-1 text-default-font">
            {kpis.violationsLast24h}
          </span>
          <Badge variant="error" icon={<FeatherAlertTriangle />}>
            {kpis.criticalViolations} critical
          </Badge>
        </div>

        <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
          <div className="flex w-full items-center gap-2">
            <IconWithBackground icon={<FeatherClock />} variant="neutral" />
            <span className="text-body-bold font-body-bold text-subtext-color">
              Avg Resolution Time
            </span>
          </div>
          <span className="text-heading-1 font-heading-1 text-default-font">
            {kpis.averageResolutionTime}h
          </span>
          <Badge variant="success">
            {kpis.resolvedViolations} resolved
          </Badge>
        </div>
      </div>

      {/* Compliance Score Trends */}
      <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
        <div className="flex items-center justify-between w-full">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Compliance Score Trends
          </span>
          <Badge variant="neutral">
            Last 7 weeks
          </Badge>
        </div>
        <LineChart
          className="h-64 w-full flex-none"
          data={complianceTrends.map(trend => ({
            category: trend.date.slice(-5), // Show MM-DD format
            "Overall Score": trend.overallScore,
            "HIPAA": trend.hipaaScore,
            "GDPR": trend.gdprScore,
            "SOC 2": trend.socScore
          }))}
          index="category"
          categories={["Overall Score", "HIPAA", "GDPR", "SOC 2"]}
        />
      </div>

      {/* Compliance Heatmap */}
      <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
        <div className="flex items-center justify-between w-full">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Compliance Heatmap by Regulation & Category
          </span>
          <IconWithBackground icon={<FeatherGrid />} variant="neutral" size="small" />
        </div>
        {heatmapData.length === 0 ? (
          <EmptyState
            title="No heatmap data"
            message="Compliance heatmap data is not available yet."
          />
        ) : (
        <div className="grid grid-cols-3 gap-4 w-full">
          {heatmapData.map((item, index) => (
            <div key={index} className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4">
              <div className="flex items-center justify-between w-full">
                <span className="text-body-bold font-body-bold text-default-font">
                  {item.regulation}
                </span>
                <Badge variant={getRiskVariant(item.riskLevel)}>
                  {item.riskLevel}
                </Badge>
              </div>
              <span className="text-body font-body text-subtext-color">
                {item.category}
              </span>
              <div className="flex items-center justify-between w-full">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  {item.score}%
                </span>
                <span className="text-body font-body text-subtext-color">
                  {item.violations} violations
                </span>
              </div>
              <Progress value={item.score} className="w-full" />
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Recent Violations */}
      <div className="flex w-full flex-col items-start gap-4">
        <div className="flex items-center justify-between w-full">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Recent Violations
          </span>
          <Button
            variant="neutral-tertiary"
            size="small"
            onClick={() => setActiveTab('violations')}
          >
            View All Violations
          </Button>
        </div>
        {violations.length === 0 ? (
          <EmptyState
            title="No violations"
            message="No compliance violations have been detected."
          />
        ) : (
        <Table
          header={
            <Table.HeaderRow>
              <Table.HeaderCell>Violation</Table.HeaderCell>
              <Table.HeaderCell>Regulation</Table.HeaderCell>
              <Table.HeaderCell>Severity</Table.HeaderCell>
              <Table.HeaderCell>Affected Assets</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Detected</Table.HeaderCell>
            </Table.HeaderRow>
          }
        >
          {violations.slice(0, 3).map(violation => (
            <Table.Row key={violation.id}>
              <Table.Cell>
                <div className="flex flex-col gap-1">
                  <span className="text-body-bold font-body-bold text-default-font">
                    {violation.title}
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    {violation.controlId}
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="neutral">{violation.regulation}</Badge>
              </Table.Cell>
              <Table.Cell>
                <Badge variant={getSeverityVariant(violation.severity)}>
                  {violation.severity}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-subtext-color">
                  {violation.affectedAssets.length} assets
                </span>
              </Table.Cell>
              <Table.Cell>
                <Badge variant={getViolationStatusVariant(violation.status)}>
                  {violation.status}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-subtext-color">
                  {formatDate(violation.detectedAt)}
                </span>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table>
        )}
      </div>
    </div>
  );

  const renderConfigurationTab = () => (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col items-start gap-4">
        <span className="text-heading-3 font-heading-3 text-default-font">
          Monitored Regulations
        </span>
        {regulations.length === 0 ? (
          <EmptyState
            title="No monitored regulations"
            message="No compliance regulations are configured yet."
          />
        ) : (
        <Table
          header={
            <Table.HeaderRow>
              <Table.HeaderCell>Regulation</Table.HeaderCell>
              <Table.HeaderCell>Version</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Rules Count</Table.HeaderCell>
              <Table.HeaderCell>Compliance Score</Table.HeaderCell>
              <Table.HeaderCell>Last Updated</Table.HeaderCell>
            </Table.HeaderRow>
          }
        >
          {regulations.map(regulation => (
            <Table.Row key={regulation.id}>
              <Table.Cell>
                <span className="text-body-bold font-body-bold text-default-font">
                  {regulation.name}
                </span>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="neutral">{regulation.version}</Badge>
              </Table.Cell>
              <Table.Cell>
                <Badge variant={regulation.enabled ? 'success' : 'neutral'}>
                  {regulation.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-default-font">
                  {regulation.rulesCount}
                </span>
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <span className="text-body font-body text-default-font">
                    {regulation.complianceScore}%
                  </span>
                  {regulation.enabled && (
                    <Progress value={regulation.complianceScore} className="w-16" />
                  )}
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-subtext-color">
                  {regulation.lastUpdated}
                </span>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table>
        )}
      </div>
    </div>
  );

  const renderViolationsTab = () => (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col items-start gap-4">
        <div className="flex items-center justify-between w-full">
          <span className="text-heading-3 font-heading-3 text-default-font">
            All Violations
          </span>
        </div>
        {violations.length === 0 ? (
          <EmptyState
            title="No violations"
            message="No compliance violations have been detected."
          />
        ) : (
        <Table
          header={
            <Table.HeaderRow>
              <Table.HeaderCell>Violation Details</Table.HeaderCell>
              <Table.HeaderCell>Regulation</Table.HeaderCell>
              <Table.HeaderCell>Severity</Table.HeaderCell>
              <Table.HeaderCell>Affected Assets</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Assigned To</Table.HeaderCell>
              <Table.HeaderCell>Due Date</Table.HeaderCell>
            </Table.HeaderRow>
          }
        >
          {violations.map(violation => (
            <Table.Row key={violation.id}>
              <Table.Cell>
                <div className="flex flex-col gap-1">
                  <span className="text-body-bold font-body-bold text-default-font">
                    {violation.title}
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    {violation.controlId} • {violation.description}
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <Badge variant="neutral">{violation.regulation}</Badge>
              </Table.Cell>
              <Table.Cell>
                <Badge variant={getSeverityVariant(violation.severity)}>
                  {violation.severity}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <div className="flex flex-col gap-1">
                  <span className="text-body font-body text-default-font">
                    {violation.affectedAssets.length} assets
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    {violation.affectedAssets.slice(0, 2).join(', ')}
                    {violation.affectedAssets.length > 2 && '...'}
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <Badge variant={getViolationStatusVariant(violation.status)}>
                  {violation.status}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-subtext-color">
                  {violation.assignedTo || 'Unassigned'}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-body font-body text-subtext-color">
                  {violation.dueDate || 'No deadline'}
                </span>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table>
        )}
      </div>
    </div>
  );

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <IconWithBackground
              size="large"
              icon={<FeatherShield />}
              variant="success"
            />
            <div className="flex flex-col items-start">
              <span className="text-heading-2 font-heading-2 text-default-font">
                SmartCompliance Management
              </span>
              <span className="text-body font-body text-subtext-color">
                Automated Compliance Monitoring Agent
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
            {refreshing ? 'Scanning...' : `Last scan: ${kpis.lastScanTime}`}
          </Button>
        </div>

        {/* Navigation Tabs */}
        <Tabs>
          <Tabs.Item 
            active={activeTab === 'overview'} 
            icon={<FeatherPieChart />}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </Tabs.Item>
          <Tabs.Item 
            active={activeTab === 'configuration'} 
            icon={<FeatherSettings />}
            onClick={() => setActiveTab('configuration')}
          >
            Configuration
          </Tabs.Item>
          <Tabs.Item 
            active={activeTab === 'violations'} 
            icon={<FeatherAlertTriangle />}
            onClick={() => setActiveTab('violations')}
          >
            Violations
          </Tabs.Item>
        </Tabs>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'configuration' && renderConfigurationTab()}
        {activeTab === 'violations' && renderViolationsTab()}
      </div>
    </DefaultPageLayout>
  );
}

export default ComplianceAgentView; 