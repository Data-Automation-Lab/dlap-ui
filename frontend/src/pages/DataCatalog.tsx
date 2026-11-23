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

import {
  FeatherChevronLeft,
  FeatherChevronRight,
  FeatherDatabase,
  FeatherDownload,
  FeatherEye,
  FeatherFilter,
  FeatherGrid,
  FeatherList,
  FeatherMoreVertical,
  FeatherSearch,
  FeatherSortAsc,
  FeatherSortDesc,
  FeatherTag,
} from "@subframe/core";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "../ui/components/Avatar";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { CheckboxCard } from "../ui/components/CheckboxCard";
import { IconButton } from "../ui/components/IconButton";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Table } from "../ui/components/Table";
import { TextField } from "../ui/components/TextField";
import { ToggleGroup } from "../ui/components/ToggleGroup";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { EmptyState, ErrorState } from "../components/EmptyState";
import LabelManagerPopup from "../components/LabelManagerPopup";
import {
  getCatalogFilters,
  getAllCatalogAssets,
} from "../utils/apiServices";
import { compareSortValues } from "../utils/sortValues";

/** sessionStorage key used to hand the selected asset id to AssetDetailView. */
const SELECTED_ASSET_KEY = "dlap.selectedAssetId";

// A catalog asset row, derived from da-catalog's AssetOutputDTO.
interface IDataAsset {
  id: string;
  name: string;
  type: "FILE" | "PROJECT" | "OBJECT" | "FOLDER" | "DATASET";
  owner: {
    name: string;
    avatar: string;
    initials: string;
  };
  team: string;
  readOps: number;
  writeOps: number;
  labels: Array<{
    name: string;
    variant: "warning" | "success" | "neutral" | "error" | "brand";
  }>;
  lastUsed: string;
  dataSource: string;
  description?: string;
  storageLocation?: string;
  fullName?: string;
  volumeId?: string;
}

// Map a backend asset/service type (e.g. GCS_BUCKET, BIGQUERY_TABLE) to the UI's
// display category. Unknown/unmapped types fall back to DATASET.
const toUiAssetType = (backendType?: string): IDataAsset["type"] => {
  const t = (backendType || "").toUpperCase();
  if (/BUCKET|BLOB|OBJECT|STORAGE|DATA_LAKE/.test(t)) return "OBJECT";
  if (/FOLDER/.test(t)) return "FOLDER";
  if (/PROJECT/.test(t)) return "PROJECT";
  if (/FILE/.test(t)) return "FILE";
  return "DATASET";
};

interface IFilterState {
  dataSources: string[];
  assetTypes: string[];
  labels: string[];
}

interface IPaginationState {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
}

interface ISortState {
  field: string;
  direction: "asc" | "desc";
}

interface ICatalogFilters {
  dataSources: Array<{
    value: string;
    label: string;
    count: number;
  }>;
  assetTypes: Array<{
    value: string;
    label: string;
    count: number;
  }>;
  labels: Array<{
    value: string;
    label: string;
    count: number;
  }>;
  classifications: Array<{
    value: string;
    label: string;
    count: number;
  }>;
  owners: Array<{
    value: string;
    label: string;
    count: number;
  }>;
}

