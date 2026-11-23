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
  FeatherArrowLeft,
  FeatherBarChart3,
  FeatherCheck,
  FeatherDatabase,
  FeatherEdit,
  FeatherEye,
  FeatherFileText,
  FeatherGitBranch,
  FeatherSave,
  FeatherShield,
  FeatherTag,
  FeatherUsers,
  FeatherX,
} from "@subframe/core";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import LabelManagerPopup from "../components/LabelManagerPopup";
import { Avatar } from "../ui/components/Avatar";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconButton } from "../ui/components/IconButton";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Select } from "../ui/components/Select";
import { Table } from "../ui/components/Table";
import { TextField } from "../ui/components/TextField";
import { ToggleGroup } from "../ui/components/ToggleGroup";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import LineageGraph from "../components/LineageGraph";
import { catalogApi } from "../utils/api";
import {
  AssetComplianceStatusResponse,
  AssetPolicyMappingResponse,
  AssetUsageAnalyticsResponse,
  EnhancedLineageResponse,
  NOT_AVAILABLE_YET,
  getAssetComplianceStatus,
  getAssetPolicyMapping,
  getAssetUsageAnalytics,
  getEnhancedLineage,
  isNum,
} from "../utils/apiServices";
import { formatDateOnly } from "../utils/safeDate";

/** sessionStorage key DataCatalog writes the selected asset id into. */
const SELECTED_ASSET_KEY = "dlap.selectedAssetId";

/**
 * The core asset record as returned by da-catalog
 * GET /api/v1/catalog/assets/{assetId} (AssetOutputDTO). Only the fields this
 * view renders are modelled; casing matches the backend DTO.
 */
interface IAssetCore {
  assetId: string;
  assetName: string;
  assetType?: string;
  serviceType?: string;
  cloudProvider?: string;
  region?: string;
  assetUri?: string;
  description?: string;
  ownerInfo?: string;
  status?: string;
  discoveredAt?: string;
  lastScannedAt?: string;
  labels: string[];
  businessMetadataJson?: Record<string, unknown>;
  technicalMetadata?: Record<string, unknown>;
}

/** Editable business context - persisted via PUT /assets/{id}/business-context. */
interface IEditableContext {
  businessPurpose: string;
  dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
}

/** Generic per-section fetch state. */
type SectionState<T> = {
  data: T | null;
  loading: boolean;
  error: boolean;
};

const initialSection = <T,>(): SectionState<T> => ({
  data: null,
  loading: true,
  error: false,
});

/**
 * A count for display. Null or missing is NOT_AVAILABLE_YET, never 0: the
 * catalog sends null for a figure it has no stored source for.
 */
const formatCount = (value: number | null | undefined, digits = 0): string =>
  isNum(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: digits })
    : NOT_AVAILABLE_YET;

/** Heading style for a metric tile: large for a number, small for the placeholder. */
const metricClass = (value: number | null | undefined): string =>
  isNum(value)
    ? "text-heading-2 font-heading-2 text-default-font"
    : "text-body font-body text-subtext-color";

