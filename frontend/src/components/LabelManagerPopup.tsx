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

import { FeatherPlus, FeatherTag, FeatherX } from "@subframe/core";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconButton } from "../ui/components/IconButton";
import { TextField } from "../ui/components/TextField";
import { catalogApi } from "../utils/api";
import { EmptyState, ErrorState } from "./EmptyState";

/**
 * A label applied to an asset, as returned by da-catalog's
 * GET /api/v1/catalog/assets/{assetId}/labels (LabelOutputDTO). Only the fields
 * this popup renders are modelled; casing matches the backend DTO exactly.
 */
interface IAssetLabel {
  labelId?: string;
  labelName: string;
  labelCategory?: string;
}

interface LabelManagerPopupProps {
  /** Asset UUID whose labels are being managed. */
  assetId: string;
  /** Human-readable asset name for the popup header (optional). */
  assetName?: string;
  /** Controlled open flag. */
  isOpen: boolean;
  /** Close callback (fired on cancel / X / backdrop). */
  onClose: () => void;
  /** Fired after any successful add/remove so the caller can refetch. */
  onSaved?: () => void;
}

/**
 * Controlled popup performing REAL label operations against da-catalog via the
 * shared, JWT-authenticated catalogApi axios instance:
 *   GET    /assets/{id}/labels               -> current labels
 *   POST   /assets/{id}/labels               -> assign a label by name
 *   DELETE /assets/{id}/labels/{labelName}   -> remove a label
 *
 * There is no "list all labels" endpoint in AssetController, so this popup does
 * not fabricate a taxonomy: the user types a label name to assign. Each add /
 * remove is committed immediately to the backend and the current-labels list is
 * refetched from the server (never optimistically invented).
 */
function LabelManagerPopup({
  assetId,
  assetName,
  isOpen,
  onClose,
  onSaved,
}: LabelManagerPopupProps) {
  const [labels, setLabels] = useState<IAssetLabel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState<string>("");
  const [mutating, setMutating] = useState<boolean>(false);

  const fetchLabels = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await catalogApi.get(`/assets/${assetId}/labels`);
      const rows: Array<Partial<IAssetLabel>> = Array.isArray(response.data?.labels)
        ? response.data.labels
        : [];
      setLabels(
        rows.map((r) => ({
          labelId: r.labelId,
          labelName: r.labelName ?? "",
          labelCategory: r.labelCategory,
        }))
      );
    } catch (err) {
      console.error("Error loading asset labels:", err);
      setError("Failed to load labels for this asset.");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    if (isOpen) {
      setNewLabelName("");
      fetchLabels();
    }
  }, [isOpen, fetchLabels]);

  const handleAddLabel = async () => {
    const name = newLabelName.trim();
    if (!name || mutating) return;
    setMutating(true);
    setError(null);
    try {
      await catalogApi.post(`/assets/${assetId}/labels`, {
        labels: [{ labelName: name, source: "USER" }],
      });
      setNewLabelName("");
      await fetchLabels();
      onSaved?.();
    } catch (err) {
      console.error("Error assigning label:", err);
      setError(`Failed to assign label "${name}".`);
    } finally {
      setMutating(false);
    }
  };

  const handleRemoveLabel = async (labelName: string) => {
    if (mutating) return;
    setMutating(true);
    setError(null);
    try {
      await catalogApi.delete(
        `/assets/${assetId}/labels/${encodeURIComponent(labelName)}`
      );
      await fetchLabels();
      onSaved?.();
    } catch (err) {
      console.error("Error removing label:", err);
      setError(`Failed to remove label "${labelName}".`);
    } finally {
      setMutating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-border">
          <div className="flex items-center gap-3">
            <FeatherTag className="w-6 h-6 text-brand-600" />
            <div className="flex flex-col">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Manage Labels
              </span>
              {assetName ? (
                <span className="text-body font-body text-subtext-color">
                  {assetName}
                </span>
              ) : null}
            </div>
          </div>
          <IconButton icon={<FeatherX />} onClick={onClose} disabled={mutating} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-body font-body text-subtext-color">
                Loading labels...
              </span>
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={fetchLabels} />
          ) : (
            <div className="flex flex-col gap-6">
              {/* Current Labels */}
              <div className="flex flex-col gap-3">
                <span className="text-body-bold font-body-bold text-default-font">
                  Current Labels ({labels.length})
                </span>
                {labels.length > 0 ? (
                  <div className="flex flex-wrap gap-2 p-3 border border-neutral-border rounded-lg bg-neutral-50">
                    {labels.map((label) => (
                      <div
                        key={label.labelId ?? label.labelName}
                        className="flex items-center gap-1"
                      >
                        <Badge variant="neutral">{label.labelName}</Badge>
                        <IconButton
                          size="small"
                          icon={<FeatherX />}
                          disabled={mutating}
                          onClick={() => handleRemoveLabel(label.labelName)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No labels applied"
                    message="This asset has no labels yet. Add one below."
                    icon={<FeatherTag className="w-8 h-8 text-subtext-color" />}
                  />
                )}
              </div>

              {/* Add Label */}
              <div className="flex flex-col gap-3 pt-3 border-t border-neutral-border">
                <span className="text-body-bold font-body-bold text-default-font">
                  Add Label
                </span>
                <div className="flex gap-3">
                  <TextField className="flex-1" label="">
                    <TextField.Input
                      placeholder="Enter label name..."
                      value={newLabelName}
                      disabled={mutating}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddLabel();
                      }}
                    />
                  </TextField>
                  <Button
                    icon={<FeatherPlus />}
                    onClick={handleAddLabel}
                    loading={mutating}
                    disabled={mutating || !newLabelName.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-neutral-border">
          <Button variant="neutral-tertiary" onClick={onClose} disabled={mutating}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

export default LabelManagerPopup;