function DataCatalog() {
  // State management
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [filters, setFilters] = useState<IFilterState>({
    dataSources: [],
    assetTypes: [],
    labels: [],
  });
  const [assets, setAssets] = useState<IDataAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState<IPaginationState>({
    currentPage: 1,
    totalPages: 10,
    itemsPerPage: 10,
    totalItems: 100,
  });
  const [sort, setSort] = useState<ISortState>({
    field: "name",
    direction: "asc",
  });
  const [catalogFilters, setCatalogFilters] = useState<ICatalogFilters | null>(
    null
  );
  const [filtersLoading, setFiltersLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Asset whose labels are being managed via the LabelManagerPopup.
  const [labelAsset, setLabelAsset] = useState<IDataAsset | null>(null);
  // Asset whose row-actions dropdown is currently open (by id).
  const [actionsMenuAssetId, setActionsMenuAssetId] = useState<string | null>(
    null
  );
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  // P0-N: replaces the leftover Unity-Catalog endpoint with the real
  // da-catalog API. Hits /api/v1/catalog/assets via the shared
  // catalogApi axios instance (Keycloak JWT propagated).
  const fetchDataAssets = async (): Promise<IDataAsset[]> => {
    try {
      const page = await getAllCatalogAssets(0, 200);
      return page.content.map((asset) => {
        const technical = asset.technicalMetadata || {};
        const initials = asset.ownerInfo
          ? asset.ownerInfo.substring(0, 2).toUpperCase()
          : "UN";
        return {
          id: asset.assetId,
          name: asset.assetName || asset.assetUri,
          type: toUiAssetType(asset.assetType || asset.serviceType),
          owner: {
            name: asset.ownerInfo || "Unknown",
            avatar: "",
            initials,
          },
          team: asset.cloudProvider || "",
          readOps: Number((technical as Record<string, unknown>).readOps ?? 0),
          writeOps: Number((technical as Record<string, unknown>).writeOps ?? 0),
          labels: (asset.labels || []).map((label) => ({
            name: label,
            variant: "neutral",
          })),
          lastUsed: asset.lastScannedAt
            ? new Date(asset.lastScannedAt).toLocaleDateString()
            : "Unknown",
          dataSource: asset.cloudProvider || asset.serviceType || "",
          description: asset.description || "",
          storageLocation: asset.region || "",
          fullName: asset.assetUri,
          volumeId: asset.assetId,
        };
      });
    } catch (error) {
      console.error("Error fetching catalog assets:", error);
      throw error;
    }
  };

  // Real faceted-search filters from da-catalog GET /api/v1/catalog/filters.
  // On failure we return EMPTY facets (never fabricated counts/owners) so the
  // sidebar renders an honest empty state instead of invented data.
  const EMPTY_FILTERS: ICatalogFilters = {
    dataSources: [],
    assetTypes: [],
    labels: [],
    classifications: [],
    owners: [],
  };

  const fetchCatalogFilters = async (): Promise<ICatalogFilters> => {
    try {
      const response = await getCatalogFilters();

      // Transform the response to match our interface
      const dataSources =
        response.filterCategories.find((cat) => cat.name === "dataSource")
          ?.options || [];
      const assetTypes =
        response.filterCategories.find((cat) => cat.name === "assetType")
          ?.options || [];
      const labels =
        response.filterCategories.find((cat) => cat.name === "labels")
          ?.options || [];
      const classifications =
        response.filterCategories.find((cat) => cat.name === "classification")
          ?.options || [];
      const owners =
        response.filterCategories.find((cat) => cat.name === "owner")
          ?.options || [];

      return {
        dataSources,
        assetTypes,
        labels,
        classifications,
        owners,
      };
    } catch (error) {
      console.error("Error fetching catalog filters:", error);
      // No fabricated fallback — return empty facets.
      return EMPTY_FILTERS;
    }
  };

  const loadCatalogData = async () => {
    setLoading(true);
    setFiltersLoading(true);
    setError(null);

    try {
      // Load both assets and filters in parallel
      const [assetsData, filtersData] = await Promise.all([
        fetchDataAssets(),
        fetchCatalogFilters(),
      ]);

      setAssets(assetsData);
      setCatalogFilters(filtersData);
    } catch (error) {
      console.error("Error loading catalog data:", error);
      setError("Failed to load catalog data");
    } finally {
      setLoading(false);
      setFiltersLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load; loadData is recreated on every render and is also the Retry handler
  }, []);

  // Computed values for pagination
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // Search filter
      if (searchQuery) {
        const searchTerm = searchQuery.toLowerCase();
        const matchesSearch =
          asset.name.toLowerCase().includes(searchTerm) ||
          asset.description?.toLowerCase().includes(searchTerm) ||
          asset.labels.some((label) =>
            label.name.toLowerCase().includes(searchTerm)
          ) ||
          asset.team.toLowerCase().includes(searchTerm) ||
          asset.owner.name.toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;
      }

      // Data source filter
      if (
        filters.dataSources.length > 0 &&
        !filters.dataSources.includes(asset.dataSource)
      ) {
        return false;
      }

      // Asset type filter
      if (
        filters.assetTypes.length > 0 &&
        !filters.assetTypes.includes(asset.type)
      ) {
        return false;
      }

      // Labels filter
      if (filters.labels.length > 0) {
        const hasMatchingLabel = asset.labels.some((label) =>
          filters.labels.includes(label.name)
        );
        if (!hasMatchingLabel) return false;
      }

      return true;
    });
  }, [assets, searchQuery, filters]);

  // Apply sorting. The list used to be sorted into a throwaway copy, so the column buttons
  // changed the arrow and nothing else (QA-02 lint finding no-useless-assignment); the sorted
  // list now feeds the pagination below.
  const sortedAssets = useMemo(() => {
    const valueOf = (asset: IDataAsset): unknown =>
      sort.field === "owner" ? asset.owner.name : asset[sort.field as keyof IDataAsset];
    return [...filteredAssets].sort((a, b) =>
      compareSortValues(valueOf(a), valueOf(b), sort.direction)
    );
  }, [filteredAssets, sort]);

  // Update pagination
  useEffect(() => {
    const totalItems = sortedAssets.length;
    const totalPages = Math.ceil(totalItems / pagination.itemsPerPage);
    setPagination((prev) => ({
      ...prev,
      totalItems,
      totalPages,
      currentPage: Math.min(prev.currentPage, totalPages || 1),
    }));
  }, [sortedAssets, pagination.itemsPerPage]);

  // Handler functions
  const handleFilterChange = (
    filterType: keyof IFilterState,
    value: string,
    checked: boolean
  ) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: checked
        ? [...prev[filterType], value]
        : prev[filterType].filter((item) => item !== value),
    }));
  };

  const handleSort = (field: string) => {
    setSort((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleViewAssetDetails = (asset: IDataAsset) => {
    // Hand the selected asset id to AssetDetailView via sessionStorage (App.tsx
    // owns the router and its navigate helper takes no argument).
    try {
      sessionStorage.setItem(SELECTED_ASSET_KEY, asset.id);
    } catch {
      /* sessionStorage unavailable — AssetDetailView will show its empty state */
    }
    window.navigateToAssetDetailView?.();
  };

  const handleManageLabels = (asset: IDataAsset) => {
    setLabelAsset(asset);
  };

  const handleAssetActions = (asset: IDataAsset) => {
    setActionsMenuAssetId((prev) => (prev === asset.id ? null : asset.id));
  };

  /**
   * Export a single asset row as a client-side download of its real, already
   * fetched data. No backend call, no fabricated fields.
   */
  const handleExportAsset = (asset: IDataAsset, format: "json" | "csv") => {
    setActionsMenuAssetId(null);
    const record = {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      owner: asset.owner.name,
      dataSource: asset.dataSource,
      cloudProvider: asset.team,
      storageLocation: asset.storageLocation ?? "",
      fullName: asset.fullName ?? "",
      description: asset.description ?? "",
      labels: asset.labels.map((l) => l.name).join("; "),
      lastUpdated: asset.lastUsed,
    };

    let content: string;
    let mime: string;
    let ext: string;
    if (format === "json") {
      content = JSON.stringify(record, null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      const headers = Object.keys(record);
      const escape = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
      content =
        headers.join(",") +
        "\n" +
        headers.map((h) => escape((record as Record<string, unknown>)[h])).join(",");
      mime = "text/csv";
      ext = "csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = (asset.name || asset.id).replace(/[^a-zA-Z0-9_-]+/g, "_");
    link.download = `${safeName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Prefill the search box when another page (e.g. the Data Engineer dashboard)
  // navigates here with a query stashed in sessionStorage. Consume it once.
  useEffect(() => {
    const stashed = sessionStorage.getItem("dataCatalogSearchQuery");
    if (stashed) {
      setSearchQuery(stashed);
      sessionStorage.removeItem("dataCatalogSearchQuery");
    }
  }, []);

  // Close the row-actions dropdown when clicking outside of it.
  useEffect(() => {
    if (!actionsMenuAssetId) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(e.target as Node)
      ) {
        setActionsMenuAssetId(null);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [actionsMenuAssetId]);

  // Get paginated data
  const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
  const endIndex = startIndex + pagination.itemsPerPage;
  const paginatedAssets = sortedAssets.slice(startIndex, endIndex);

  // Helper function to get the appropriate sort icon
  const getSortIcon = (field: string) => {
    if (sort.field !== field) return null;
    return sort.direction === "asc" ? <FeatherSortAsc /> : <FeatherSortDesc />;
  };

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
        {/* Header */}
        <div className="flex w-full items-center justify-between">
          <span className="text-heading-2 font-heading-2 text-default-font">
            Data Estate
          </span>
          <div className="flex items-center gap-2">
            <ToggleGroup
              value={viewMode}
              onValueChange={(value: string) =>
                setViewMode(value as "list" | "grid")
              }
            >
              <ToggleGroup.Item icon={<FeatherList />} value="list">
                List
              </ToggleGroup.Item>
              <ToggleGroup.Item icon={<FeatherGrid />} value="grid">
                Grid
              </ToggleGroup.Item>
            </ToggleGroup>
          </div>
        </div>

        {/* Search Bar */}
        <TextField
          className="h-auto w-full flex-none"
          label=""
          helpText="Search across all data assets"
          icon={<FeatherSearch />}
        >
          <TextField.Input
            placeholder="Search assets by name, metadata, labels..."
            value={searchQuery}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setSearchQuery(event.target.value)
            }
          />
        </TextField>

        {/* Main Content Area */}
        <div className="flex w-full grow shrink-0 basis-0 items-start gap-6 overflow-hidden">
          {/* Faceted Filters Sidebar */}
          <div className="flex w-64 flex-none flex-col items-start gap-6 overflow-auto">
            {/* Data Source Filter */}
            <div className="flex w-full flex-col items-start gap-4">
              <div className="flex w-full items-center justify-between">
                <span className="text-body-bold font-body-bold text-default-font">
                  Data Source
                </span>
                <FeatherFilter className="w-4 h-4 text-subtext-color" />
              </div>
              <div className="flex w-full flex-col items-start gap-2">
                {filtersLoading ? (
                  <div className="text-body font-body text-subtext-color">
                    Loading filters...
                  </div>
                ) : catalogFilters?.dataSources &&
                  catalogFilters.dataSources.length > 0 ? (
                  catalogFilters.dataSources.map((source) => (
                    <CheckboxCard
                      key={source.value}
                      checked={filters.dataSources.includes(source.value)}
                      onCheckedChange={(checked: boolean) =>
                        handleFilterChange("dataSources", source.value, checked)
                      }
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-body font-body text-default-font">
                          {source.label}
                        </span>
                        <Badge variant="neutral" className="text-xs">
                          {source.count}
                        </Badge>
                      </div>
                    </CheckboxCard>
                  ))
                ) : (
                  <EmptyState
                    title="No data-source facets"
                    message="No data-source filters are available."
                  />
                )}
              </div>
            </div>

            {/* Asset Type Filter */}
            <div className="flex w-full flex-col items-start gap-4">
              <span className="text-body-bold font-body-bold text-default-font">
                Asset Type
              </span>
              <div className="flex w-full flex-col items-start gap-2">
                {filtersLoading ? (
                  <div className="text-body font-body text-subtext-color">
                    Loading filters...
                  </div>
                ) : catalogFilters?.assetTypes &&
                  catalogFilters.assetTypes.length > 0 ? (
                  catalogFilters.assetTypes.map((type) => (
                    <CheckboxCard
                      key={type.value}
                      checked={filters.assetTypes.includes(type.value)}
                      onCheckedChange={(checked: boolean) =>
                        handleFilterChange("assetTypes", type.value, checked)
                      }
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-body font-body text-default-font">
                          {type.label}
                        </span>
                        <Badge variant="neutral" className="text-xs">
                          {type.count}
                        </Badge>
                      </div>
                    </CheckboxCard>
                  ))
                ) : (
                  <EmptyState
                    title="No asset-type facets"
                    message="No asset-type filters are available."
                  />
                )}
              </div>
            </div>

            {/* Labels Filter */}
            <div className="flex w-full flex-col items-start gap-4">
              <span className="text-body-bold font-body-bold text-default-font">
                Labels
              </span>
              <div className="flex w-full flex-wrap items-start gap-2">
                {filtersLoading ? (
                  <div className="text-body font-body text-subtext-color">
                    Loading labels...
                  </div>
                ) : catalogFilters?.labels &&
                  catalogFilters.labels.length > 0 ? (
                  catalogFilters.labels.map((label) => (
                    <Badge
                      key={label.value}
                      variant={
                        filters.labels.includes(label.value)
                          ? "brand"
                          : "neutral"
                      }
                      className="cursor-pointer"
                      onClick={() =>
                        handleFilterChange(
                          "labels",
                          label.value,
                          !filters.labels.includes(label.value)
                        )
                      }
                    >
                      {label.label} ({label.count})
                    </Badge>
                  ))
                ) : (
                  <EmptyState
                    title="No label facets"
                    message="No label filters are available."
                  />
                )}
              </div>
            </div>

            {/* Enhanced Features - Classifications Filter */}
            {catalogFilters?.classifications &&
              catalogFilters.classifications.length > 0 && (
                <div className="flex w-full flex-col items-start gap-4">
                  <span className="text-body-bold font-body-bold text-default-font">
                    Classification
                  </span>
                  <div className="flex w-full flex-col items-start gap-2">
                    {catalogFilters.classifications.map((classification) => (
                      <CheckboxCard
                        key={classification.value}
                        checked={false} // TODO: Add classification filter to state
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-body font-body text-default-font">
                            {classification.label}
                          </span>
                          <Badge variant="neutral" className="text-xs">
                            {classification.count}
                          </Badge>
                        </div>
                      </CheckboxCard>
                    ))}
                  </div>
                </div>
              )}

            {/* Clear Filters */}
            {(filters.dataSources.length > 0 ||
              filters.assetTypes.length > 0 ||
              filters.labels.length > 0) && (
              <Button
                variant="neutral-tertiary"
                className="w-full"
                onClick={() =>
                  setFilters({ dataSources: [], assetTypes: [], labels: [] })
                }
              >
                Clear All Filters
              </Button>
            )}
          </div>

          {/* Assets Content Area */}
          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 overflow-auto">
            {loading ? (
              <div className="flex w-full h-64 items-center justify-center">
                <span className="text-body font-body text-subtext-color">
                  Loading assets...
                </span>
              </div>
            ) : error ? (
              <ErrorState message={error} onRetry={loadCatalogData} />
            ) : viewMode === "list" ? (
              /* List View */
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>
                      <Button
                        variant="neutral-tertiary"
                        size="small"
                        onClick={() => handleSort("name")}
                        iconRight={getSortIcon("name")}
                      >
                        Asset Name
                      </Button>
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      <Button
                        variant="neutral-tertiary"
                        size="small"
                        onClick={() => handleSort("type")}
                        iconRight={getSortIcon("type")}
                      >
                        Type
                      </Button>
                    </Table.HeaderCell>
                    <Table.HeaderCell>Owner</Table.HeaderCell>
                    <Table.HeaderCell>Schema</Table.HeaderCell>
                    <Table.HeaderCell>Storage Location</Table.HeaderCell>
                    <Table.HeaderCell>Labels</Table.HeaderCell>
                    <Table.HeaderCell>Last Updated</Table.HeaderCell>
                    <Table.HeaderCell />
                  </Table.HeaderRow>
                }
              >
                {paginatedAssets.map((asset) => {
                  return (
                    <Table.Row key={asset.id}>
                      <Table.Cell>
                        <span
                          className="text-body-bold font-body-bold text-default-font cursor-pointer hover:text-brand-600"
                          onClick={() => handleViewAssetDetails(asset)}
                        >
                          {asset.name}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <IconWithBackground icon={<FeatherDatabase />} />
                          <span className="text-body font-body text-default-font">
                            {asset.type}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <Avatar size="small" image={asset.owner.avatar}>
                            {asset.owner.initials}
                          </Avatar>
                          <span className="text-body font-body text-default-font">
                            {asset.owner.name}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant="neutral">{asset.team}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-body font-body text-subtext-color">
                          {asset.storageLocation}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-1">
                          {asset.labels.map((label, index) => (
                            <Badge key={index} variant={label.variant}>
                              {label.name}
                            </Badge>
                          ))}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-body font-body text-subtext-color">
                          {asset.lastUsed}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center justify-end gap-2">
                          <IconButton
                            icon={<FeatherEye />}
                            onClick={() => handleViewAssetDetails(asset)}
                          />
                          <IconButton
                            icon={<FeatherTag />}
                            onClick={() => handleManageLabels(asset)}
                          />
                          <div
                            className="relative"
                            ref={
                              actionsMenuAssetId === asset.id
                                ? actionsMenuRef
                                : undefined
                            }
                          >
                            <IconButton
                              icon={<FeatherMoreVertical />}
                              onClick={() => handleAssetActions(asset)}
                            />
                            {actionsMenuAssetId === asset.id && (
                              <div className="absolute right-0 z-20 mt-1 flex w-44 flex-col rounded-md border border-solid border-neutral-border bg-white py-1 shadow-lg">
                                <button
                                  type="button"
                                  className="flex items-center gap-2 px-3 py-2 text-left text-body font-body text-default-font hover:bg-neutral-50"
                                  onClick={() => {
                                    setActionsMenuAssetId(null);
                                    handleViewAssetDetails(asset);
                                  }}
                                >
                                  <FeatherEye className="h-4 w-4" />
                                  View details
                                </button>
                                <button
                                  type="button"
                                  className="flex items-center gap-2 px-3 py-2 text-left text-body font-body text-default-font hover:bg-neutral-50"
                                  onClick={() =>
                                    handleExportAsset(asset, "json")
                                  }
                                >
                                  <FeatherDownload className="h-4 w-4" />
                                  Export JSON
                                </button>
                                <button
                                  type="button"
                                  className="flex items-center gap-2 px-3 py-2 text-left text-body font-body text-default-font hover:bg-neutral-50"
                                  onClick={() => handleExportAsset(asset, "csv")}
                                >
                                  <FeatherDownload className="h-4 w-4" />
                                  Export CSV
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table>
            ) : (
              /* Grid View — real card layout from the same asset data. */
              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {paginatedAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex flex-col gap-3 rounded-lg border border-solid border-neutral-border bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => handleViewAssetDetails(asset)}
                      >
                        <IconWithBackground icon={<FeatherDatabase />} />
                        <div className="flex flex-col">
                          <span className="text-body-bold font-body-bold text-default-font hover:text-brand-600">
                            {asset.name}
                          </span>
                          <span className="text-caption font-caption text-subtext-color">
                            {asset.type}
                          </span>
                        </div>
                      </div>
                      <Badge variant="neutral">{asset.team}</Badge>
                    </div>
                    {asset.description ? (
                      <span className="line-clamp-2 text-body font-body text-subtext-color">
                        {asset.description}
                      </span>
                    ) : null}
                    <div className="flex flex-wrap gap-1">
                      {asset.labels.map((label, index) => (
                        <Badge key={index} variant={label.variant}>
                          {label.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-solid border-neutral-border pt-2">
                      <div className="flex items-center gap-2">
                        <Avatar size="small" image={asset.owner.avatar}>
                          {asset.owner.initials}
                        </Avatar>
                        <span className="text-caption font-caption text-subtext-color">
                          {asset.owner.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <IconButton
                          size="small"
                          icon={<FeatherEye />}
                          onClick={() => handleViewAssetDetails(asset)}
                        />
                        <IconButton
                          size="small"
                          icon={<FeatherTag />}
                          onClick={() => handleManageLabels(asset)}
                        />
                        <IconButton
                          size="small"
                          icon={<FeatherDownload />}
                          onClick={() => handleExportAsset(asset, "json")}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State — assets are ingested by discovery, not added here. */}
            {!loading && filteredAssets.length === 0 && (
              <EmptyState
                title="No assets found"
                message={
                  searchQuery ||
                  filters.dataSources.length > 0 ||
                  filters.assetTypes.length > 0 ||
                  filters.labels.length > 0
                    ? "Try adjusting your search criteria or filters."
                    : "No assets have been discovered yet. Assets appear here once the Discovery agent scans your connected sources."
                }
                icon={
                  <FeatherDatabase className="w-12 h-12 text-subtext-color" />
                }
              />
            )}

            {/* Pagination */}
            {!loading && filteredAssets.length > 0 && (
              <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-4">
                <Button
                  variant="neutral-tertiary"
                  icon={<FeatherChevronLeft />}
                  disabled={pagination.currentPage === 1}
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      currentPage: prev.currentPage - 1,
                    }))
                  }
                >
                  Previous
                </Button>
                <span className="text-body font-body text-subtext-color">
                  Page {pagination.currentPage} of {pagination.totalPages} (
                  {pagination.totalItems} total assets)
                </span>
                <Button
                  variant="neutral-tertiary"
                  iconRight={<FeatherChevronRight />}
                  disabled={pagination.currentPage === pagination.totalPages}
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      currentPage: prev.currentPage + 1,
                    }))
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {labelAsset && (
        <LabelManagerPopup
          isOpen={!!labelAsset}
          assetId={labelAsset.id}
          assetName={labelAsset.name}
          onClose={() => setLabelAsset(null)}
          onSaved={loadCatalogData}
        />
      )}
    </DefaultPageLayout>
  );
}

export default DataCatalog;
