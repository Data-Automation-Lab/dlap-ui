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

import React, { useEffect, useMemo, useState } from "react";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import {
  PolicyRecord,
  createPolicy,
  deletePolicy,
  getPolicy,
  listPolicies,
  updatePolicy,
} from "../utils/apiServices";
import { serverMessage } from '../utils/httpError';
import { confirmAction } from '../utils/confirm';

/**
 * Minimal P0-J Policy DSL editor. List on the left, YAML textarea on
 * the right. Save/Delete buttons CRUD the existing policy endpoints in
 * da-policyengine. Full match-clause builder + action picker land in
 * v0.2.0; v0.1.0 ships the bare editor so adopters can author DSL
 * documents that LifecyclePolicyConsumer (P0-H) executes.
 *
 * <p>The YAML lives in {@code Policy.description} per the temporary
 * storage convention. A dedicated {@code policy_documents} table +
 * schema migration is queued for v0.2.0.
 */
const SAMPLE_YAML = `apiVersion: dlap/v1
kind: Policy
metadata:
  id: archive-stale-pii
  name: "Archive stale PII data"
  description: "GCS buckets tagged PII with no access >90 days."
  owner: "data-governance@example.com"
  enabled: true
spec:
  triggers:
    - type: event
      lifecycle: accessed
    - type: schedule
      cron: "0 0 2 * * ?"
  match:
    cloudProvider: GCP
    assetType:
      anyOf: [GCS_BUCKET, BIGQUERY_TABLE]
    labels:
      anyOf: [PII]
      noneOf: [LEGAL_HOLD]
    lastAccessedAt:
      olderThan: P90D
  action:
    type: archive
    requireApproval: false
    parameters:
      targetStorageClass: ARCHIVE
      auditNote: "Stale PII auto-archive per archive-stale-pii policy"
`;

