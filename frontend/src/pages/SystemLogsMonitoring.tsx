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
    FeatherActivity,
    FeatherAlertTriangle,
    FeatherBarChart3,
    FeatherCheck,
    FeatherClock,
    FeatherRefreshCw,
    FeatherSearch,
    FeatherTrendingUp,
    FeatherX,
    FeatherXCircle,
    FeatherZap
} from "@subframe/core";
import { useEffect, useState } from "react";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { TextField } from "../ui/components/TextField";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { adminApi } from "../utils/api";
import { getJobStatuses } from "../utils/apiServices";

// TypeScript interfaces for System Logs & Monitoring.
// Only the Job Status view has a real backend (da-admin /job-statuses); the
// system-log, performance and alert models were removed with their mock data.
interface IJobStatus {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  runningJobs: number;
  queuedJobs: number;
  avgProcessingTime: number;
  jobsLast24h: number;
  successRate: number;
}

interface IJobLog {
  id: string;
  jobName: string;
  agent: string;
  status: 'success' | 'failed' | 'running' | 'queued' | 'cancelled';
  startTime: string;
  endTime?: string;
  duration?: number;
  processedItems: number;
  errorMessage?: string;
  triggeredBy: string;
}

/** One job of da-admin's AggregatedJobStatusDTO (JobStatusDTO). Every field may be absent. */
interface IJobDto {
  jobId?: string;
  jobType?: string;
  serviceName?: string;
  status?: string;
  submittedAt?: string;
  startedAt?: string;
  completedAt?: string;
  errorDetails?: string;
}

