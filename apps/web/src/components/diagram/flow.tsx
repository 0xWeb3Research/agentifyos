"use client";

import { memo, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { clsx } from "clsx";

// ── node kinds ──────────────────────────────────────────────────────────────
// v12: NodeProps takes the WHOLE node type, not just the data type.

export type StepNode = Node<
  {
    label: string;
    caption?: string;
    /** small mono tag shown above the label, e.g. "402" or "STEP 3" */
    tag?: string;
    tone?: "default" | "accent" | "success" | "warn" | "chain";
    /** hide the target/source handle when the node starts/ends a chain */
    noIn?: boolean;
    noOut?: boolean;
    /** connect left↔right instead of top↕bottom */
    horizontal?: boolean;
  },
  "step"
>;

export type NoteNode = Node<{ text: string }, "note">;

const TONE: Record<string, string> = {
  default: "border-border bg-surface",
  accent: "border-accent/25 bg-accent-tint",
  success: "border-success/25 bg-success-tint",
  warn: "border-warn/25 bg-warn-tint",
  chain: "border-transparent bg-fg text-surface",
};

const TAG_TONE: Record<string, string> = {
  default: "text-muted",
  accent: "text-accent",
  success: "text-success",
  warn: "text-warn",
  chain: "text-surface/60",
};

function StepNodeImpl({ data }: NodeProps<StepNode>) {
  const tone = data.tone ?? "default";
  const inPos = data.horizontal ? Position.Left : Position.Top;
  const outPos = data.horizontal ? Position.Right : Position.Bottom;
  return (
    <div
      className={clsx(
        "w-[240px] rounded-[var(--radius-md)] border px-3.5 py-3",
        TONE[tone],
      )}
    >
      {!data.noIn && <Handle type="target" position={inPos} />}
      {data.tag && (
        <div className={clsx("label mb-1", TAG_TONE[tone])}>{data.tag}</div>
      )}
      <div className="text-[13px] font-medium leading-snug tracking-[-0.01em] break-words">
        {data.label}
      </div>
      {data.caption && (
        <div
          className={clsx(
            "stat mt-1 whitespace-pre-line break-words leading-snug",
            tone === "chain" ? "text-surface/60" : "text-fg-secondary",
          )}
        >
          {data.caption}
        </div>
      )}
      {!data.noOut && <Handle type="source" position={outPos} />}
    </div>
  );
}

function NoteNodeImpl({ data }: NodeProps<NoteNode>) {
  return (
    <div className="w-[230px] text-[12px] leading-relaxed text-fg-secondary">
      {data.text}
    </div>
  );
}

// Module scope: a fresh object each render would re-register node types.
const nodeTypes: NodeTypes = {
  step: memo(StepNodeImpl),
  note: memo(NoteNodeImpl),
};

// ── the canvas ──────────────────────────────────────────────────────────────
// Fully static: it reads as a diagram, not an editor. Notably
// preventScrolling={false} so the page still scrolls over it, and
// fitView pinned to zoom 1 so typography never rescales.
export function Diagram({
  nodes,
  edges,
  height = 420,
  className,
}: {
  nodes: Node[];
  edges: Edge[];
  height?: number;
  className?: string;
}) {
  // Without intrinsic sizes the first (server) pass measures nodes as zero and
  // fitView frames the wrong box, which clips nodes at the edges.
  const prepared = useMemo(
    () => nodes.map((n) => ({ initialWidth: 240, initialHeight: 104, ...n })),
    [nodes],
  );

  return (
    <div
      className={clsx(
        "overflow-hidden rounded-[var(--radius-card)] border border-border bg-bg",
        className,
      )}
      style={{ height }}
    >
      <ReactFlow
        nodes={prepared}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
        connectOnClick={false}
        preventScrolling={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        disableKeyboardA11y
        fitView
        fitViewOptions={{ padding: 0.16, minZoom: 1, maxZoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
      </ReactFlow>
    </div>
  );
}
