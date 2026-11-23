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
  FeatherArchive,
  FeatherArrowLeft,
  FeatherArrowRight,
  FeatherCheck,
  FeatherCheckCircle,
  FeatherCode,
  FeatherDatabase,
  FeatherEye,
  FeatherFileText,
  FeatherFilter,
  FeatherPlay,
  FeatherPlus,
  FeatherSave,
  FeatherShield,
  FeatherTag,
  FeatherTrash2,
  FeatherX,
  FeatherZap
} from "@subframe/core";
import React, { useEffect, useState } from "react";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { Checkbox } from "../ui/components/Checkbox";
import { IconButton } from "../ui/components/IconButton";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Progress } from "../ui/components/Progress";
import { RadioGroup } from "../ui/components/RadioGroup";
import { Select } from "../ui/components/Select";
import { Switch } from "../ui/components/Switch";
import { Table } from "../ui/components/Table";
import { TextArea } from "../ui/components/TextArea";
import { TextField } from "../ui/components/TextField";
import { ToggleGroup } from "../ui/components/ToggleGroup";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";

// Import our Priority 1 policy endpoints
import {
    AccessObligation,
    PolicyDraftCreateRequest,
    PolicyImpactRequest,
    analyzePolicyImpact,
    approvePolicyDraft,
    createPolicyDraft,
    publishPolicyDraft,
    submitPolicyDraft
} from "../utils/apiServices";
import { serverMessage } from '../utils/httpError';

// C2b-access-PolicyWizardFlow: AccessPolicy authoring option sets. Tiers come
// from ADR-0032 (four org tiers); roles are the realm roles in
// DalabConstants.UserRole; actions are the AuthZEN verbs the backend accepts.
const ACCESS_TIERS = ['EXECUTIVE', 'LEADERSHIP', 'PRACTITIONER', 'READER'] as const;
const ACCESS_ROLES = [
  'ADMIN',
  'CDO',
  'DIRECTOR',
  'POLICY_MANAGER',
  'DATA_ENGINEER',
  'DATA_SCIENTIST',
  'DATA_ANALYST',
  'AUDITOR',
  'VIEWER',
] as const;
const ACCESS_ACTIONS = ['read', 'query', 'export', 'write', 'delete'] as const;
const ACCESS_OBLIGATION_TYPES = ['mask', 'redact_rows', 'log_only'] as const;

// Types for policy wizard data
interface IPolicyStep {
  id: number;
  name: string;
  icon: React.ReactNode;
  completed: boolean;
  active: boolean;
}

interface ICondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  logicOperator?: 'AND' | 'OR';
}

// The settings a wizard action can carry. Free-form beyond the named keys on purpose: the
// backend receives them as the DSL action parameters (buildActionParameters).
interface IActionConfig {
  label?: string;
  labelName?: string;
  labelDescription?: string;
  labelColor?: string;
  storageTier?: string;
  retentionDays?: string;
  [setting: string]: unknown;
}

interface IPolicyAction {
  type: string;
  config: IActionConfig;
}

// C2b: obligation row with a stable id for UI list management. Serialized down
// to AccessObligation ({type, labels}) on save.
interface IAccessObligationRow {
  id: string;
  type: string; // mask | redact_rows | log_only
  labels: string; // comma-separated in the UI; split on save
}

interface IPolicyForm {
  // General Info
  name: string;
  description: string;
  // C2b: policy kind. 'Policy' = lifecycle (default, unchanged path);
  // 'AccessPolicy' = AuthZEN access authoring.
  kind: 'Policy' | 'AccessPolicy';
  type: 'labeling' | 'archival' | 'deletion' | 'compliance';
  priority: 'high' | 'medium' | 'low';

  // Conditions
  conditions: ICondition[];
  advancedMode: boolean;
  advancedQuery: string;

  // Actions
  actions: IPolicyAction[];

  // Review & Impact
  estimatedAffectedAssets: number;
  estimatedUsersImpacted: number;
  complianceImpact: string;

  // Activation
  saveAs: 'draft' | 'active';
  notifyUsers: boolean;
  scheduleActivation: boolean;
  activationDate?: string;

  // C2b AccessPolicy authoring (only meaningful when kind === 'AccessPolicy')
  accessTiers: string[];
  accessRoles: string[];
  accessActions: string[];
  accessPurpose: string; // comma-separated in the UI
  accessConsent: 'unset' | 'true' | 'false'; // tri-state; unset omits the key
  accessRegion: string; // comma-separated in the UI
  accessEffect: 'allow' | 'deny';
  accessObligations: IAccessObligationRow[];
}

interface IImpactPreview {
  affectedAssets: number;
  estimatedCostSavings?: number;
  complianceRisk: 'low' | 'medium' | 'high';
  riskReasons: string[];
  breakdown?: Record<string, number>;
  recommendations?: string[];
}

// Real API functions using our Priority 1 endpoints
const fetchImpactPreview = async (form: IPolicyForm): Promise<IImpactPreview | null> => {
  try {
    // Build policy rules string from conditions and actions
    const rulesString = buildPolicyRulesString(form);
    
    // Create impact analysis request
    const impactRequest: PolicyImpactRequest = {
      policyRules: rulesString,
      analysisType: 'FULL',
      targetScope: {
        assetTypes: getAssetTypesFromConditions(form.conditions),
        labels: getLabelsFromConditions(form.conditions),
      },
      includePerformanceEstimates: true,
      includeCostImpact: form.type === 'archival' || form.type === 'deletion',
      includeComplianceAnalysis: true,
    };
    
    // Call our Priority 1 impact analysis endpoint
    const impactResponse = await analyzePolicyImpact(impactRequest);
    
    return {
      affectedAssets: impactResponse.totalAssetsAffected,
      estimatedCostSavings: impactResponse.costImpact?.potentialSavings,
      complianceRisk: mapComplianceRisk(impactResponse.complianceAnalysis?.potentialViolations || 0),
      riskReasons: impactResponse.recommendedActions,
      breakdown: impactResponse.assetBreakdown,
      recommendations: impactResponse.complianceAnalysis?.recommendations || [],
    };
  } catch (error) {
    // No impact-analysis data available — surface "unavailable" rather
    // than fabricating numbers.
    console.error('Policy impact analysis failed', error);
    return null;
  }
};

// C2b: split a comma/whitespace-separated UI string into a trimmed, non-empty
// list. Empty input yields [] so we never send empty-string tokens.
const splitList = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