function SystemLogsMonitoring() {
  // State management. Only the Job Status data has a real backend
  // (da-admin GET /api/v1/admin/job-statuses). System logs, performance
  // metrics and alerts have no query endpoint yet, so those tabs render an
  // honest EmptyState rather than fabricated rows (CLAUDE.md §9).
  const [activeTab, setActiveTab] = useState<'jobs' | 'logs' | 'performance' | 'alerts'>('jobs');
  const [jobStatus, setJobStatus] = useState<IJobStatus | null>(null);
  const [jobLogs, setJobLogs] = useState<IJobLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Map the raw JobStatusDTO.status onto the UI's IJobLog status union.
  const mapJobStatus = (raw?: string): IJobLog['status'] => {
    const s = (raw ?? '').toUpperCase();
    if (s === 'COMPLETED_SUCCESS' || s === 'COMPLETED' || s === 'SUCCESS') return 'success';
    if (s === 'COMPLETED_FAILED' || s === 'FAILED' || s === 'ERROR') return 'failed';
    if (s === 'RUNNING' || s === 'IN_PROGRESS') return 'running';
    if (s === 'PENDING') return 'queued';
    return 'queued';
  };

  // Duration in seconds between startedAt and completedAt, when both present.
  const jobDurationSeconds = (job: IJobDto): number | undefined => {
    if (!job?.startedAt || !job?.completedAt) return undefined;
    const start = new Date(job.startedAt).getTime();
    const end = new Date(job.completedAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return undefined;
    return Math.round((end - start) / 1000);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Normalized {services, overall} for the summary cards.
      const normalized = await getJobStatuses();
      // Raw AggregatedJobStatusDTO for per-job rows + accurate counts.
      const { data: raw } = await adminApi.get('/job-statuses');
      const jobs: IJobDto[] = Array.isArray(raw?.jobs) ? raw.jobs : [];

      const totalJobs = raw?.totalJobs ?? jobs.length;
      const successfulJobs = raw?.completedSuccessJobs ?? 0;
      const failedJobs = raw?.completedFailedJobs ?? 0;
      const runningJobs = raw?.runningJobs ?? 0;
      const queuedJobs = raw?.pendingJobs ?? 0;

      setJobStatus({
        totalJobs,
        successfulJobs,
        failedJobs,
        runningJobs,
        queuedJobs,
        // No processing-time or 24h aggregate is exposed by the DTO.
        avgProcessingTime: 0,
        jobsLast24h: normalized.overall.activeJobs,
        successRate: totalJobs > 0 ? Math.round((successfulJobs / totalJobs) * 1000) / 10 : 0,
      });

      setJobLogs(
        jobs.map((j, i) => ({
          id: j?.jobId ?? `job-${i + 1}`,
          jobName: j?.jobType ?? j?.jobId ?? 'Job',
          agent: j?.serviceName ?? 'unknown',
          status: mapJobStatus(j?.status),
          startTime: j?.startedAt ?? j?.submittedAt ?? '',
          endTime: j?.completedAt ?? undefined,
          duration: jobDurationSeconds(j),
          // JobStatusDTO exposes no processed-item count.
          processedItems: 0,
          errorMessage: j?.errorDetails ?? undefined,
          // JobStatusDTO exposes no trigger source.
          triggeredBy: '—',
        }))
      );
    } catch (err) {
      console.error('Error loading job status data:', err);
      setJobStatus(null);
      setJobLogs([]);
      setError('Failed to load job status data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load; loadData is recreated on every render and is also the Retry handler
  }, []);

  // Helper functions
  const getJobStatusVariant = (status: string) => {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'error';
      case 'running': return 'brand';
      case 'queued': return 'neutral';
      case 'cancelled': return 'neutral';
      default: return 'neutral';
    }
  };

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <FeatherCheck />;
      case 'failed': return <FeatherX />;
      case 'running': return <FeatherRefreshCw />;
      case 'queued': return <FeatherClock />;
      case 'cancelled': return <FeatherXCircle />;
      default: return <FeatherClock />;
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  // Client-side search over the fetched jobs (backend has no job search param).
  const filteredJobLogs = jobLogs.filter(job => {
    const q = searchTerm.toLowerCase();
    return (
      job.jobName.toLowerCase().includes(q) ||
      job.agent.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-body font-body text-subtext-color">Loading system monitoring data...</span>
        </div>
      </DefaultPageLayout>
    );
  }

  // Hard failure with no job data: honest ErrorState.
  const showError = !!error && !jobStatus;

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        {/* Header */}
        <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border px-12 py-4">
          <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">
            System Logs & Monitoring
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="neutral-tertiary"
              icon={<FeatherRefreshCw />}
              onClick={loadData}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-8 px-12 py-8">
          {/* Navigation Tabs */}
          <Tabs>
            <Tabs.Item
              active={activeTab === 'jobs'}
              icon={<FeatherZap />}
              onClick={() => setActiveTab('jobs')}
            >
              Job Status
            </Tabs.Item>
            <Tabs.Item
              active={activeTab === 'logs'}
              icon={<FeatherActivity />}
              onClick={() => setActiveTab('logs')}
            >
              System Logs
            </Tabs.Item>
            <Tabs.Item
              active={activeTab === 'performance'}
              icon={<FeatherTrendingUp />}
              onClick={() => setActiveTab('performance')}
            >
              Performance
            </Tabs.Item>
            <Tabs.Item
              active={activeTab === 'alerts'}
              icon={<FeatherAlertTriangle />}
              onClick={() => setActiveTab('alerts')}
            >
              Alerts
            </Tabs.Item>
          </Tabs>

          {showError && (
            <ErrorState message={error ?? undefined} onRetry={loadData} />
          )}

          {/* Job Status Tab (real data: da-admin /job-statuses) */}
          {activeTab === 'jobs' && !showError && (
            <div className="flex w-full flex-col gap-6">
              {/* Job Status Overview */}
              <div className="grid grid-cols-4 gap-4 w-full">
                <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherCheck />} variant="success" />
                    <span className="text-body-bold font-body-bold text-subtext-color">
                      Success Rate
                    </span>
                  </div>
                  <span className="text-heading-1 font-heading-1 text-default-font">
                    {jobStatus?.successRate ?? 0}%
                  </span>
                  <Badge variant="success">
                    {jobStatus?.successfulJobs ?? 0} successful
                  </Badge>
                </div>

                <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherRefreshCw />} variant="brand" />
                    <span className="text-body-bold font-body-bold text-subtext-color">
                      Running Jobs
                    </span>
                  </div>
                  <span className="text-heading-1 font-heading-1 text-default-font">
                    {jobStatus?.runningJobs ?? 0}
                  </span>
                  <Badge variant="brand">
                    {jobStatus?.queuedJobs ?? 0} queued
                  </Badge>
                </div>

                <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherXCircle />} variant="error" />
                    <span className="text-body-bold font-body-bold text-subtext-color">
                      Failed Jobs
                    </span>
                  </div>
                  <span className="text-heading-1 font-heading-1 text-default-font">
                    {jobStatus?.failedJobs ?? 0}
                  </span>
                  {(jobStatus?.failedJobs ?? 0) > 0 ? (
                    <Badge variant="error">Needs attention</Badge>
                  ) : (
                    <Badge variant="success">All clear</Badge>
                  )}
                </div>

                <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherBarChart3 />} variant="neutral" />
                    <span className="text-body-bold font-body-bold text-subtext-color">
                      Total Jobs
                    </span>
                  </div>
                  <span className="text-heading-1 font-heading-1 text-default-font">
                    {jobStatus?.totalJobs ?? 0}
                  </span>
                  <Badge variant="neutral">
                    {jobStatus?.jobsLast24h ?? 0} active
                  </Badge>
                </div>
              </div>

              {/* Search */}
              <div className="flex w-full items-center gap-4">
                <TextField
                  variant="filled"
                  label=""
                  helpText=""
                  icon={<FeatherSearch />}
                  className="w-80"
                >
                  <TextField.Input
                    placeholder="Search jobs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </TextField>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-body font-body text-subtext-color">
                    {filteredJobLogs.length} of {jobLogs.length} jobs
                  </span>
                </div>
              </div>

              {/* Jobs Table */}
              {filteredJobLogs.length === 0 ? (
                <EmptyState
                  title="No jobs found"
                  message={
                    searchTerm
                      ? 'No jobs match your search.'
                      : 'No jobs have been reported by any service yet.'
                  }
                />
              ) : (
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>Job</Table.HeaderCell>
                    <Table.HeaderCell>Service</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Start Time</Table.HeaderCell>
                    <Table.HeaderCell>Duration</Table.HeaderCell>
                    <Table.HeaderCell>Triggered By</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {filteredJobLogs.map(job => (
                  <Table.Row key={job.id}>
                    <Table.Cell>
                      <div className="flex flex-col items-start">
                        <span className="text-body-bold font-body-bold text-default-font">
                          {job.jobName}
                        </span>
                        {job.errorMessage && (
                          <span className="text-caption font-caption text-error-600">
                            {job.errorMessage}
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="neutral">{job.agent}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={getJobStatusVariant(job.status)} icon={getJobStatusIcon(job.status)}>
                        {job.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-body font-body text-subtext-color">
                        {job.startTime || '—'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {job.duration !== undefined ? (
                        <span className="text-body font-body text-default-font">
                          {formatDuration(job.duration)}
                        </span>
                      ) : (
                        <span className="text-body font-body text-subtext-color">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-body font-body text-subtext-color">
                        {job.triggeredBy}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table>
              )}
            </div>
          )}

          {/* System Logs Tab: no query endpoint exists yet (da-logingest only
              ingests). Render an honest EmptyState instead of fabricated rows. */}
          {activeTab === 'logs' && !showError && (
            <EmptyState
              title="Log browsing not yet wired"
              message="A system-log query endpoint is not yet available. Audit-log events are ingested by da-logingest but cannot be browsed here yet."
            />
          )}

          {/* Performance Tab: no system-metrics endpoint exists. */}
          {activeTab === 'performance' && !showError && (
            <EmptyState
              title="Performance metrics not available"
              message="No system performance-metrics endpoint is wired yet."
            />
          )}

          {/* Alerts Tab: no alerts endpoint exists. */}
          {activeTab === 'alerts' && !showError && (
            <EmptyState
              title="No alerts source configured"
              message="No system-alerts endpoint is wired yet."
            />
          )}
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default SystemLogsMonitoring;
