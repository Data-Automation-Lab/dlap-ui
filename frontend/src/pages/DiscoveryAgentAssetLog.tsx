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
  FeatherChevronLeft,
  FeatherChevronRight,
  FeatherClock,
  FeatherDatabase,
  FeatherEye,
  FeatherPieChart,
  FeatherRefreshCw,
  FeatherSearch,
  FeatherSettings
} from "@subframe/core";
import { useEffect, useState } from "react";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconButton } from "../ui/components/IconButton";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Select } from "../ui/components/Select";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { TextField } from "../ui/components/TextField";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { discoveryApi } from "../utils/api";
import { getDiscoveryStats } from "../utils/apiServices";
import { formatDateOnly } from "../utils/safeDate";

// Shape returned by da-discovery GET /api/v1/discovery/assets (per-row).
// The controller emits: id, name, type (cloud provider), fileType (content
// type), size (formatted), discoveryDate (ISO), status, quality (0-100), tags.
interface IDiscoveredAsset {
  id: string;
  name: string;
  dataSource: string;   // cloud provider (GCP, AWS, AZURE, ...)
  fileType: string;     // content type (csv, json, parquet, ...)
  size: string;
  discoveryDate: string;
  status: string;       // Cataloged | Processing | Failed | Pending (server-defined)
  quality: number;      // 0-100
  tags: string[];
}

/**
 * One row of da-discovery's GET /assets page. It differs from IDiscoveredAsset: "type" carries the
 * data source and "tags" is a list or a map, depending on the asset. Every field may be absent.
 */
interface IDiscoveredAssetDto {
  id?: string;
  name?: string;
  type?: string;
  fileType?: string;
  size?: string;
  discoveryDate?: string;
  status?: string;
  quality?: unknown;
  tags?: string[] | Record<string, unknown>;
}

interface IAssetFilters {
  dataSource: string;
  assetType: string;
  status: string;
  dateRange: string;
}

interface IPaginationState {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
}

interface ISortState {
  field: string;
  direction: 'asc' | 'desc';
}

interface IAssetStats {
  totalAssets: number;
  assetsLast24h: number;
  uniqueFileTypes: number;
  totalSize: string;
  averageQuality: number;
}