const PolicyEditor: React.FC = () => {
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  // Backend PolicyStatus is only ENABLED | DISABLED. New policies start
  // DISABLED so they stay inert until explicitly enabled — never 'DRAFT',
  // which the backend enum rejects with an HTTP 500 on bind.
  const [status, setStatus] = useState<PolicyRecord["status"]>("DISABLED");
  const [yaml, setYaml] = useState<string>(SAMPLE_YAML);
  const [isDirty, setDirty] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If the hub routed here to edit a specific policy, honor the id it
    // stashed in sessionStorage, then clear it so a later manual "New"
    // isn't overridden on remount.
    const pending = (() => {
      try { return sessionStorage.getItem('selectedPolicyId'); } catch { return null; }
    })();
    void (async () => {
      await refresh();
      if (pending) {
        try { sessionStorage.removeItem('selectedPolicyId'); } catch { /* no-op */ }
        await onSelect(pending);
      }
    })();
  }, []);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const items = await listPolicies();
      setPolicies(items);
    } catch (e) {
      console.error("Failed to load policies", e);
      setError("Failed to load policies");
    } finally {
      setBusy(false);
    }
  };

  const onSelect = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const p = await getPolicy(id);
      setSelectedId(p.id);
      setName(p.name);
      setStatus(p.status);
      // ADR-0031: the canonical DSL now lives in policyDocument. Fall back to
      // the legacy description field, then to the sample, so older records
      // (authored before the split) still open.
      setYaml(p.policyDocument || p.description || SAMPLE_YAML);
      setDirty(false);
    } catch (e) {
      console.error("Failed to load policy", e);
      setError("Failed to load policy");
    } finally {
      setBusy(false);
    }
  };

  const onNew = () => {
    setSelectedId(null);
    setName("New Policy");
    // DISABLED, not DRAFT — the backend PolicyStatus enum has no DRAFT value.
    setStatus("DISABLED");
    setYaml(SAMPLE_YAML);
    setDirty(true);
  };

  const onSave = async () => {
    setBusy(true);
    setError(null);
    try {
      // ADR-0031: the DSL belongs ONLY in policyDocument. `description` is
      // @Size(max=1000) on the backend, so the full YAML must not be copied
      // there (a real policy exceeds 1000 chars → HTTP 400). Send a short,
      // human description derived from the name instead.
      const shortDescription = `Policy: ${name}`.slice(0, 1000);
      const payload = {
        name,
        status,
        description: shortDescription,
        policyDocument: yaml,
      };
      const saved = selectedId
        ? await updatePolicy(selectedId, payload)
        : await createPolicy(payload);
      await refresh();
      setSelectedId(saved.id);
      setDirty(false);
    } catch (e) {
      console.error("Failed to save policy", e);
      // Surface the backend's helpful validation message (invalid YAML → 400).
      const msg = serverMessage(e) ?? "Failed to save policy";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!selectedId) return;
    if (!confirmAction(`Delete policy "${name}"? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deletePolicy(selectedId);
      setSelectedId(null);
      setName("");
      setStatus("DISABLED");
      setYaml(SAMPLE_YAML);
      setDirty(false);
      await refresh();
    } catch (e) {
      console.error("Failed to delete policy", e);
      setError("Failed to delete policy");
    } finally {
      setBusy(false);
    }
  };

  const validateLocally = (): string | null => {
    if (!name.trim()) return "Name is required";
    if (!yaml.includes("apiVersion: dlap/v1")) return "YAML must declare apiVersion: dlap/v1";
    // C2b-access-PolicyEditor: accept both lifecycle (kind: Policy) and access
    // (kind: AccessPolicy) documents. A kind:AccessPolicy YAML round-trips
    // through this raw editor unchanged (policyDocument is opaque text server
    // side), so the only change needed here was widening this local guard.
    if (!yaml.includes("kind: Policy") && !yaml.includes("kind: AccessPolicy")) {
      return "YAML must declare kind: Policy or kind: AccessPolicy";
    }
    return null;
  };

  const localError = useMemo(validateLocally, [name, yaml]);

  return (
    <DefaultPageLayout>
      <div style={{ display: "flex", height: "100%", padding: 16, gap: 16 }}>
        {/* Policy list */}
        <div style={{ width: 320, borderRight: "1px solid #2a2a2a", paddingRight: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Policies</h3>
            <button onClick={onNew} disabled={busy}>+ New</button>
          </div>
          <button onClick={refresh} disabled={busy} style={{ marginBottom: 8, width: "100%" }}>
            {busy ? "Loading..." : "Refresh"}
          </button>
          <div style={{ overflowY: "auto", height: "calc(100% - 80px)" }}>
            {policies.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelect(p.id)}
                style={{
                  padding: "8px 10px",
                  marginBottom: 4,
                  borderRadius: 4,
                  cursor: "pointer",
                  background: selectedId === p.id ? "#264f78" : "transparent",
                  border: "1px solid #333",
                }}
              >
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>{p.status}</div>
              </div>
            ))}
            {policies.length === 0 && !busy && (
              <div style={{ color: "#888", fontSize: 12 }}>No policies yet. Click "+ New" to create one.</div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setDirty(true); }}
              placeholder="Policy name"
              style={{ flex: 1, padding: "6px 10px" }}
            />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as PolicyRecord["status"]); setDirty(true); }}
            >
              {/* Only ENABLED/DISABLED — the backend PolicyStatus enum has no DRAFT. */}
              <option value="ENABLED">ENABLED</option>
              <option value="DISABLED">DISABLED</option>
            </select>
            <button onClick={onSave} disabled={busy || !!localError}>
              {selectedId ? "Save" : "Create"}
            </button>
            <button onClick={onDelete} disabled={busy || !selectedId}>
              Delete
            </button>
          </div>
          {(localError || error) && (
            <div style={{ color: "#e08a8a", marginBottom: 6, fontSize: 12 }}>{localError || error}</div>
          )}
          <textarea
            value={yaml}
            onChange={(e) => { setYaml(e.target.value); setDirty(true); }}
            spellCheck={false}
            style={{
              flex: 1,
              fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
              fontSize: 13,
              padding: 12,
              background: "#0d1117",
              color: "#c9d1d9",
              border: "1px solid #30363d",
              borderRadius: 6,
              resize: "none",
            }}
          />
          <div style={{ marginTop: 6, fontSize: 11, color: "#888" }}>
            DSL reference:{" "}
            <a
              href="https://github.com/Data-Automation-Lab/dlap/blob/main/docs/specs/policy-dsl.md"
              target="_blank"
              rel="noreferrer"
            >
              docs/specs/policy-dsl.md (v1.1)
            </a>
            {isDirty && <span style={{ marginLeft: 12, color: "#e0c878" }}>unsaved changes</span>}
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
};

export default PolicyEditor;
