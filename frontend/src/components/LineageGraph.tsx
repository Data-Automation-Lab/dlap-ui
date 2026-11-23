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

import React, { useMemo, useState } from "react";
import type {
  EnhancedLineageResponse,
  LineageNode,
} from "../utils/apiServices";

/**
 * Renders an asset's data lineage as a layered directed graph (SVG). Nodes are
 * columned by their backend-assigned {@code layer}; edges flow upstream -> the
 * selected asset -> downstream. Each node surfaces the log-harvested owner; a
 * click opens the full harvested context (owner / team / region / provider /
 * uri) — the substrate reconstructed from audit logs.
 */

const NODE_W = 190;
const NODE_H = 72;
const COL_GAP = 90; // horizontal gap between layers
const ROW_GAP = 44; // vertical gap between nodes in a layer
const PAD = 32;

const PROVIDER_COLOR: Record<string, string> = {
  GCP: "#1a73e8",
  AWS: "#ff9900",
  AZURE: "#0078d4",
  OCI: "#c74634",
  UNITY: "#7c3aed",
};

type Positioned = LineageNode & { x: number; y: number };

function meta(node: LineageNode | undefined, ...keys: string[]): string | undefined {
  const m = node?.metadata || {};
  for (const k of keys) {
    const v = m[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return undefined;
}

interface Props {
  data: EnhancedLineageResponse;
  rootAssetId: string;
}

const LineageGraph: React.FC<Props> = ({ data, rootAssetId }) => {
  const rawNodes = data.lineageGraph?.nodes;
  // Memoized on the response's own array: a bare `?? []` is a new array on every render and would
  // rebuild the layout below each time.
  const nodes = useMemo(() => rawNodes ?? [], [rawNodes]);
  const edges = data.lineageGraph?.edges ?? [];
  const [selectedId, setSelectedId] = useState<string>(rootAssetId);

  const { positioned, byId, width, height } = useMemo(() => {
    // Group by layer; stable column ordering by ascending layer value.
    const layers = new Map<number, LineageNode[]>();
    nodes.forEach((n) => {
      const l = typeof n.layer === "number" ? n.layer : 0;
      const column = layers.get(l);
      if (column) column.push(n);
      else layers.set(l, [n]);
    });
    const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);
    const maxRows = Math.max(1, ...Array.from(layers.values()).map((v) => v.length));
    const totalHeight = maxRows * NODE_H + (maxRows - 1) * ROW_GAP + PAD * 2;

    const placed: Positioned[] = [];
    sortedLayers.forEach((layer, colIdx) => {
      const col = layers.get(layer) ?? [];
      const colHeight = col.length * NODE_H + (col.length - 1) * ROW_GAP;
      const y0 = (totalHeight - colHeight) / 2; // vertically center each column
      col.forEach((n, rowIdx) => {
        placed.push({
          ...n,
          x: PAD + colIdx * (NODE_W + COL_GAP),
          y: y0 + rowIdx * (NODE_H + ROW_GAP),
        });
      });
    });

    const idMap = new Map<string, Positioned>();
    placed.forEach((p) => idMap.set(p.nodeId, p));
    const totalWidth =
      PAD * 2 + Math.max(1, sortedLayers.length) * NODE_W + Math.max(0, sortedLayers.length - 1) * COL_GAP;
    return { positioned: placed, byId: idMap, width: totalWidth, height: totalHeight };
  }, [nodes]);

  const selected = byId.get(selectedId) || byId.get(rootAssetId) || positioned[0];

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Graph canvas — scrolls horizontally for wide lineage. */}
      <div className="w-full overflow-x-auto rounded-lg border border-neutral-border bg-neutral-50">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: "100%", display: "block" }}
        >
          <defs>
            <marker
              id="lineage-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Edges first (under nodes). */}
          {edges.map((e, i) => {
            const s = byId.get(e.sourceNodeId);
            const t = byId.get(e.targetNodeId);
            if (!s || !t) return null;
            const x1 = s.x + NODE_W;
            const y1 = s.y + NODE_H / 2;
            const x2 = t.x;
            const y2 = t.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
            return (
              <g key={e.edgeId || i}>
                <path
                  d={path}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  markerEnd="url(#lineage-arrow)"
                />
                {e.relationshipType && (
                  <text
                    x={mx}
                    y={(y1 + y2) / 2 - 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748b"
                  >
                    {e.relationshipType}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes. */}
          {positioned.map((n) => {
            const isRoot = n.nodeId === rootAssetId;
            const isSelected = n.nodeId === selected?.nodeId;
            const provider = meta(n, "cloudProvider", "harvestedProvider") || "";
            const accent = PROVIDER_COLOR[provider.toUpperCase()] || "#64748b";
            const owner = meta(n, "harvestedOwner", "ownerInfo");
            return (
              <g
                key={n.nodeId}
                transform={`translate(${n.x}, ${n.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedId(n.nodeId)}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  fill={isRoot ? "#eff6ff" : "#ffffff"}
                  stroke={isSelected ? accent : "#e2e8f0"}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                {/* Provider accent bar */}
                <rect width={4} height={NODE_H} rx={2} fill={accent} />
                <text x={16} y={24} fontSize="12.5" fontWeight={600} fill="#0f172a">
                  {truncate(n.nodeName, 24)}
                </text>
                <text x={16} y={42} fontSize="10.5" fill="#64748b">
                  {[provider, n.assetType || n.nodeType].filter(Boolean).join(" · ")}
                </text>
                {owner && (
                  <text x={16} y={59} fontSize="10" fill="#475569">
                    {"\u{1F464} "}
                    {truncate(owner, 26)}
                  </text>
                )}
                {isRoot && (
                  <text
                    x={NODE_W - 10}
                    y={16}
                    textAnchor="end"
                    fontSize="9"
                    fontWeight={700}
                    fill={accent}
                  >
                    THIS ASSET
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected-node detail: the harvested context reconstructed from logs. */}
      {selected && (
        <div className="flex w-full flex-col gap-2 rounded-lg border border-neutral-border bg-white p-4">
          <span className="text-body-bold font-body-bold text-default-font">
            {selected.nodeName}
          </span>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
            <Detail label="Type" value={selected.assetType || selected.nodeType} />
            <Detail label="Provider" value={meta(selected, "cloudProvider", "harvestedProvider")} />
            <Detail label="Region" value={meta(selected, "region", "harvestedRegion")} />
            <Detail label="Harvested owner" value={meta(selected, "harvestedOwner")} />
            <Detail label="Team" value={meta(selected, "harvestedTeam")} />
            <Detail label="Owner (recorded)" value={meta(selected, "ownerInfo")} />
            <Detail label="Status" value={selected.status} />
            <Detail label="URI" value={meta(selected, "assetUri")} span />
          </div>
        </div>
      )}
    </div>
  );
};

const Detail: React.FC<{ label: string; value?: string; span?: boolean }> = ({
  label,
  value,
  span,
}) =>
  value ? (
    <div className={`flex flex-col ${span ? "col-span-2 sm:col-span-3" : ""}`}>
      <span className="text-caption font-caption text-subtext-color">{label}</span>
      <span className="text-body font-body text-default-font break-all">{value}</span>
    </div>
  ) : null;

function truncate(s: string, n: number): string {
  return s && s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default LineageGraph;