// C2b-access-PolicyWizardFlow: assemble the AccessPolicy half of a draft
// request. rulesDefinition is REUSED as the spec.match asset selector (same
// {field,operator,value} shape as lifecycle match — label conditions matter
// here). Empty optional sub-objects/arrays are omitted so backend validation
// (which rejects empty subjects/actions/invalid effect with a 400) only sees
// what the user actually picked.
const buildAccessDraftRequest = (form: IPolicyForm): PolicyDraftCreateRequest => {
  const rulesDefinition = form.conditions.map((c) => ({
    field: c.field,
    operator: c.operator,
    value: c.value,
  }));

  const purpose = splitList(form.accessPurpose);
  const region = splitList(form.accessRegion);
  const condition: PolicyDraftCreateRequest['accessCondition'] = {};
  if (purpose.length > 0) condition.purpose = purpose;
  if (region.length > 0) condition.region = region;
  if (form.accessConsent !== 'unset') condition.consent = form.accessConsent === 'true';

  const obligations: AccessObligation[] = form.accessObligations
    .filter((o) => o.type)
    .map((o) => ({ type: o.type, labels: splitList(o.labels) }));

  const request: PolicyDraftCreateRequest = {
    name: form.name,
    description: form.description,
    // AccessPolicy has no lifecycle category; backend requires the field, so
    // default to COMPLIANCE (access governance) — kind is what actually routes.
    category: 'COMPLIANCE',
    priority: mapPriority(form.priority),
    kind: 'AccessPolicy',
    rulesDefinition,
    accessSubjects: { tiers: form.accessTiers, roles: form.accessRoles },
    accessActions: form.accessActions,
    accessEffect: form.accessEffect,
    targetScope: {
      labels: getLabelsFromConditions(form.conditions),
    },
  };
  if (Object.keys(condition).length > 0) request.accessCondition = condition;
  if (obligations.length > 0) request.accessObligations = obligations;
  return request;
};

const savePolicyDraft = async (
  form: IPolicyForm
): Promise<{ success: boolean; draftId?: string; error?: string }> => {
  try {
    console.log('💾 Creating Policy Draft...');

    // C2b: AccessPolicy path builds its own request (kind + access* fields).
    // Lifecycle path is UNCHANGED — no kind field, no access* fields.
    let draftRequest: PolicyDraftCreateRequest;
    if (form.kind === 'AccessPolicy') {
      draftRequest = buildAccessDraftRequest(form);
    } else {
      // ADR-0031: send STRUCTURED conditions + a single action so the backend
      // can translate them into the canonical dlap/v1 DSL on publish. The flat
      // `rules` string the backend ignores is no longer relied upon.
      const rulesDefinition = form.conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value,
      }));

      // v1 = one action per policy: send only the selected action (the UI is
      // single-select), mapped onto a DSL action type with normalized params.
      const firstAction = form.actions[0]
        ? {
            type: mapActionType(form.actions[0].type),
            parameters: buildActionParameters(form.actions[0]),
            requireApproval: false,
            dryRun: false,
          }
        : undefined;

      // Create draft request from form data
      draftRequest = {
        name: form.name,
        description: form.description,
        category: mapPolicyTypeToCategory(form.type),
        priority: mapPriority(form.priority),
        rulesDefinition,
        actions: firstAction,
        targetScope: {
          assetTypes: getAssetTypesFromConditions(form.conditions),
          labels: getLabelsFromConditions(form.conditions),
        },
      };
    }

    // Call our Priority 1 draft creation endpoint
    const draftResponse = await createPolicyDraft(draftRequest);

    console.log('✅ Policy Draft Created:', draftResponse.id);
    return { success: true, draftId: draftResponse.id };
  } catch (error) {
    console.error('❌ Policy Draft Creation Error:', error);
    // Surface the backend's actionable 400 message (e.g. missing action /
    // empty match on a destructive policy) instead of a generic string.
    return { success: false, error: serverMessage(error) };
  }
};

const activatePolicy = async (
  form: IPolicyForm,
  draftId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🚀 Activating Policy...');

    if (form.saveAs === 'draft') {
      // Just save as draft - already done in savePolicyDraft
      return { success: true };
    }

    if (!draftId) {
      // Create draft first if not exists
      const draftResult = await savePolicyDraft(form);
      if (!draftResult.success || !draftResult.draftId) {
        return { success: false, error: draftResult.error };
      }
      draftId = draftResult.draftId;
    }

    // Immediate-activation path: run the draft through the real
    // submit -> approve -> publish endpoints in da-policyengine. Publish is
    // where the backend validates the DSL and can 400 (e.g. empty match on a
    // destructive action) — surface that message to the user.
    await submitPolicyDraft(draftId);
    await approvePolicyDraft(draftId, 'Approved via Policy Wizard (immediate activation)');
    await publishPolicyDraft(draftId);

    return { success: true };
  } catch (error) {
    console.error('Policy activation failed', error);
    return { success: false, error: serverMessage(error) };
  }
};

// Helper functions for API integration
const buildPolicyRulesString = (form: IPolicyForm): string => {
  if (form.advancedMode && form.advancedQuery) {
    return form.advancedQuery;
  }
  
  // Build rules from conditions
  const conditionStrings = form.conditions.map(condition => {
    return `${condition.field} ${condition.operator} "${condition.value}"`;
  });
  
  const baseRule = conditionStrings.join(' AND ');
  const actionStrings = form.actions.map(action => {
    const configEntries = Object.entries(action.config || {})
      .filter(([, v]) => v != null && `${v}`.trim() !== '')
      .map(([k, v]) => `${k}=${v}`);
    return configEntries.length > 0
      ? `ACTION: ${action.type}(${configEntries.join(', ')})`
      : `ACTION: ${action.type}`;
  });

  return `WHEN ${baseRule} THEN ${actionStrings.join(', ')}`;
};

const getAssetTypesFromConditions = (conditions: ICondition[]): string[] => {
  return conditions
    .filter(c => c.field === 'assetType' || c.field === 'dataType')
    .map(c => c.value);
};

const getLabelsFromConditions = (conditions: ICondition[]): string[] => {
  return conditions
    .filter(c => c.field === 'labels' || c.field === 'label' || c.field === 'classification')
    .map(c => c.value);
};

const mapPolicyTypeToCategory = (type: string): 'LABELING' | 'ARCHIVAL' | 'DELETION' | 'COMPLIANCE' => {
  switch (type) {
    case 'labeling': return 'LABELING';
    case 'archival': return 'ARCHIVAL';
    case 'deletion': return 'DELETION';
    case 'compliance': return 'COMPLIANCE';
    default: return 'COMPLIANCE';
  }
};

/** Map the wizard's lowercase priority onto the backend's uppercase enum. */
const mapPriority = (priority: string): 'HIGH' | 'MEDIUM' | 'LOW' => {
  switch (priority) {
    case 'high': return 'HIGH';
    case 'low': return 'LOW';
    default: return 'MEDIUM';
  }
};

const mapComplianceRisk = (violations: number): 'low' | 'medium' | 'high' => {
  if (violations === 0) return 'low';
  if (violations <= 2) return 'medium';
  return 'high';
};

/**
 * ADR-0031: map the wizard's action-type values (see getPolicyTypeActions)
 * onto the canonical dlap/v1 DSL action types the backend translator
 * understands: archive, delete, addLabel, removeLabel, alert.email,
 * setRetention, tagAsset. Unknown values pass through unchanged.
 */