/** Badge colour for a policy compliance status. */
const getComplianceVariant = (status?: string | null) => {
  switch ((status || "").toUpperCase()) {
    case "COMPLIANT":
      return "success" as const;
    case "NON_COMPLIANT":
      return "error" as const;
    case "PARTIALLY_COMPLIANT":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
};

function AssetDetailView() {
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Selected asset id, read once from sessionStorage (DataCatalog set it).
  const [assetId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SELECTED_ASSET_KEY);
    } catch {
      return null;
    }
  });

  // Core asset (AssetOutputDTO).
  const [core, setCore] = useState<IAssetCore | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Enhanced sections (each fetched independently, each with its own state).
  const [usage, setUsage] =
    useState<SectionState<AssetUsageAnalyticsResponse>>(initialSection);
  const [lineage, setLineage] =
    useState<SectionState<EnhancedLineageResponse>>(initialSection);
  const [policies, setPolicies] =
    useState<SectionState<AssetPolicyMappingResponse>>(initialSection);
  const [compliance, setCompliance] =
    useState<SectionState<AssetComplianceStatusResponse>>(initialSection);

  // Business-context editing.
  const [isEditingContext, setIsEditingContext] = useState<boolean>(false);
  const [isSavingContext, setIsSavingContext] = useState<boolean>(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [editableContext, setEditableContext] = useState<IEditableContext>({
    businessPurpose: "",
    dataClassification: "INTERNAL",
  });

  // Label manager popup.
  const [labelPopupOpen, setLabelPopupOpen] = useState<boolean>(false);

  const mapCore = (dto: Pick<IAssetCore, "assetId"> & Partial<IAssetCore>): IAssetCore => ({
    assetId: dto.assetId,
    assetName: dto.assetName ?? dto.assetUri ?? "",
    assetType: dto.assetType,
    serviceType: dto.serviceType,
    cloudProvider: dto.cloudProvider,
    region: dto.region,
    assetUri: dto.assetUri,
    description: dto.description,
    ownerInfo: dto.ownerInfo,
    status: dto.status,
    discoveredAt: dto.discoveredAt,
    lastScannedAt: dto.lastScannedAt,
    labels: Array.isArray(dto.labels) ? dto.labels : [],
    businessMetadataJson: dto.businessMetadataJson,
    technicalMetadata: dto.technicalMetadata,
  });

  const readBusinessPurpose = (dto: IAssetCore): string => {
    const bm = dto.businessMetadataJson || {};
    const val =
      (bm["businessPurpose"] as string) ??
      (bm["purpose"] as string) ??
      (bm["businessDescription"] as string) ??
      "";
    return typeof val === "string" ? val : "";
  };

  const readClassification = (dto: IAssetCore): IEditableContext["dataClassification"] => {
    const bm = dto.businessMetadataJson || {};
    // Top-level key written by this page, else the one the structured
    // business-context endpoint stores under complianceClassification.
    const nested = (bm["complianceClassification"] as Record<string, unknown> | undefined)?.[
      "dataClassification"
    ];
    const rawValue = bm["dataClassification"] ?? nested ?? "";
    const raw = typeof rawValue === "string" ? rawValue : "";
    const upper = raw.toUpperCase();
    if (
      upper === "PUBLIC" ||
      upper === "INTERNAL" ||
      upper === "CONFIDENTIAL" ||
      upper === "RESTRICTED"
    ) {
      return upper;
    }
    return "INTERNAL";
  };

  const fetchCore = useCallback(async () => {
    if (!assetId) {
      setLoading(false);
      setError("No asset selected.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await catalogApi.get(`/assets/${assetId}`);
      const mapped = mapCore(response.data);
      setCore(mapped);
      setEditableContext({
        businessPurpose: readBusinessPurpose(mapped),
        dataClassification: readClassification(mapped),
      });
    } catch (err) {
      console.error("Error loading asset detail:", err);
      setError("Failed to load asset details.");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  const fetchUsage = useCallback(async () => {
    if (!assetId) return;
    setUsage({ data: null, loading: true, error: false });
    try {
      const data = await getAssetUsageAnalytics(assetId);
      setUsage({ data, loading: false, error: false });
    } catch (err) {
      console.error("Error loading usage analytics:", err);
      setUsage({ data: null, loading: false, error: true });
    }
  }, [assetId]);

  const fetchLineage = useCallback(async () => {
    if (!assetId) return;
    setLineage({ data: null, loading: true, error: false });
    try {
      const data = await getEnhancedLineage(assetId);
      setLineage({ data, loading: false, error: false });
    } catch (err) {
      console.error("Error loading lineage:", err);
      setLineage({ data: null, loading: false, error: true });
    }
  }, [assetId]);

  const fetchPolicies = useCallback(async () => {
    if (!assetId) return;
    setPolicies({ data: null, loading: true, error: false });
    try {
      const data = await getAssetPolicyMapping(assetId);
      setPolicies({ data, loading: false, error: false });
    } catch (err) {
      console.error("Error loading policy mapping:", err);
      setPolicies({ data: null, loading: false, error: true });
    }
  }, [assetId]);

  const fetchCompliance = useCallback(async () => {
    if (!assetId) return;
    setCompliance({ data: null, loading: true, error: false });
    try {
      const data = await getAssetComplianceStatus(assetId);
      setCompliance({ data, loading: false, error: false });
    } catch (err) {
      console.error("Error loading compliance status:", err);
      setCompliance({ data: null, loading: false, error: true });
    }
  }, [assetId]);

  useEffect(() => {
    fetchCore();
  }, [fetchCore]);

  // Load enhanced sections once the core asset is available.
  useEffect(() => {
    if (core?.assetId) {
      fetchUsage();
      fetchLineage();
      fetchPolicies();
      fetchCompliance();
    }
  }, [core?.assetId, fetchUsage, fetchLineage, fetchPolicies, fetchCompliance]);

  const handleBackToList = () => {
    window.navigateToDataCatalog?.();
  };

  const handleSaveContext = async () => {
    if (!core) return;
    setIsSavingContext(true);
    setContextError(null);
    try {
      // PUT /assets/{id}/metadata/business REPLACES the stored business
      // metadata document. Read the latest stored document first and merge the
      // two edited keys into it, so no other key is lost.
      // PUT /assets/{id}/business-context is not used: it expects a different
      // body, ignores this one, and stores an empty document (it wipes the
      // asset's business metadata). A merging endpoint is planned in CAT-02.
      const latest = await catalogApi.get(`/assets/${core.assetId}`);
      const stored = latest.data?.businessMetadataJson;
      const merged: Record<string, unknown> = {
        ...(stored && typeof stored === "object" ? stored : {}),
        businessPurpose: editableContext.businessPurpose,
        dataClassification: editableContext.dataClassification,
      };
      await catalogApi.put(`/assets/${core.assetId}/metadata/business`, merged);
      // Reflect exactly what was persisted.
      setCore((prev) => (prev ? { ...prev, businessMetadataJson: merged } : prev));
      setIsEditingContext(false);
    } catch (err) {
      console.error("Failed to update business context:", err);
      setContextError("Failed to save business context. Please try again.");
    } finally {
      setIsSavingContext(false);
    }
  };

  const handleCancelEdit = () => {
    if (core) {
      setEditableContext({
        businessPurpose: readBusinessPurpose(core),
        dataClassification: readClassification(core),
      });
    }
    setContextError(null);
    setIsEditingContext(false);
  };

  const handleViewPolicy = (policyId?: string | null) => {
    if (!policyId) return;
    window.navigateToPolicyDetailView?.(policyId);
  };

  const removeLabel = async (labelName: string) => {
    if (!core) return;
    try {
      await catalogApi.delete(
        `/assets/${core.assetId}/labels/${encodeURIComponent(labelName)}`
      );
      await fetchCore();
    } catch (err) {
      console.error("Error removing label:", err);
    }
  };

  const getStatusVariant = (status?: string) => {
    switch ((status || "").toUpperCase()) {
      case "ACTIVE":
        return "success" as const;
      case "ARCHIVED":
        return "warning" as const;
      case "DEPRECATED":
        return "neutral" as const;
      default:
        return "neutral" as const;
    }
  };

  const getRiskVariant = (risk?: string) => {
    switch ((risk || "").toUpperCase()) {
      case "CRITICAL":
      case "HIGH":
        return "error" as const;
      case "MEDIUM":
        return "warning" as const;
      case "LOW":
        return "success" as const;
      default:
        return "neutral" as const;
    }
  };

  const getSeverityVariant = (severity?: string) => {
    switch ((severity || "").toUpperCase()) {
      case "CRITICAL":
      case "HIGH":
        return "error" as const;
      case "MEDIUM":
        return "warning" as const;
      default:
        return "neutral" as const;
    }
  };

  /** Locale date for a timestamp, or "Unknown" when it is missing or malformed. */
  const formatDate = (value?: string | null) =>
    formatDateOnly(value, undefined, undefined, "Unknown");

  const tabs = [
    { id: "overview", label: "Overview", icon: <FeatherFileText /> },
    { id: "business", label: "Business Context", icon: <FeatherUsers /> },
    { id: "tags", label: "Labels & Tags", icon: <FeatherTag /> },
    { id: "metrics", label: "Usage Metrics", icon: <FeatherBarChart3 /> },
    { id: "policies", label: "Applied Policies", icon: <FeatherShield /> },
    { id: "lineage", label: "Lineage", icon: <FeatherGitBranch /> },
    { id: "compliance", label: "Compliance", icon: <FeatherCheck /> },
  ];

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-body font-body text-subtext-color">
            Loading asset details...
          </span>
        </div>
      </DefaultPageLayout>
    );
  }

  if (error || !core) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6">
          <ErrorState
            message={error || "The requested asset could not be found."}
            onRetry={assetId ? fetchCore : undefined}
          />
          <Button onClick={handleBackToList} icon={<FeatherArrowLeft />}>
            Back to Data Estate
          </Button>
        </div>
      </DefaultPageLayout>
    );
  }

  // Every section can be absent or null in the API response; read them safely.
  const usageMetrics = usage.data?.usageMetrics ?? null;
  const topUsers = usage.data?.userAnalytics?.topUsers ?? [];
  const appliedPolicies = [
    ...(policies.data?.applicablePolicies ?? []),
    ...(policies.data?.inheritedPolicies ?? []),
  ];
  const riskLevel = compliance.data?.riskAssessment?.overallRiskLevel ?? null;
  const frameworks = compliance.data?.frameworkCompliance ?? [];
  const violations = compliance.data?.violations ?? [];

  const displayType = core.assetType || core.serviceType || "Asset";
  const displaySource = core.cloudProvider || core.serviceType || "";
  const ownerName = core.ownerInfo || "Unknown";
  const ownerInitials = core.ownerInfo
    ? core.ownerInfo.substring(0, 2).toUpperCase()
    : "UN";

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
        {/* Header */}
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="neutral-tertiary"
              icon={<FeatherArrowLeft />}
              onClick={handleBackToList}
            >
              Back to Catalog
            </Button>
            <div className="flex items-center gap-3">
              <IconWithBackground icon={<FeatherDatabase />} />
              <div className="flex flex-col">
                <span className="text-heading-2 font-heading-2 text-default-font">
                  {core.assetName}
                </span>
                <span className="text-body font-body text-subtext-color">
                  {displayType}
                  {displaySource ? ` • ${displaySource}` : ""}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {core.status ? (
              <Badge variant={getStatusVariant(core.status)}>
                {core.status}
              </Badge>
            ) : null}
            <Button
              variant="neutral-tertiary"
              icon={<FeatherEdit />}
              onClick={() => {
                setActiveTab("business");
                setIsEditingContext(true);
              }}
            >
              Edit Asset
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex w-full border-b border-solid border-neutral-border">
          <ToggleGroup value={activeTab} onValueChange={setActiveTab}>
            {tabs.map((tab) => (
              <ToggleGroup.Item key={tab.id} icon={tab.icon} value={tab.id}>
                {tab.label}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup>
        </div>

        {/* Tab Content */}
        <div className="flex w-full grow shrink-0 basis-0 overflow-auto">
          {activeTab === "overview" && (
            <div className="flex w-full flex-col gap-6">
              <div className="flex w-full flex-col gap-4 p-6 bg-white rounded-lg border border-neutral-border">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Basic Information
                </span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Description
                    </span>
                    <span className="text-body font-body text-subtext-color">
                      {core.description || "No description available"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Owner
                    </span>
                    <div className="flex items-center gap-2">
                      <Avatar size="small">{ownerInitials}</Avatar>
                      <span className="text-body font-body text-default-font">
                        {ownerName}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Location
                    </span>
                    <span className="text-body font-body text-subtext-color font-mono text-sm">
                      {core.assetUri || "Unknown"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Region
                    </span>
                    <span className="text-body font-body text-subtext-color">
                      {core.region || "Unknown"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Discovered
                    </span>
                    <span className="text-body font-body text-subtext-color">
                      {formatDate(core.discoveredAt)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Last Scanned
                    </span>
                    <span className="text-body font-body text-subtext-color">
                      {formatDate(core.lastScannedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Labels */}
              <div className="flex w-full flex-col gap-4 p-6 bg-white rounded-lg border border-neutral-border">
                <div className="flex items-center justify-between">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Tags & Labels
                  </span>
                  <Button
                    variant="neutral-tertiary"
                    icon={<FeatherTag />}
                    onClick={() => setLabelPopupOpen(true)}
                  >
                    Manage Labels
                  </Button>
                </div>
                {core.labels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {core.labels.map((label, index) => (
                      <Badge key={index} variant="neutral">
                        {label}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No labels applied"
                    message="This asset has no labels yet."
                    icon={<FeatherTag className="w-8 h-8 text-subtext-color" />}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === "business" && (
            <div className="flex w-full flex-col gap-6">
              <div className="flex w-full flex-col gap-4 p-6 bg-white rounded-lg border border-neutral-border">
                <div className="flex items-center justify-between">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Business Context
                  </span>
                  {!isEditingContext && (
                    <Button
                      variant="neutral-tertiary"
                      icon={<FeatherEdit />}
                      onClick={() => setIsEditingContext(true)}
                    >
                      Edit Context
                    </Button>
                  )}
                </div>

                {isEditingContext ? (
                  <div className="flex flex-col gap-4">
                    {contextError ? <ErrorState message={contextError} /> : null}
                    <TextField label="Business Purpose" className="w-full">
                      <TextField.Input
                        value={editableContext.businessPurpose}
                        onChange={(e) =>
                          setEditableContext((prev) => ({
                            ...prev,
                            businessPurpose: e.target.value,
                          }))
                        }
                        placeholder="Describe the business purpose..."
                      />
                    </TextField>

                    <div className="flex flex-col gap-2">
                      <span className="text-body-bold font-body-bold text-default-font">
                        Data Classification
                      </span>
                      <Select
                        value={editableContext.dataClassification}
                        onValueChange={(value) =>
                          setEditableContext((prev) => ({
                            ...prev,
                            dataClassification:
                              value as IEditableContext["dataClassification"],
                          }))
                        }
                      >
                        <Select.Item value="PUBLIC">Public</Select.Item>
                        <Select.Item value="INTERNAL">Internal</Select.Item>
                        <Select.Item value="CONFIDENTIAL">
                          Confidential
                        </Select.Item>
                        <Select.Item value="RESTRICTED">Restricted</Select.Item>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        icon={<FeatherSave />}
                        onClick={handleSaveContext}
                        loading={isSavingContext}
                        disabled={isSavingContext}
                      >
                        Save Changes
                      </Button>
                      <Button
                        variant="neutral-tertiary"
                        icon={<FeatherX />}
                        onClick={handleCancelEdit}
                        disabled={isSavingContext}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        Purpose
                      </span>
                      <span className="text-body font-body text-subtext-color">
                        {readBusinessPurpose(core) || "Not specified"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        Classification
                      </span>
                      <Badge variant="neutral">
                        {readClassification(core)}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "tags" && (
            <div className="flex w-full flex-col gap-6">
              <div className="flex w-full flex-col gap-4 p-6 bg-white rounded-lg border border-neutral-border">
                <div className="flex items-center justify-between">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Labels & Tags Management
                  </span>
                  <Button
                    icon={<FeatherTag />}
                    onClick={() => setLabelPopupOpen(true)}
                  >
                    Manage Labels
                  </Button>
                </div>

                {core.labels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {core.labels.map((label, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 border border-neutral-border rounded-lg"
                      >
                        <Badge variant="neutral">{label}</Badge>
                        <IconButton
                          size="small"
                          icon={<FeatherX />}
                          onClick={() => removeLabel(label)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No labels applied"
                    message="Use Manage Labels to assign labels to this asset."
                    icon={<FeatherTag className="w-8 h-8 text-subtext-color" />}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === "metrics" && (
            <div className="flex w-full flex-col gap-6">
              {usage.loading ? (
                <div className="flex w-full h-40 items-center justify-center">
                  <span className="text-body font-body text-subtext-color">
                    Loading usage analytics...
                  </span>
                </div>
              ) : usage.error ? (
                <ErrorState
                  message="Failed to load usage analytics for this asset."
                  onRetry={fetchUsage}
                />
              ) : usage.data ? (
                <>
                  {usage.data.available === false ? (
                    <div className="flex w-full flex-col gap-1 rounded-lg border border-neutral-border bg-neutral-50 p-4">
                      <span className="text-body-bold font-body-bold text-default-font">
                        No usage has been recorded for this asset yet
                      </span>
                      <span className="text-body font-body text-subtext-color">
                        {usage.data.basis ||
                          "The catalog holds no stored access counts for this asset."}
                      </span>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="flex flex-col gap-2 p-4 bg-white rounded-lg border border-neutral-border">
                      <span className="text-body-bold font-body-bold text-default-font">
                        Total Accesses
                      </span>
                      <span className={metricClass(usageMetrics?.totalAccesses)}>
                        {formatCount(usageMetrics?.totalAccesses)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 p-4 bg-white rounded-lg border border-neutral-border">
                      <span className="text-body-bold font-body-bold text-default-font">
                        Unique Users
                      </span>
                      <span className={metricClass(usageMetrics?.uniqueUsers)}>
                        {formatCount(usageMetrics?.uniqueUsers)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 p-4 bg-white rounded-lg border border-neutral-border">
                      <span className="text-body-bold font-body-bold text-default-font">
                        Avg / Day
                      </span>
                      <span className={metricClass(usageMetrics?.avgAccessesPerDay)}>
                        {formatCount(usageMetrics?.avgAccessesPerDay, 1)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 p-4 bg-white rounded-lg border border-neutral-border">
                      <span className="text-body-bold font-body-bold text-default-font">
                        Last Access
                      </span>
                      <span className="text-body font-body text-default-font">
                        {usageMetrics?.lastAccessed
                          ? formatDate(usageMetrics.lastAccessed)
                          : NOT_AVAILABLE_YET}
                      </span>
                    </div>
                  </div>

                  {topUsers.length > 0 && (
                    <div className="flex w-full flex-col gap-4 p-6 bg-white rounded-lg border border-neutral-border">
                      <span className="text-heading-3 font-heading-3 text-default-font">
                        Top Users
                      </span>
                      <Table
                        header={
                          <Table.HeaderRow>
                            <Table.HeaderCell>User</Table.HeaderCell>
                            <Table.HeaderCell>Access Count</Table.HeaderCell>
                            <Table.HeaderCell>Last Access</Table.HeaderCell>
                          </Table.HeaderRow>
                        }
                      >
                        {topUsers.map((u, i) => (
                          <Table.Row key={u.userId ?? i}>
                            <Table.Cell>
                              <span className="text-body font-body text-default-font">
                                {u.username || u.userId || "-"}
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <span className="text-body font-body text-subtext-color">
                                {formatCount(u.accessCount)}
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <span className="text-body font-body text-subtext-color">
                                {formatDate(u.lastAccess)}
                              </span>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  title="No usage analytics"
                  message="No usage analytics are available for this asset yet."
                />
              )}
            </div>
          )}

          {activeTab === "policies" && (
            <div className="flex w-full flex-col gap-6">
              <div className="flex w-full flex-col gap-4 p-6 bg-white rounded-lg border border-neutral-border">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Applied Policies
                </span>
                {policies.loading ? (
                  <div className="flex w-full h-24 items-center justify-center">
                    <span className="text-body font-body text-subtext-color">
                      Loading policies...
                    </span>
                  </div>
                ) : policies.error ? (
                  <ErrorState
                    message="Failed to load policy mapping for this asset."
                    onRetry={fetchPolicies}
                  />
                ) : policies.data?.available === false ? (
                  <EmptyState
                    title={NOT_AVAILABLE_YET}
                    message={
                      policies.data.basis ||
                      "The catalog does not store which policies apply to this asset."
                    }
                  />
                ) : appliedPolicies.length > 0 ? (
                  <Table
                    header={
                      <Table.HeaderRow>
                        <Table.HeaderCell>Policy Name</Table.HeaderCell>
                        <Table.HeaderCell>Type</Table.HeaderCell>
                        <Table.HeaderCell>Applies Via</Table.HeaderCell>
                        <Table.HeaderCell>Compliance</Table.HeaderCell>
                        <Table.HeaderCell>Last Evaluated</Table.HeaderCell>
                        <Table.HeaderCell />
                      </Table.HeaderRow>
                    }
                  >
                    {appliedPolicies.map((policy, index) => (
                      <Table.Row key={policy.policyId ?? index}>
                        <Table.Cell>
                          <span
                            className="text-body-bold font-body-bold text-default-font cursor-pointer hover:text-brand-600"
                            onClick={() => handleViewPolicy(policy.policyId)}
                          >
                            {policy.policyName || "Unnamed policy"}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant="neutral">{policy.policyType || "-"}</Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant="neutral">
                            {(policy.applicabilityReason ?? "").replace(/_/g, " ") || "-"}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant={getComplianceVariant(policy.complianceStatus)}>
                            {(policy.complianceStatus ?? "UNKNOWN").replace(/_/g, " ")}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-body font-body text-subtext-color">
                            {formatDate(policy.lastEvaluated)}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <IconButton
                            icon={<FeatherEye />}
                            onClick={() => handleViewPolicy(policy.policyId)}
                          />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table>
                ) : (
                  <EmptyState
                    title="No policies applied"
                    message="No policies currently apply to this asset."
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === "lineage" && (
            <div className="flex w-full flex-col gap-6">
              {lineage.loading ? (
                <div className="flex w-full h-40 items-center justify-center">
                  <span className="text-body font-body text-subtext-color">
                    Loading lineage...
                  </span>
                </div>
              ) : lineage.error ? (
                <ErrorState
                  message="Failed to load lineage for this asset."
                  onRetry={fetchLineage}
                />
              ) : lineage.data &&
                (lineage.data.lineageGraph?.nodes?.length ?? 0) > 0 ? (
                <div className="flex w-full flex-col gap-4 p-6 bg-white rounded-lg border border-neutral-border">
                  <div className="flex items-center gap-x-6 gap-y-1 flex-wrap">
                    <span className="text-heading-3 font-heading-3 text-default-font">
                      Lineage Graph
                    </span>
                    {lineage.data.statistics ? (
                      <span className="text-body font-body text-subtext-color">
                        {formatCount(lineage.data.statistics.totalUpstreamAssets)} upstream ·{" "}
                        {formatCount(lineage.data.statistics.totalDownstreamAssets)} downstream ·{" "}
                        {formatCount(lineage.data.statistics.directDependencies)} direct
                        {lineage.data.statistics.lineageHealth
                          ? ` · ${lineage.data.statistics.lineageHealth}`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                  <LineageGraph data={lineage.data} rootAssetId={assetId ?? ""} />
                </div>
              ) : (
                <EmptyState
                  title="No lineage available"
                  message="No upstream or downstream lineage has been recorded for this asset."
                />
              )}
            </div>
          )}

          {activeTab === "compliance" && (
            <div className="flex w-full flex-col gap-6">
              {compliance.loading ? (
                <div className="flex w-full h-40 items-center justify-center">
                  <span className="text-body font-body text-subtext-color">
                    Loading compliance status...
                  </span>
                </div>
              ) : compliance.error ? (
                <ErrorState
                  message="Failed to load compliance status for this asset."
                  onRetry={fetchCompliance}
                />
              ) : compliance.data?.available === false ? (
                <EmptyState
                  title={NOT_AVAILABLE_YET}
                  message={
                    compliance.data.basis ||
                    "The catalog holds no compliance evaluation for this asset. Compliance is evaluated by the compliance service."
                  }
                />
              ) : compliance.data ? (
                <>
                  <div className="flex w-full flex-col gap-4 p-6 bg-white rounded-lg border border-neutral-border">
                    <span className="text-heading-3 font-heading-3 text-default-font">
                      Compliance Overview
                    </span>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-body-bold font-body-bold text-default-font">
                          Overall Score
                        </span>
                        <span
                          className={
                            isNum(compliance.data.overallComplianceScore)
                              ? "text-heading-2 font-heading-2 text-default-font"
                              : "text-body font-body text-subtext-color"
                          }
                        >
                          {isNum(compliance.data.overallComplianceScore)
                            ? Math.round(compliance.data.overallComplianceScore)
                            : NOT_AVAILABLE_YET}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-body-bold font-body-bold text-default-font">
                          Risk Level
                        </span>
                        {riskLevel ? (
                          <Badge variant={getRiskVariant(riskLevel)}>{riskLevel}</Badge>
                        ) : (
                          <span className="text-body font-body text-subtext-color">
                            {NOT_AVAILABLE_YET}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-body-bold font-body-bold text-default-font">
                          Frameworks
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {frameworks.length > 0 ? (
                            frameworks.map((f, i) => (
                              <Badge key={i} variant="neutral">
                                {f.frameworkName || "Unnamed framework"}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-body font-body text-subtext-color">
                              None
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-4 p-6 bg-white rounded-lg border border-neutral-border">
                    <span className="text-heading-3 font-heading-3 text-default-font">
                      Compliance Violations
                    </span>
                    {violations.length > 0 ? (
                      <Table
                        header={
                          <Table.HeaderRow>
                            <Table.HeaderCell>Type</Table.HeaderCell>
                            <Table.HeaderCell>Severity</Table.HeaderCell>
                            <Table.HeaderCell>Description</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                          </Table.HeaderRow>
                        }
                      >
                        {violations.map((issue, index) => (
                          <Table.Row key={issue.violationId || index}>
                            <Table.Cell>
                              <span className="text-body-bold font-body-bold text-default-font">
                                {(issue.violationType ?? "").replace(/_/g, " ") || "-"}
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <Badge variant={getSeverityVariant(issue.severity ?? undefined)}>
                                {issue.severity || "-"}
                              </Badge>
                            </Table.Cell>
                            <Table.Cell>
                              <span className="text-body font-body text-subtext-color">
                                {issue.description}
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <Badge
                                variant={
                                  issue.status === "RESOLVED"
                                    ? "success"
                                    : "warning"
                                }
                              >
                                {(issue.status ?? "").replace(/_/g, " ") || "-"}
                              </Badge>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table>
                    ) : (
                      <EmptyState
                        title="No violations"
                        message="No compliance violations are currently open for this asset."
                      />
                    )}
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No compliance data"
                  message="No compliance status is available for this asset yet."
                />
              )}
            </div>
          )}
        </div>
      </div>

      {labelPopupOpen && (
        <LabelManagerPopup
          isOpen={labelPopupOpen}
          assetId={core.assetId}
          assetName={core.assetName}
          onClose={() => setLabelPopupOpen(false)}
          onSaved={fetchCore}
        />
      )}
    </DefaultPageLayout>
  );
}

export default AssetDetailView;