function DiscoveryAgentAssetLog() {
  // State management
  const [assets, setAssets] = useState<IDiscoveredAsset[]>([]);
  const [stats, setStats] = useState<IAssetStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<IAssetFilters>({
    dataSource: 'all',
    assetType: 'all',
    status: 'all',
    dateRange: 'all'
  });
  const [sort, setSort] = useState<ISortState>({
    field: 'discoveryDate',
    direction: 'desc'
  });
  const [pagination, setPagination] = useState<IPaginationState>({
    currentPage: 1,
    totalPages: 10,
    itemsPerPage: 20,
    totalItems: 0
  });
  const [error, setError] = useState<string | null>(null);

  // Sort field maps to the backend CloudResource column. The UI's
  // "discoveryDate" is persisted as lastDiscoveredAt server-side.
  const toSortField = (field: string): string =>
    field === 'discoveryDate' ? 'lastDiscoveredAt' : field;

  // Fetch a page of discovered assets from the real, server-paginated
  // da-discovery GET /api/v1/discovery/assets endpoint. Search, filtering,
  // sorting and pagination are all performed server-side.
  const fetchDiscoveredAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page: pagination.currentPage - 1, // backend is 0-based
        pageSize: pagination.itemsPerPage,
        sort: `${toSortField(sort.field)},${sort.direction}`,
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (filters.dataSource !== 'all') params.dataSource = filters.dataSource;
      if (filters.assetType !== 'all') params.fileType = filters.assetType;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.dateRange !== 'all') params.dateRange = filters.dateRange;

      const { data } = await discoveryApi.get('/assets', { params });
      const content: IDiscoveredAssetDto[] = Array.isArray(data?.content) ? data.content : [];
      const mapped: IDiscoveredAsset[] = content.map((a, i) => ({
        id: a?.id ?? `asset-${i + 1}`,
        name: a?.name ?? '',
        dataSource: a?.type ?? '',
        fileType: a?.fileType ?? 'UNKNOWN',
        size: a?.size ?? '',
        discoveryDate: a?.discoveryDate ?? '',
        status: a?.status ?? 'Pending',
        quality: typeof a?.quality === 'number' ? a.quality : 0,
        tags: a?.tags
          ? (Array.isArray(a.tags) ? a.tags : Object.keys(a.tags))
          : [],
      }));
      setAssets(mapped);
      setPagination(prev => ({
        ...prev,
        totalItems: data?.totalElements ?? mapped.length,
        totalPages: data?.totalPages ?? 1,
      }));
    } catch (error) {
      console.error('❌ Error fetching discovered assets:', error);
      setAssets([]);
      setError('Failed to load discovered assets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetStats = async () => {
    try {
      const statsResponse = await getDiscoveryStats();
      setStats({
        totalAssets: statsResponse.totalAssets || 0,
        // Real "discovered today" count from the statistics endpoint.
        assetsLast24h: statsResponse.assetsDiscoveredToday || 0,
        uniqueFileTypes: 0,
        totalSize: statsResponse.totalDataVolume || '0 TB',
        averageQuality: 0,
      });
    } catch (error) {
      console.error('❌ Error fetching Discovery Stats:', error);
      setStats({
        totalAssets: 0,
        assetsLast24h: 0,
        uniqueFileTypes: 0,
        totalSize: '0 TB',
        averageQuality: 0,
      });
    }
  };

  // Refetch the current page whenever query/filters/sort/page change. The
  // backend performs all filtering, so we simply re-request.
  useEffect(() => {
    fetchDiscoveredAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filters, sort, pagination.currentPage, pagination.itemsPerPage]);

  useEffect(() => {
    fetchAssetStats();
  }, []);

  // Reset to the first page whenever the query/filters/sort change.
  useEffect(() => {
    setPagination(prev => (prev.currentPage === 1 ? prev : { ...prev, currentPage: 1 }));
  }, [searchQuery, filters, sort]);

  // Handler functions
  const handleSort = (field: string) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilterChange = (filterType: keyof IAssetFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleViewAsset = (_asset: IDiscoveredAsset) => {
    window.navigateToAssetDetailView?.();
  };

  // Helper functions
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Cataloged': return 'success';
      case 'Processing': return 'warning';
      case 'Failed': return 'error';
      case 'Pending': return 'neutral';
      default: return 'neutral';
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-success-600';
    if (score >= 70) return 'text-warning-600';
    return 'text-error-600';
  };

  // Server-side pagination: the backend returns exactly one page. Index labels
  // for the "Showing X to Y of Z" footer are derived from the page metadata.
  const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
  const pageEndIndex = Math.min(startIndex + assets.length, pagination.totalItems);

  // Full-page loader only on the very first load (no data + no error yet).
  if (loading && assets.length === 0 && !error) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-body font-body text-subtext-color">Loading discovered assets...</span>
        </div>
      </DefaultPageLayout>
    );
  }

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        {/* Header */}
        <div className="flex w-full flex-wrap items-center gap-2 px-6 pt-6 pb-2">
          <div className="flex grow shrink-0 basis-0 items-center gap-2">
            <FeatherSearch className="text-heading-2 font-heading-2 text-default-font" />
            <span className="text-heading-2 font-heading-2 text-default-font">
              SmartDiscovery Management
            </span>
            <Badge variant="success">Active</Badge>
          </div>
          <Button
            variant="neutral-primary"
            icon={<FeatherRefreshCw />}
            onClick={() => { fetchDiscoveredAssets(); fetchAssetStats(); }}
          >
            Refresh
          </Button>
          <Button
            icon={<FeatherSettings />}
            onClick={() => window.navigateToDataDiscoveryAgentConfig?.()}
          >
            Configure
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex w-full items-end border-b border-solid border-neutral-border">
          <Tabs>
            <Tabs.Item icon={<FeatherPieChart />} onClick={() => window.navigateToDiscoveryAgentOverview?.()}>
              Overview
            </Tabs.Item>
            <Tabs.Item icon={<FeatherSettings />} onClick={() => window.navigateToDataDiscoveryAgentConfig?.()}>
              Configuration
            </Tabs.Item>
            <Tabs.Item active={true} icon={<FeatherDatabase />}>
              Discovered Assets Log
            </Tabs.Item>
          </Tabs>
        </div>

        {/* Main Content */}
        <div className="flex w-full flex-col items-start gap-6 p-6">
          {/* Header and Actions */}
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Discovered Assets
              </span>
              <span className="text-body font-body text-subtext-color">
                Assets discovered and indexed by the SmartDiscovery agent
              </span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4 w-full">
            <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground icon={<FeatherDatabase />} variant="brand" />
                <span className="text-body-bold font-body-bold text-subtext-color">
                  Total Assets
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {(stats?.totalAssets ?? 0).toLocaleString()}
              </span>
            </div>

            <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground icon={<FeatherClock />} variant="success" />
                <span className="text-body-bold font-body-bold text-subtext-color">
                  Discovered Today
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {stats?.assetsLast24h ?? 0}
              </span>
            </div>

            <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground icon={<FeatherDatabase />} variant="neutral" />
                <span className="text-body-bold font-body-bold text-subtext-color">
                  Total Size
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {stats?.totalSize ?? '0 TB'}
              </span>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex w-full flex-col gap-4">
            <TextField
              className="h-auto w-full flex-none"
              icon={<FeatherSearch />}
            >
              <TextField.Input
                placeholder="Search discovered assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </TextField>

            <div className="flex w-full items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-body-bold font-body-bold text-default-font">Filters:</span>
                
                <Select
                  value={filters.dataSource}
                  onValueChange={(value) => handleFilterChange('dataSource', value)}
                >
                  {/* Values are da-discovery CloudProvider enum names (exact). */}
                  <Select.Item value="all">All Sources</Select.Item>
                  <Select.Item value="GCP">GCP</Select.Item>
                  <Select.Item value="AWS">AWS</Select.Item>
                  <Select.Item value="AZURE">Azure</Select.Item>
                  <Select.Item value="OCI">Oracle (OCI)</Select.Item>
                  <Select.Item value="DATABRICKS">Databricks</Select.Item>
                </Select>

                <Select
                  value={filters.assetType}
                  onValueChange={(value) => handleFilterChange('assetType', value)}
                >
                  {/* Passed as the backend fileType filter (matches file suffix). */}
                  <Select.Item value="all">All Types</Select.Item>
                  <Select.Item value="parquet">Parquet</Select.Item>
                  <Select.Item value="csv">CSV</Select.Item>
                  <Select.Item value="json">JSON</Select.Item>
                  <Select.Item value="xlsx">Excel</Select.Item>
                </Select>

                <Select
                  value={filters.status}
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <Select.Item value="all">All Status</Select.Item>
                  <Select.Item value="Cataloged">Cataloged</Select.Item>
                  <Select.Item value="Processing">Processing</Select.Item>
                  <Select.Item value="Failed">Failed</Select.Item>
                  <Select.Item value="Pending">Pending</Select.Item>
                </Select>

                <Select
                  value={filters.dateRange}
                  onValueChange={(value) => handleFilterChange('dateRange', value)}
                >
                  <Select.Item value="all">All Time</Select.Item>
                  <Select.Item value="24h">Last 24 Hours</Select.Item>
                  <Select.Item value="7d">Last 7 Days</Select.Item>
                  <Select.Item value="30d">Last 30 Days</Select.Item>
                </Select>
              </div>

              {(filters.dataSource !== 'all' || filters.assetType !== 'all' || filters.status !== 'all' || filters.dateRange !== 'all') && (
                <Button
                  variant="neutral-tertiary"
                  size="small"
                  onClick={() => setFilters({
                    dataSource: 'all',
                    assetType: 'all',
                    status: 'all',
                    dateRange: 'all'
                  })}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Inline error (keeps filters/search usable for a retry). */}
          {error && (
            <ErrorState message={error} onRetry={() => { fetchDiscoveredAssets(); fetchAssetStats(); }} />
          )}

          {/* Assets Table */}
          <div className="flex w-full flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background shadow-sm">
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>
                    <Button
                      variant="neutral-tertiary"
                      size="small"
                      onClick={() => handleSort('name')}
                    >
                      Asset Name
                    </Button>
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    <Button
                      variant="neutral-tertiary"
                      size="small"
                      onClick={() => handleSort('dataSource')}
                    >
                      Data Source
                    </Button>
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    <Button
                      variant="neutral-tertiary"
                      size="small"
                      onClick={() => handleSort('type')}
                    >
                      Type
                    </Button>
                  </Table.HeaderCell>
                  <Table.HeaderCell>Size</Table.HeaderCell>
                  <Table.HeaderCell>
                    <Button
                      variant="neutral-tertiary"
                      size="small"
                      onClick={() => handleSort('discoveryDate')}
                    >
                      Discovery Date
                    </Button>
                  </Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Quality</Table.HeaderCell>
                  <Table.HeaderCell>Actions</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {assets.map(asset => (
                <Table.Row key={asset.id}>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span
                        className="text-body-bold font-body-bold text-default-font cursor-pointer hover:text-brand-600"
                        onClick={() => handleViewAsset(asset)}
                      >
                        {asset.name}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {asset.fileType}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="neutral">{asset.dataSource}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-default-font">
                      {asset.fileType}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-default-font">
                      {asset.size}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {formatDateOnly(asset.discoveryDate)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={getStatusVariant(asset.status)}>
                      {asset.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <span className={`text-body-bold font-body-bold ${getQualityColor(asset.quality)}`}>
                        {asset.quality}%
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <IconButton
                      size="small"
                      icon={<FeatherEye />}
                      onClick={() => handleViewAsset(asset)}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>

            {/* Empty State */}
            {assets.length === 0 && (
              <div className="w-full p-4">
                <EmptyState
                  title="No assets found"
                  message={
                    searchQuery || Object.values(filters).some(f => f !== 'all')
                      ? "Try adjusting your search criteria or filters."
                      : "No assets have been discovered yet."
                  }
                  icon={<FeatherDatabase className="w-12 h-12 text-subtext-color" />}
                />
              </div>
            )}

            {/* Pagination */}
            {pagination.totalItems > 0 && (
              <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-4 px-4 pb-4">
                <span className="text-body font-body text-subtext-color">
                  Showing {assets.length === 0 ? 0 : startIndex + 1} to {pageEndIndex} of {pagination.totalItems} assets
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="neutral-tertiary"
                    size="small"
                    icon={<FeatherChevronLeft />}
                    disabled={pagination.currentPage === 1}
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                  >
                    Previous
                  </Button>
                  <span className="text-body font-body text-subtext-color">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="neutral-tertiary"
                    size="small"
                    iconRight={<FeatherChevronRight />}
                    disabled={pagination.currentPage === pagination.totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default DiscoveryAgentAssetLog;