const mapActionType = (t: string): string => {
  switch (t) {
    // Labeling actions → addLabel
    case 'classify_pii':
    case 'classify_financial':
    case 'classify_sensitive':
    case 'apply_custom':
    case 'label':
    case 'addLabel':
      return 'addLabel';
    case 'removeLabel':
      return 'removeLabel';
    // Archival actions → archive
    case 'move_cold_storage':
    case 'compress_data':
    case 'create_backup':
    case 'archive':
      return 'archive';
    // Deletion actions → delete
    case 'soft_delete':
    case 'permanent_delete':
    case 'secure_wipe':
    case 'delete':
      return 'delete';
    // Notification/alert → alert.email
    case 'notify':
    case 'alert':
      return 'alert.email';
    // Retention → setRetention
    case 'retention_check':
    case 'retention':
    case 'setRetention':
      return 'setRetention';
    // Tagging → tagAsset
    case 'tag':
    case 'tagAsset':
      return 'tagAsset';
    // Compliance checks (gdpr_check/hipaa_check/retention_check handled above)
    // have no dedicated DSL action; the only meaningful, consumed outcome is
    // an email alert. removeLabel/setRetention pass through when already DSL.
    case 'evaluateCompliance':
      // No service consumes evaluateCompliance yet — surface as an alert
      // rather than emitting a silently no-op action type.
      return 'alert.email';
    default: {
      // Only allow values that are real, consumed DSL action types through.
      // Anything else maps to alert.email so no wizard selection produces an
      // action type no service consumes.
      const CONSUMED = new Set([
        'archive',
        'delete',
        'addLabel',
        'removeLabel',
        'alert.email',
        'setRetention',
        'tagAsset',
      ]);
      return CONSUMED.has(t) ? t : 'alert.email';
    }
  }
};

// ADR-0031: which DSL operators are valid for each match-clause field. A
// nonsensical field/operator pair (e.g. sizeBytes + matches) compiles to a
// policy that either errors or matches everything, so the UI must constrain
// the operator options to those valid for the selected field.
interface OperatorOption {
  value: string;
  label: string;
}

const OPERATORS_BY_FIELD: Record<string, OperatorOption[]> = {
  labels: [
    { value: 'anyOf', label: 'any of' },
    { value: 'noneOf', label: 'none of' },
    { value: 'allOf', label: 'all of' },
  ],
  sizeBytes: [
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'equals', label: 'equals' },
  ],
  lastAccessedAt: [
    { value: 'olderThan', label: 'older than' },
    { value: 'youngerThan', label: 'younger than' },
  ],
  assetType: [
    { value: 'equals', label: 'equals' },
    { value: 'anyOf', label: 'any of' },
    { value: 'noneOf', label: 'none of' },
  ],
  cloudProvider: [
    { value: 'equals', label: 'equals' },
    { value: 'anyOf', label: 'any of' },
    { value: 'noneOf', label: 'none of' },
  ],
  region: [
    { value: 'equals', label: 'equals' },
    { value: 'anyOf', label: 'any of' },
    { value: 'noneOf', label: 'none of' },
  ],
  nameMatches: [
    { value: 'matches', label: 'matches regex' },
  ],
};

/** Operator options valid for a field (empty until a field is chosen). */
const operatorsForField = (field: string): OperatorOption[] =>
  OPERATORS_BY_FIELD[field] ?? [];

/** The default (first valid) operator for a field, or '' if none. */
const defaultOperatorForField = (field: string): string =>
  operatorsForField(field)[0]?.value ?? '';

/**
 * DSL action types whose parameters require a `label` (the label to
 * add/remove). Seed a sensible default label from the wizard's labeling
 * action tiles so autolabel doesn't drop the event as 'missing label'.
 */
const DEFAULT_LABEL_FOR_ACTION: Record<string, string> = {
  classify_pii: 'PII',
  classify_financial: 'FINANCIAL',
  classify_sensitive: 'SENSITIVE',
};

/**
 * Build the DSL action `parameters` object for a wizard action. For label
 * actions the DSL requires a `label` key; the wizard stores the custom label
 * under `labelName`, and the classify_* tiles seed `label` directly — normalize
 * both onto `parameters.label` so autolabel doesn't drop the event.
 */
const buildActionParameters = (action: IPolicyAction): Record<string, unknown> => {
  const dslType = mapActionType(action.type);
  const config = { ...(action.config ?? {}) };
  if (dslType === 'addLabel' || dslType === 'removeLabel') {
    const label =
      config.label ??
      config.labelName ??
      DEFAULT_LABEL_FOR_ACTION[action.type] ??
      '';
    return { ...config, label };
  }
  return config;
};

function PolicyWizardFlow() {
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<IPolicyForm>({
    name: '',
    description: '',
    kind: 'Policy',
    type: 'labeling',
    priority: 'medium',
    conditions: [],
    advancedMode: false,
    advancedQuery: '',
    actions: [],
    estimatedAffectedAssets: 0,
    estimatedUsersImpacted: 0,
    complianceImpact: '',
    saveAs: 'draft',
    notifyUsers: true,
    scheduleActivation: false,
    // C2b AccessPolicy defaults
    accessTiers: [],
    accessRoles: [],
    accessActions: [],
    accessPurpose: '',
    accessConsent: 'unset',
    accessRegion: '',
    accessEffect: 'allow',
    accessObligations: [],
  });
  const [impactPreview, setImpactPreview] = useState<IImpactPreview | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  const steps: IPolicyStep[] = [
    {
      id: 1,
      name: 'General Info',
      icon: <FeatherFileText />,
      completed: currentStep > 1,
      active: currentStep === 1,
    },
    {
      id: 2,
      name: 'Scope & Conditions',
      icon: <FeatherFilter />,
      completed: currentStep > 2,
      active: currentStep === 2,
    },
    {
      id: 3,
      name: 'Action Configuration',
      icon: <FeatherTag />,
      completed: currentStep > 3,
      active: currentStep === 3,
    },
    {
      id: 4,
      name: 'Review & Impact',
      icon: <FeatherEye />,
      completed: currentStep > 4,
      active: currentStep === 4,
    },
    {
      id: 5,
      name: 'Activation',
      icon: <FeatherPlay />,
      completed: false,
      active: currentStep === 5,
    },
  ];

  // Auto-trigger impact analysis when conditions or actions change
  useEffect(() => {
    if (currentStep === 4 && form.conditions.length > 0) {
      const delayedImpactAnalysis = setTimeout(() => {
        handleImpactAnalysis();
      }, 1000); // Debounce for 1 second
      
      return () => clearTimeout(delayedImpactAnalysis);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the debounce is keyed on the conditions, actions and step; handleImpactAnalysis reads the same form
  }, [form.conditions, form.actions, currentStep]);

  const handleImpactAnalysis = async () => {
    if (form.conditions.length === 0) return;
    
    try {
      setImpactLoading(true);
      const preview = await fetchImpactPreview(form);
      setImpactPreview(preview);
    } catch (error) {
      console.error('Impact analysis failed:', error);
    } finally {
      setImpactLoading(false);
    }
  };

  const updateForm = (updates: Partial<IPolicyForm>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  const addCondition = () => {
    const newCondition: ICondition = {
      id: Date.now().toString(),
      field: '',
      operator: '',
      value: '',
      logicOperator: form.conditions.length > 0 ? 'AND' : undefined,
    };
    updateForm({ conditions: [...form.conditions, newCondition] });
  };

  const updateCondition = (id: string, updates: Partial<ICondition>) => {
    const updatedConditions = form.conditions.map(condition =>
      condition.id === id ? { ...condition, ...updates } : condition
    );
    updateForm({ conditions: updatedConditions });
  };

  const removeCondition = (id: string) => {
    const updatedConditions = form.conditions.filter(condition => condition.id !== id);
    updateForm({ conditions: updatedConditions });
  };

  // Helper functions for managing action configurations
  const updateActionConfig = (actionType: string, configUpdates: IActionConfig) => {
    const updatedActions = form.actions.map(action =>
      action.type === actionType 
        ? { ...action, config: { ...action.config, ...configUpdates } }
        : action
    );
    updateForm({ actions: updatedActions });
  };

  const getActionConfig = (actionType: string): IActionConfig => {
    const action = form.actions.find(a => a.type === actionType);
    return action?.config || {};
  };

  // C2b: toggle a value in one of the AccessPolicy multi-select arrays.
  const toggleAccessValue = (
    key: 'accessTiers' | 'accessRoles' | 'accessActions',
    value: string
  ) => {
    const current = form[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateForm({ [key]: next } as Partial<IPolicyForm>);
  };

  // C2b: obligation row CRUD (Table-row pattern, mirrors the conditions builder).
  const addObligation = () => {
    updateForm({
      accessObligations: [
        ...form.accessObligations,
        { id: Date.now().toString(), type: 'mask', labels: '' },
      ],
    });
  };

  const updateObligation = (id: string, updates: Partial<IAccessObligationRow>) => {
    updateForm({
      accessObligations: form.accessObligations.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    });
  };

  const removeObligation = (id: string) => {
    updateForm({
      accessObligations: form.accessObligations.filter((o) => o.id !== id),
    });
  };

  const isAccessPolicy = form.kind === 'AccessPolicy';

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return form.name.trim() && form.description.trim();
      case 2:
        return form.advancedMode ? form.advancedQuery.trim() : form.conditions.length > 0;
      case 3:
        // C2b: AccessPolicy step 3 collects subjects/actions/effect instead of
        // lifecycle action tiles. Require at least one subject (tier or role),
        // at least one action, and a valid effect — matching the backend's 400s.
        if (isAccessPolicy) {
          const hasSubject = form.accessTiers.length > 0 || form.accessRoles.length > 0;
          const hasAction = form.accessActions.length > 0;
          const hasEffect = form.accessEffect === 'allow' || form.accessEffect === 'deny';
          return hasSubject && hasAction && hasEffect;
        }

        if (form.actions.length === 0) return false;

        // If "Apply Custom Label" is selected, ensure custom label name is provided
        if (form.actions.some(a => a.type === 'apply_custom')) {
          const customLabelConfig = getActionConfig('apply_custom');
          return customLabelConfig.labelName && customLabelConfig.labelName.trim();
        }

        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceedToNext() && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (form.saveAs === 'draft') {
        const result = await savePolicyDraft(form);
        if (result.success && result.draftId) {
          setCurrentDraftId(result.draftId);
          // Persisted — return to the Policy Center where the new draft appears.
          window.navigateToPolicyHub2?.();
        } else {
          // Surface the backend's actionable message when present.
          setSaveError(result.error ?? 'Failed to save policy draft. Please review the details and try again.');
        }
      } else {
        const draftId = currentDraftId || undefined;
        const result = await activatePolicy(form, draftId);
        if (result.success) {
          window.navigateToPolicyHub2?.();
        } else {
          setSaveError(result.error ?? 'Failed to activate policy. Please review the details and try again.');
        }
      }
    } catch (error) {
      console.error('Failed to save policy', error);
      setSaveError('Failed to save policy. Please review the details and try again.');
    } finally {
      setSaving(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'labeling': return <FeatherShield />;
      case 'archival': return <FeatherArchive />;
      case 'deletion': return <FeatherTrash2 />;
      case 'compliance': return <FeatherCheckCircle />;
      default: return <FeatherShield />;
    }
  };

  const getPolicyTypeActions = (type: string) => {
    switch (type) {
      case 'labeling':
        return [
          { id: 'classify_pii', name: 'Classify as PII', description: 'Apply PII classification label' },
          { id: 'classify_financial', name: 'Classify as Financial', description: 'Apply financial data label' },
          { id: 'classify_sensitive', name: 'Classify as Sensitive', description: 'Apply sensitive data label' },
          { id: 'apply_custom', name: 'Apply Custom Label', description: 'Apply custom classification' },
        ];
      case 'archival':
        return [
          { id: 'move_cold_storage', name: 'Move to Cold Storage', description: 'Archive to cold storage tier' },
          { id: 'compress_data', name: 'Compress Data', description: 'Apply compression before archival' },
          { id: 'create_backup', name: 'Create Backup', description: 'Create backup before archival' },
        ];
      case 'deletion':
        return [
          { id: 'soft_delete', name: 'Soft Delete', description: 'Mark for deletion without immediate removal' },
          { id: 'permanent_delete', name: 'Permanent Delete', description: 'Permanently remove data' },
          { id: 'secure_wipe', name: 'Secure Wipe', description: 'Securely overwrite data' },
        ];
      case 'compliance':
        return [
          { id: 'gdpr_check', name: 'GDPR Compliance Check', description: 'Verify GDPR compliance' },
          { id: 'hipaa_check', name: 'HIPAA Compliance Check', description: 'Verify HIPAA compliance' },
          { id: 'retention_check', name: 'Retention Policy Check', description: 'Check data retention compliance' },
        ];
      default:
        return [];
    }
  };

  // C2b-access-PolicyWizardFlow: Step 3 body for AccessPolicy authoring. Reuses
  // Checkbox groups for multi-select (no MultiSelect exists in this codebase),
  // TextField comma-lists for purpose/region, a Select for the tri-state
  // consent, a ToggleGroup for the effect, and a Table-row builder for
  // obligations — matching the existing conditions builder pattern.
  const renderAccessConfigStep = () => (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full items-center justify-between">
        <span className="text-heading-3 font-heading-3 text-default-font">
          Configure Access
        </span>
        <Badge variant="brand">Access Policy</Badge>
      </div>

      {/* Subjects — tiers */}
      <div className="flex w-full flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
        <span className="text-body-bold font-body-bold text-default-font">Subject Tiers</span>
        <span className="text-caption font-caption text-subtext-color">
          Select the organizational tiers this policy applies to. At least one tier or role is required.
        </span>
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
          {ACCESS_TIERS.map((tier) => (
            <div key={tier} className="flex items-center gap-2">
              <Checkbox
                checked={form.accessTiers.includes(tier)}
                onCheckedChange={() => toggleAccessValue('accessTiers', tier)}
              />
              <span className="text-body font-body text-default-font">{tier}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Subjects — roles */}
      <div className="flex w-full flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
        <span className="text-body-bold font-body-bold text-default-font">Subject Roles</span>
        <span className="text-caption font-caption text-subtext-color">
          Select the realm roles this policy applies to. At least one tier or role is required.
        </span>
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3">
          {ACCESS_ROLES.map((role) => (
            <div key={role} className="flex items-center gap-2">
              <Checkbox
                checked={form.accessRoles.includes(role)}
                onCheckedChange={() => toggleAccessValue('accessRoles', role)}
              />
              <span className="text-body font-body text-default-font">{role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex w-full flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
        <span className="text-body-bold font-body-bold text-default-font">Actions</span>
        <span className="text-caption font-caption text-subtext-color">
          Which actions this policy governs. At least one action is required.
        </span>
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-5">
          {ACCESS_ACTIONS.map((action) => (
            <div key={action} className="flex items-center gap-2">
              <Checkbox
                checked={form.accessActions.includes(action)}
                onCheckedChange={() => toggleAccessValue('accessActions', action)}
              />
              <span className="text-body font-body text-default-font">{action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Effect */}
      <div className="flex w-full flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
        <span className="text-body-bold font-body-bold text-default-font">Effect</span>
        <span className="text-caption font-caption text-subtext-color">
          Whether matching subjects are granted or denied the selected actions.
        </span>
        <ToggleGroup
          value={form.accessEffect}
          onValueChange={(value) => {
            // ToggleGroup can emit '' on toggle-off; keep a valid effect.
            if (value === 'allow' || value === 'deny') {
              updateForm({ accessEffect: value });
            }
          }}
        >
          <ToggleGroup.Item value="allow">Allow</ToggleGroup.Item>
          <ToggleGroup.Item value="deny">Deny</ToggleGroup.Item>
        </ToggleGroup>
      </div>

      {/* Condition */}
      <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
        <span className="text-body-bold font-body-bold text-default-font">Condition (optional)</span>
        <TextField
          className="h-auto w-full flex-none"
          label="Purpose"
          helpText="Comma-separated purposes, e.g. analytics, billing"
        >
          <TextField.Input
            placeholder="e.g. analytics, billing"
            value={form.accessPurpose}
            onChange={(e) => updateForm({ accessPurpose: e.target.value })}
          />
        </TextField>
        <TextField
          className="h-auto w-full flex-none"
          label="Region"
          helpText="Comma-separated regions, e.g. EU, US"
        >
          <TextField.Input
            placeholder="e.g. EU, US"
            value={form.accessRegion}
            onChange={(e) => updateForm({ accessRegion: e.target.value })}
          />
        </TextField>
        <Select
          label="Consent required"
          placeholder="Not specified"
          helpText="Leave unset to omit the consent constraint"
          value={form.accessConsent}
          onValueChange={(value) => updateForm({ accessConsent: value as IPolicyForm['accessConsent'] })}
        >
          <Select.Item value="unset">Not specified</Select.Item>
          <Select.Item value="true">Consent required</Select.Item>
          <Select.Item value="false">Consent not required</Select.Item>
        </Select>
      </div>

      {/* Obligations */}
      <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
        <div className="flex w-full items-center justify-between">
          <span className="text-body-bold font-body-bold text-default-font">Obligations (optional)</span>
          <Button variant="neutral-tertiary" icon={<FeatherPlus />} onClick={addObligation}>
            Add Obligation
          </Button>
        </div>
        {form.accessObligations.length > 0 ? (
          <Table
            header={
              <Table.HeaderRow>
                <Table.HeaderCell>Type</Table.HeaderCell>
                <Table.HeaderCell>Labels</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.HeaderRow>
            }
          >
            {form.accessObligations.map((obligation) => (
              <Table.Row key={obligation.id}>
                <Table.Cell>
                  <Select
                    label=""
                    placeholder="Select type"
                    helpText=""
                    value={obligation.type}
                    onValueChange={(value) => updateObligation(obligation.id, { type: value })}
                  >
                    {ACCESS_OBLIGATION_TYPES.map((t) => (
                      <Select.Item key={t} value={t}>{t}</Select.Item>
                    ))}
                  </Select>
                </Table.Cell>
                <Table.Cell>
                  <TextField label="" helpText="">
                    <TextField.Input
                      placeholder="Comma-separated labels, e.g. PII, PHI"
                      value={obligation.labels}
                      onChange={(e) => updateObligation(obligation.id, { labels: e.target.value })}
                    />
                  </TextField>
                </Table.Cell>
                <Table.Cell>
                  <IconButton
                    variant="destructive-tertiary"
                    icon={<FeatherTrash2 />}
                    onClick={() => removeObligation(obligation.id)}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table>
        ) : (
          <span className="text-caption font-caption text-subtext-color">
            No obligations. Add one to mask, redact rows, or log access for labelled data.
          </span>
        )}
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
  return (
          <div className="flex w-full flex-col items-start gap-6">
            <div className="flex w-full flex-col items-start gap-4">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Policy Information
              </span>
            <TextField
              className="h-auto w-full flex-none"
              label="Policy Name"
              helpText="Enter a descriptive name for this policy"
            >
              <TextField.Input
                  placeholder="e.g., PII Data Classification Policy"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
              />
            </TextField>
            <TextArea
              className="h-auto w-full flex-none"
              label="Description"
              helpText="Describe the purpose and scope of this policy"
            >
              <TextArea.Input
                placeholder="Enter policy description..."
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
              />
            </TextArea>
            </div>

            {/* C2b-access-PolicyWizardFlow: policy kind selector. Lifecycle is
                the default; switching to Access Policy re-routes steps 3+ to the
                AuthZEN authoring fields and hides the lifecycle action tiles. */}
            <div className="flex w-full flex-col items-start gap-4">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Policy Kind
              </span>
              <RadioGroup
                label=""
                helpText="Lifecycle policies act on assets; Access policies grant or deny access to subjects."
                horizontal={true}
                value={form.kind}
                onValueChange={(value) => updateForm({ kind: value as 'Policy' | 'AccessPolicy' })}
              >
                <RadioGroup.Option label="Lifecycle Policy" value="Policy" />
                <RadioGroup.Option label="Access Policy" value="AccessPolicy" />
              </RadioGroup>
            </div>

            <div className="flex w-full flex-col items-start gap-4">
              <span className="text-heading-3 font-heading-3 text-default-font">
                {isAccessPolicy ? 'Priority' : 'Policy Type & Priority'}
              </span>
              <div className="flex w-full gap-4">
                {!isAccessPolicy && (
                  <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                    <Select
                      label="Policy Type"
                      placeholder="Select policy type"
                      helpText=""
                      value={form.type}
                      onValueChange={(value) => updateForm({ type: value as IPolicyForm['type'] })}
                    >
                      <Select.Item value="labeling">Data Labeling</Select.Item>
                      <Select.Item value="archival">Data Archival</Select.Item>
                      <Select.Item value="deletion">Data Deletion</Select.Item>
                      <Select.Item value="compliance">Compliance Rules</Select.Item>
                    </Select>
                  </div>
                )}
                <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                  <Select
                    label="Priority Level"
                    placeholder="Select priority"
                    helpText=""
                    value={form.priority}
                    onValueChange={(value) => updateForm({ priority: value as IPolicyForm['priority'] })}
                  >
                    <Select.Item value="high">High Priority</Select.Item>
                    <Select.Item value="medium">Medium Priority</Select.Item>
                    <Select.Item value="low">Low Priority</Select.Item>
                  </Select>
                </div>
              </div>
            </div>

            {isAccessPolicy ? (
              <div className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
                <IconWithBackground variant="brand" icon={<FeatherShield />} />
                <div className="flex flex-col items-start gap-1">
                  <span className="text-body-bold font-body-bold text-default-font">
                    Access Policy
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    Grant or deny subjects (tiers/roles) specific actions on assets matching label conditions.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
                <IconWithBackground variant="brand" icon={getTypeIcon(form.type)} />
                <div className="flex flex-col items-start gap-1">
                  <span className="text-body-bold font-body-bold text-default-font">
                    {form.type.charAt(0).toUpperCase() + form.type.slice(1)} Policy
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    {form.type === 'labeling' && 'Automatically classify and label data based on content and metadata'}
                    {form.type === 'archival' && 'Move older or inactive data to long-term storage tiers'}
                    {form.type === 'deletion' && 'Remove data that meets specific criteria or retention periods'}
                    {form.type === 'compliance' && 'Ensure data handling meets regulatory requirements'}
                  </span>
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="flex w-full flex-col items-start gap-6">
              <div className="flex w-full items-center justify-between">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Define Conditions
              </span>
              <div className="flex items-center gap-2">
                <span className="text-body font-body text-subtext-color">Advanced Mode</span>
                <Switch
                  checked={form.advancedMode}
                  onCheckedChange={(checked) => updateForm({ advancedMode: checked })}
                />
              </div>
            </div>

            {!form.advancedMode ? (
              <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <div className="flex w-full items-center justify-between">
                  <span className="text-body-bold font-body-bold text-default-font">
                    Visual Rule Builder
                </span>
                <Button
                  variant="neutral-tertiary"
                  icon={<FeatherPlus />}
                    onClick={addCondition}
                >
                  Add Condition
                </Button>
              </div>

                {form.conditions.length > 0 ? (
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>Field</Table.HeaderCell>
                    <Table.HeaderCell>Operator</Table.HeaderCell>
                    <Table.HeaderCell>Value</Table.HeaderCell>
                    <Table.HeaderCell>Logic</Table.HeaderCell>
                        <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                    {form.conditions.map((condition, index) => (
                      <Table.Row key={condition.id}>
                  <Table.Cell>
                    <Select
                      label=""
                      placeholder="Select field"
                      helpText=""
                            value={condition.field}
                            onValueChange={(value) =>
                              // Changing the field resets the operator to a
                              // valid default for that field, so field/operator
                              // pairs are always coherent (no match-everything).
                              updateCondition(condition.id, {
                                field: value,
                                operator: defaultOperatorForField(value),
                              })
                            }
                    >
                            <Select.Item value="assetType">Asset Type</Select.Item>
                            <Select.Item value="labels">Label</Select.Item>
                            <Select.Item value="cloudProvider">Cloud Provider</Select.Item>
                            <Select.Item value="region">Region</Select.Item>
                            <Select.Item value="lastAccessedAt">Last Accessed</Select.Item>
                            <Select.Item value="sizeBytes">Size (bytes)</Select.Item>
                            <Select.Item value="nameMatches">Name (regex)</Select.Item>
                    </Select>
                  </Table.Cell>
                  <Table.Cell>
                    <Select
                      label=""
                      placeholder="Select operator"
                      helpText=""
                            value={condition.operator}
                            disabled={!condition.field}
                            onValueChange={(value) => updateCondition(condition.id, { operator: value })}
                    >
                            {/* Only operators valid for the selected field. */}
                            {operatorsForField(condition.field).map((op) => (
                              <Select.Item key={op.value} value={op.value}>
                                {op.label}
                              </Select.Item>
                            ))}
                    </Select>
                  </Table.Cell>
                  <Table.Cell>
                    <TextField
                      label=""
                      helpText={
                        condition.operator === 'olderThan' || condition.operator === 'youngerThan'
                          ? 'ISO-8601 duration, e.g. P90D (90 days)'
                          : ''
                      }
                    >
                      <TextField.Input
                        placeholder={
                          condition.operator === 'olderThan' || condition.operator === 'youngerThan'
                            ? 'e.g. P90D (90 days)'
                            : 'Enter value'
                        }
                              value={condition.value}
                              onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                      />
                    </TextField>
                  </Table.Cell>
                  <Table.Cell>
                          {index < form.conditions.length - 1 && (
                            <ToggleGroup
                              value={condition.logicOperator || 'AND'}
                              onValueChange={(value) => updateCondition(condition.id, { logicOperator: value as 'AND' | 'OR' })}
                            >
                              <ToggleGroup.Item value="AND">AND</ToggleGroup.Item>
                              <ToggleGroup.Item value="OR">OR</ToggleGroup.Item>
                    </ToggleGroup>
                          )}
                  </Table.Cell>
                  <Table.Cell>
                    <IconButton
                      variant="destructive-tertiary"
                      icon={<FeatherTrash2 />}
                            onClick={() => removeCondition(condition.id)}
                    />
                  </Table.Cell>
                </Table.Row>
                    ))}
              </Table>
                ) : (
                  <div className="flex w-full flex-col items-center gap-4 py-8">
                    <IconWithBackground variant="neutral" icon={<FeatherFilter />} />
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-body-bold font-body-bold text-default-font">
                        No conditions defined
                      </span>
                      <span className="text-body font-body text-subtext-color">
                        Add conditions to define when this policy should be applied
                      </span>
                    </div>
              <Button
                      icon={<FeatherPlus />}
                      onClick={addCondition}
              >
                      Add First Condition
              </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <div className="flex w-full items-center gap-2">
                  <IconWithBackground variant="brand" icon={<FeatherCode />} size="small" />
                  <span className="text-body-bold font-body-bold text-default-font">
                    Advanced Query Mode
                  </span>
                </div>
                <TextArea
                  className="h-auto w-full flex-none"
                  label="JSON/YAML Query"
                  helpText="Enter your query in JSON or YAML format"
                >
                  <TextArea.Input
                    placeholder={`{
  "conditions": [
    {
      "field": "labels",
      "operator": "anyOf",
      "value": "PII"
    },
    {
      "operator": "AND"
    },
    {
      "field": "lastAccessedAt",
      "operator": "olderThan",
      "value": "P90D"
    }
  ]
}`}
                    value={form.advancedQuery}
                    onChange={(e) => updateForm({ advancedQuery: e.target.value })}
                    style={{ minHeight: '200px', fontFamily: 'monospace' }}
                  />
                </TextArea>
              </div>
            )}
          </div>
        );

      case 3:
        // C2b: AccessPolicy step 3 replaces the lifecycle action tiles with the
        // AuthZEN authoring fields (subjects, actions, condition, effect,
        // obligations). Lifecycle policies fall through to the tiles unchanged.
        if (isAccessPolicy) {
          return renderAccessConfigStep();
        }
        return (
          <div className="flex w-full flex-col items-start gap-6">
            <div className="flex w-full items-center justify-between">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Configure Actions
              </span>
              <Badge variant="brand">{form.type.charAt(0).toUpperCase() + form.type.slice(1)} Policy</Badge>
            </div>

            <div className="flex w-full flex-col items-start gap-4">
              <span className="text-body-bold font-body-bold text-default-font">
                Available Actions for {form.type.charAt(0).toUpperCase() + form.type.slice(1)} Policies
              </span>
              
              {/* Single-select: the backend takes ONE action per policy, so
                  choosing a tile REPLACES the current selection rather than
                  appending (previously extra selections were silently dropped). */}
              <span className="text-caption font-caption text-subtext-color">
                A policy applies a single action. Selecting an action replaces the previous one.
              </span>
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
                {getPolicyTypeActions(form.type).map((action) => {
                  const isSelected = form.actions.some(a => a.type === action.id);
                  return (
                    <div
                      key={action.id}
                      className={`flex w-full cursor-pointer items-start gap-4 rounded-md border border-solid px-4 py-4 transition-colors ${
                        isSelected
                          ? 'border-brand-border bg-brand-50'
                          : 'border-neutral-border bg-default-background hover:bg-neutral-50'
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          // Deselect → no action chosen.
                          updateForm({ actions: [] });
                        } else {
                          // Replace any prior action; seed a default label
                          // param so labeling actions carry parameters.label
                          // (autolabel drops events with a missing label).
                          const seededLabel = DEFAULT_LABEL_FOR_ACTION[action.id];
                          updateForm({
                            actions: [
                              {
                                type: action.id,
                                config: seededLabel ? { label: seededLabel } : {},
                              },
                            ],
                          });
                        }
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {}}
                      />
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-body-bold font-body-bold text-default-font">
                          {action.name}
                        </span>
                        <span className="text-caption font-caption text-subtext-color">
                          {action.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {form.actions.length === 0 && (
                <div className="flex w-full flex-col items-center gap-4 py-8">
                  <IconWithBackground variant="neutral" icon={<FeatherTag />} />
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-body-bold font-body-bold text-default-font">
                      No action selected
                    </span>
                    <span className="text-body font-body text-subtext-color">
                      Select one action to perform when conditions are met
                    </span>
                  </div>
                </div>
              )}
            </div>

            {form.type === 'labeling' && form.actions.some(a => a.type === 'apply_custom') && (
              <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <span className="text-body-bold font-body-bold text-default-font">
                  Custom Label Configuration
                </span>
                <TextField
                  className="h-auto w-full flex-none"
                  label="Custom Label Name"
                  helpText="Enter the name for your custom label (required)"
                >
                  <TextField.Input
                    placeholder="e.g., Customer Data, Internal Use Only"
                    value={getActionConfig('apply_custom').labelName || ''}
                    onChange={(e) => updateActionConfig('apply_custom', { labelName: e.target.value })}
                  />
                </TextField>
                <TextField
                  className="h-auto w-full flex-none"
                  label="Label Description"
                  helpText="Optional description for the custom label"
                >
                  <TextField.Input
                    placeholder="e.g., Contains customer personal information"
                    value={getActionConfig('apply_custom').labelDescription || ''}
                    onChange={(e) => updateActionConfig('apply_custom', { labelDescription: e.target.value })}
                  />
                </TextField>
                <Select
                  label="Label Color"
                  placeholder="Select label color"
                  helpText="Choose a color for your custom label"
                  value={getActionConfig('apply_custom').labelColor || ''}
                  onValueChange={(value) => updateActionConfig('apply_custom', { labelColor: value })}
                >
                  <Select.Item value="red">Red</Select.Item>
                  <Select.Item value="orange">Orange</Select.Item>
                  <Select.Item value="yellow">Yellow</Select.Item>
                  <Select.Item value="green">Green</Select.Item>
                  <Select.Item value="blue">Blue</Select.Item>
                  <Select.Item value="purple">Purple</Select.Item>
                </Select>
                <div className="flex w-full items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-3">
                  <IconWithBackground variant="brand" icon={<FeatherTag />} size="small" />
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-caption-bold font-caption-bold text-default-font">
                      Label Preview
                    </span>
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex items-center gap-2">
                        {getActionConfig('apply_custom').labelName && (
                          <Badge 
                            variant={getActionConfig('apply_custom').labelColor === 'red' ? 'error' :
                                    getActionConfig('apply_custom').labelColor === 'orange' ? 'warning' :
                                    getActionConfig('apply_custom').labelColor === 'yellow' ? 'warning' :
                                    getActionConfig('apply_custom').labelColor === 'green' ? 'success' :
                                    getActionConfig('apply_custom').labelColor === 'blue' ? 'brand' :
                                    getActionConfig('apply_custom').labelColor === 'purple' ? 'brand' : 'neutral'}
                          >
                            {getActionConfig('apply_custom').labelName}
                          </Badge>
                        )}
                        {!getActionConfig('apply_custom').labelName && (
                          <span className="text-caption font-caption text-subtext-color">
                            Enter a label name to see preview
                          </span>
                        )}
                      </div>
                      {getActionConfig('apply_custom').labelDescription && (
                        <span className="text-caption font-caption text-subtext-color">
                          {getActionConfig('apply_custom').labelDescription}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {form.type === 'archival' && form.actions.length > 0 && (
              <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <span className="text-body-bold font-body-bold text-default-font">
                  Archival Configuration
                </span>
                <div className="flex w-full gap-4">
                  <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                    <Select
                      label="Storage Tier"
                      placeholder="Select storage tier"
                      helpText=""
                      value={getActionConfig(form.actions[0].type).storageTier || ''}
                      onValueChange={(value) => updateActionConfig(form.actions[0].type, { storageTier: value })}
                    >
                      <Select.Item value="cold">Cold Storage</Select.Item>
                      <Select.Item value="archive">Archive Storage</Select.Item>
                      <Select.Item value="deep_archive">Deep Archive</Select.Item>
                    </Select>
                  </div>
                  <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                    <TextField
                      className="h-auto w-full flex-none"
                      label="Retention Period (days)"
                      helpText="How long to keep in archive"
                    >
                      <TextField.Input
                        placeholder="e.g., 2555 (7 years)"
                        value={getActionConfig(form.actions[0].type).retentionDays || ''}
                        onChange={(e) => updateActionConfig(form.actions[0].type, { retentionDays: e.target.value })}
                      />
                    </TextField>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="flex w-full flex-col items-start gap-6">
              <span className="text-heading-3 font-heading-3 text-default-font">
              Review & Impact Preview
            </span>

            {/* Policy Summary */}
            <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <span className="text-body-bold font-body-bold text-default-font">
                Policy Summary
              </span>
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-caption font-caption text-subtext-color">Name</span>
                  <span className="text-body-bold font-body-bold text-default-font">{form.name}</span>
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-caption font-caption text-subtext-color">
                    {isAccessPolicy ? 'Kind' : 'Type'}
                  </span>
                  <Badge variant="brand">
                    {isAccessPolicy ? 'Access Policy' : form.type.charAt(0).toUpperCase() + form.type.slice(1)}
                  </Badge>
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-caption font-caption text-subtext-color">Priority</span>
                  <Badge variant={form.priority === 'high' ? 'error' : form.priority === 'medium' ? 'warning' : 'success'}>
                    {form.priority.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-caption font-caption text-subtext-color">Conditions</span>
                  <span className="text-body font-body text-default-font">
                    {form.advancedMode ? 'Advanced Query' : `${form.conditions.length} conditions`}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className="text-caption font-caption text-subtext-color">Description</span>
                <span className="text-body font-body text-default-font">{form.description}</span>
              </div>
            </div>

            {/* Impact Preview */}
            <div className="flex w-full flex-col items-start gap-4">
              <div className="flex w-full items-center justify-between">
                <span className="text-body-bold font-body-bold text-default-font">
                  Impact Analysis
                </span>
                {impactLoading && (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin text-brand-600">
                      <FeatherZap />
                    </div>
                    <span className="text-caption font-caption text-subtext-color">
                      Analyzing impact...
                    </span>
                  </div>
                )}
              </div>

              {impactPreview ? (
                <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4">
                    <div className="flex items-center gap-2">
                      <IconWithBackground variant="warning" icon={<FeatherDatabase />} size="small" />
                      <span className="text-body-bold font-body-bold text-default-font">
                        Affected Assets
                      </span>
                    </div>
                    <span className="text-heading-2 font-heading-2 text-default-font">
                      {impactPreview.affectedAssets.toLocaleString()}
                    </span>
                  </div>
                  {impactPreview.estimatedCostSavings && (
                    <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4">
                      <div className="flex items-center gap-2">
                        <IconWithBackground variant="success" icon={<FeatherSave />} size="small" />
                        <span className="text-body-bold font-body-bold text-default-font">
                          Est. Savings
                        </span>
                      </div>
                      <span className="text-heading-2 font-heading-2 text-default-font">
                        ${impactPreview.estimatedCostSavings.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4">
                  <div className="flex items-center gap-2">
                    <IconWithBackground
                        variant={impactPreview.complianceRisk === 'high' ? 'error' : impactPreview.complianceRisk === 'medium' ? 'warning' : 'success'} 
                        icon={<FeatherShield />} 
                        size="small" 
                      />
                      <span className="text-body-bold font-body-bold text-default-font">
                        Risk Level
                      </span>
                    </div>
                    <Badge variant={impactPreview.complianceRisk === 'high' ? 'error' : impactPreview.complianceRisk === 'medium' ? 'warning' : 'success'}>
                      {impactPreview.complianceRisk.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ) : impactLoading ? (
                <div className="flex w-full items-center justify-center py-8">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin text-brand-600">
                      <FeatherZap />
                    </div>
                    <span className="text-body font-body text-subtext-color">
                      Loading impact analysis...
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex w-full flex-col items-center gap-4 py-8">
                  <IconWithBackground variant="neutral" icon={<FeatherEye />} />
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Impact analysis unavailable
                    </span>
                    <span className="text-body font-body text-subtext-color">
                      Complete the conditions step to see impact preview
                    </span>
                  </div>
                </div>
              )}

              {impactPreview?.riskReasons && impactPreview.riskReasons.length > 0 && (
                <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-orange-200 bg-orange-50 px-6 py-6">
                  <div className="flex items-center gap-2">
                    <IconWithBackground variant="warning" icon={<FeatherAlertCircle />} size="small" />
                    <span className="text-body-bold font-body-bold text-default-font">
                      Risk Considerations
                    </span>
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {impactPreview.riskReasons.map((reason, index) => (
                      <li key={index} className="text-body font-body text-subtext-color">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="flex w-full flex-col items-start gap-6">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Policy Activation
            </span>

            <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <span className="text-body-bold font-body-bold text-default-font">
                Activation Options
              </span>
              
              <RadioGroup
                label=""
                helpText=""
                horizontal={false}
                value={form.saveAs}
                onValueChange={(value) => updateForm({ saveAs: value as 'draft' | 'active' })}
              >
                <RadioGroup.Option label="Save as Draft" value="draft" />
                <RadioGroup.Option label="Save and Activate Immediately" value="active" />
              </RadioGroup>

              <div className="flex w-full flex-col items-start gap-4 border-t border-solid border-neutral-border pt-4">
                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Notify Affected Users
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Send notifications to users who will be impacted by this policy
                    </span>
                  </div>
                  <Switch
                    checked={form.notifyUsers}
                    onCheckedChange={(checked) => updateForm({ notifyUsers: checked })}
                  />
                </div>

                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Schedule Activation
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Activate this policy at a specific date and time
                  </span>
                  </div>
                  <Switch
                    checked={form.scheduleActivation}
                    onCheckedChange={(checked) => updateForm({ scheduleActivation: checked })}
                  />
                </div>

                {form.scheduleActivation && (
                  <TextField
                    className="h-auto w-full flex-none"
                    label="Activation Date & Time"
                    helpText="When should this policy become active?"
                  >
                    <TextField.Input
                      type="datetime-local"
                      value={form.activationDate || ''}
                      onChange={(e) => updateForm({ activationDate: e.target.value })}
                    />
                  </TextField>
                )}
              </div>
            </div>

            <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-green-200 bg-green-50 px-6 py-6">
              <div className="flex items-center gap-2">
                <IconWithBackground variant="success" icon={<FeatherCheckCircle />} size="small" />
                <span className="text-body-bold font-body-bold text-default-font">
                  Ready for {form.saveAs === 'draft' ? 'Draft Save' : 'Activation'}
                </span>
              </div>
              <span className="text-body font-body text-subtext-color">
                {form.saveAs === 'draft' 
                  ? 'Your policy will be saved as a draft and can be activated later from the Policy Center.'
                  : 'Your policy will be activated immediately and will start processing data according to the defined conditions and actions.'
                }
              </span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background overflow-auto">
        {/* Header */}
        <div className="flex w-full items-center justify-between border-b border-solid border-neutral-border px-6 py-4">
          <div className="flex items-center gap-4">
            <IconButton
              icon={<FeatherX />}
              onClick={() => window.navigateToPolicyHub2?.()}
            />
            <span className="text-heading-2 font-heading-2 text-default-font">
              {isAccessPolicy
                ? 'Create Access Policy'
                : `Create ${form.type.charAt(0).toUpperCase() + form.type.slice(1)} Policy`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-body font-body text-subtext-color">
              Step {currentStep} of {steps.length}
            </span>
            <div className="w-32">
              <Progress 
                value={(currentStep / steps.length) * 100} 
              />
            </div>
          </div>
        </div>

        {/* Step Navigation */}
        <div className="flex w-full items-center gap-1 border-b border-solid border-neutral-border bg-neutral-50 px-6 py-4 overflow-x-auto">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex min-w-0 shrink-0 items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                step.active 
                  ? 'bg-brand-100 text-brand-700' 
                  : step.completed 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-transparent text-subtext-color'
              }`}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                step.completed 
                  ? 'bg-green-600 text-white' 
                  : step.active 
                    ? 'bg-brand-600 text-white' 
                    : 'bg-neutral-200 text-subtext-color'
              }`}>
                {step.completed ? <FeatherCheck /> : step.id}
              </div>
              <span className="text-caption font-caption whitespace-nowrap">
                {step.name}
              </span>
              {index < steps.length - 1 && (
                <FeatherArrowRight className="text-neutral-400" />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex w-full grow flex-col items-start gap-6 px-6 py-6">
          {renderStepContent()}
        </div>

        {saveError && (
          <div className="flex w-full items-center gap-2 border-t border-solid border-error-200 bg-error-50 px-6 py-3">
            <FeatherAlertCircle className="text-error-600" />
            <span className="text-body font-body text-error-700">{saveError}</span>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border bg-neutral-50 px-6 py-4">
          <Button
            variant="neutral-tertiary"
            icon={<FeatherArrowLeft />}
            disabled={currentStep === 1}
            onClick={handlePrevious}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {currentStep === 5 ? (
            <Button
                variant={form.saveAs === 'draft' ? 'neutral-primary' : 'brand-primary'}
                icon={form.saveAs === 'draft' ? <FeatherSave /> : <FeatherPlay />}
                loading={saving}
                onClick={handleSave}
            >
                {form.saveAs === 'draft' ? 'Save as Draft' : 'Activate Policy'}
            </Button>
            ) : (
            <Button
                icon={<FeatherArrowRight />}
                disabled={!canProceedToNext()}
                onClick={handleNext}
            >
                {currentStep === 4 ? 'Review & Activate' : 'Next'}
            </Button>
            )}
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default PolicyWizardFlow; 