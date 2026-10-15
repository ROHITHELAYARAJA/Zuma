"use client";

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Workspace } from "../shared/types";

type Graph = Workspace["graph"];
type Palette = { background: string; patient: string; hospital: string; record: string; edge: string; text: string };
type Point = [number, number, number];
interface Props { graph: Graph; onSelect?: (id: string) => void; reducedMotion?: boolean; colors?: Partial<Palette>; }
const DEFAULTS: Palette = { background: "#111610", patient: "#c8eb83", hospital: "#f1ecdc", record: "#8eaa81", edge: "#526447", text: "#f1ecdc" };

// Layout follows source relationships: the patient is central, hospitals flank it,
// and each record sits on the side of its actual originating hospital.
function positionNodes(graph: Graph): Map<string, Point> {
  const result = new Map<string, Point>();
  const hospitals = graph.nodes.filter((node) => node.type === "hospital").sort((a, b) => a.id.localeCompare(b.id));
  const records = graph.nodes.filter((node) => !["patient", "hospital"].includes(node.type));
  graph.nodes.filter((node) => node.type === "patient").forEach((node, index) => result.set(node.id, [0, index * 0.7, 0.4]));
  hospitals.forEach((hospital, index) => {
    const direction = index % 2 === 0 ? -1 : 1;
    result.set(hospital.id, [direction * 3.05, 0.25, -0.15]);
    const linked = records.filter((record) => graph.edges.some((edge) => edge.source === record.id && edge.target === hospital.id));
    linked.forEach((record, recordIndex) => result.set(record.id, [direction * (1.35 + (recordIndex % 2) * 0.45), (recordIndex - (linked.length - 1) / 2) * 0.75, recordIndex % 2 ? 0.45 : -0.35]));
  });
  records.filter((node) => !result.has(node.id)).forEach((node, index) => result.set(node.id, [Math.cos(index * 2.1) * 1.8, Math.sin(index * 2.1) * 1.5, 0]));
  return result;
}

class GraphBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Scene({ graph, points, selected, select, palette, animate }: { graph: Graph; points: Map<string, Point>; selected: string; select: (id: string) => void; palette: Palette; animate: boolean }) {
  const group = useRef<Group>(null);
  const phase = useRef(0);
  const lines = useMemo(() => {
    const normal: number[] = [], active: number[] = [];
    for (const edge of graph.edges) {
      const a = points.get(edge.source), b = points.get(edge.target);
      if (a && b) (edge.source === selected || edge.target === selected ? active : normal).push(...a, ...b);
    }
    return { normal: new Float32Array(normal), active: new Float32Array(active) };
  }, [graph.edges, points, selected]);
  useFrame((_, delta) => {
    if (!group.current) return;
    if (animate) { phase.current += Math.min(delta, 0.05); group.current.rotation.y = Math.sin(phase.current * 0.16) * 0.12; }
    else group.current.rotation.y = 0;
  });
  return <>
    <ambientLight intensity={1.7} />
    <directionalLight position={[2, 5, 5]} intensity={2.4} />
    <group ref={group} rotation={[-0.08, 0, 0]}>
      {(["normal", "active"] as const).map((key) => <lineSegments key={key}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[lines[key], 3]} /></bufferGeometry>
        <lineBasicMaterial color={key === "active" ? palette.patient : palette.edge} transparent opacity={key === "active" ? 0.95 : 0.5} />
      </lineSegments>)}
      {graph.nodes.map((node) => {
        const active = selected === node.id;
        const radius = node.type === "patient" ? 0.36 : node.type === "hospital" ? 0.26 : 0.12;
        const color = active || node.type === "patient" ? palette.patient : node.type === "hospital" ? palette.hospital : palette.record;
        return <group key={node.id} position={points.get(node.id)}>
          <mesh scale={active ? 1.16 : 1} onClick={(event) => { event.stopPropagation(); select(node.id); }}>
            <sphereGeometry args={[radius, 20, 16]} />
            <meshStandardMaterial color={color} roughness={0.35} metalness={0.12} emissive={color} emissiveIntensity={active ? 0.24 : 0.04} />
          </mesh>
          {(active || node.type === "patient") && <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius + 0.14, 0.012, 6, 40]} />
            <meshBasicMaterial color={palette.patient} transparent opacity={0.7} />
          </mesh>}
        </group>;
      })}
    </group>
  </>;
}

function StaticGraph({ graph, points, selected, select, palette }: { graph: Graph; points: Map<string, Point>; selected: string; select: (id: string) => void; palette: Palette }) {
  const project = (id: string) => { const p = points.get(id) ?? [0, 0, 0]; return [400 + p[0] * 95, 190 - p[1] * 80]; };
  return <svg viewBox="0 0 800 380" width="100%" height="100%" role="img" aria-label="Patient records connected to their source hospitals. Use the evidence list below to select a node.">
    {graph.edges.map((edge, index) => { const a = project(edge.source), b = project(edge.target); return <line key={`${edge.source}-${edge.target}-${index}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={edge.source === selected || edge.target === selected ? palette.patient : palette.edge} strokeWidth={edge.source === selected || edge.target === selected ? 2 : 1} />; })}
    {graph.nodes.map((node) => { const [x, y] = project(node.id); return <g key={node.id} onClick={() => select(node.id)} style={{ cursor: "pointer" }}>
      <title>{node.label} · {node.type}</title>
      <circle cx={x} cy={y} r={node.type === "patient" ? 22 : node.type === "hospital" ? 17 : 9} fill={selected === node.id || node.type === "patient" ? palette.patient : node.type === "hospital" ? palette.hospital : palette.record} />
      {(["patient", "hospital"].includes(node.type) || selected === node.id) && <text x={x} y={y + 39} textAnchor="middle" fill={palette.text} fontSize="12" fontFamily="inherit">{node.label}</text>}
    </g>; })}
  </svg>;
}

export default function EvidenceGraph({ graph, onSelect, reducedMotion, colors }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() => graph.nodes.find((node) => node.type === "patient")?.id ?? "");
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [systemReduced, setSystemReduced] = useState(true);
  const [failed, setFailed] = useState(false);
  const palette = { ...DEFAULTS, ...colors };
  const points = useMemo(() => positionNodes(graph), [graph]);
  const selectedNode = graph.nodes.find((node) => node.id === selected);
  const relations = graph.edges.filter((edge) => edge.source === selected || edge.target === selected);
  const select = (id: string) => { setSelected(id); onSelect?.(id); };
  const motion = systemReduced || reducedMotion === true;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== "hidden");
    update(); document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!container.current) return;
    const element = container.current;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!graph.nodes.some((node) => node.id === selected)) setSelected(graph.nodes.find((node) => node.type === "patient")?.id ?? "");
  }, [graph.nodes, selected]);

  const fallback = <StaticGraph graph={graph} points={points} selected={selected} select={select} palette={palette} />;
  return <div ref={container} style={{ borderRadius: 20, overflow: "hidden", background: palette.background, color: palette.text, border: `1px solid ${palette.edge}55` }}>
    <div style={{ padding: "22px 24px 0", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
      <span style={{ fontSize: 10, fontWeight: 650, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.65 }}>Source provenance</span>
      <span style={{ color: palette.patient, fontSize: 11 }}>{graph.nodes.length} linked evidence nodes</span>
    </div>
    <div style={{ height: 310, minHeight: 220, position: "relative" }}>
      <GraphBoundary fallback={fallback}>
        {failed ? fallback : <Canvas aria-label="Interactive evidence graph" dpr={[1, 1.5]} frameloop={visible && pageVisible && !motion ? "always" : "demand"} camera={{ position: [0, 0.15, 8.8], fov: 42 }} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }} fallback={fallback} onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener("webglcontextlost", (event) => { event.preventDefault(); setFailed(true); }, { once: true });
        }}>
          <Scene graph={graph} points={points} selected={selected} select={select} palette={palette} animate={visible && pageVisible && !motion} />
        </Canvas>}
      </GraphBoundary>
    </div>
    <div aria-live="polite" style={{ padding: "0 24px 20px", minHeight: 60 }}>
      <div style={{ fontSize: 17, fontWeight: 550 }}>{selectedNode?.label ?? "Select an evidence node"}</div>
      <div style={{ fontSize: 11, marginTop: 6, opacity: 0.65 }}>{selectedNode ? `${selectedNode.type} · ${relations.length} provenance ${relations.length === 1 ? "connection" : "connections"}` : "Only currently permitted records appear in this graph."}</div>
    </div>
    <details style={{ borderTop: `1px solid ${palette.edge}66`, padding: "14px 24px 18px" }}>
      <summary style={{ fontSize: 11, cursor: "pointer", opacity: 0.8 }}>Explore the evidence · keyboard accessible</summary>
      <div role="group" aria-label="Select an evidence node" style={{ display: "flex", flexWrap: "wrap", gap: 7, paddingTop: 14 }}>
        {graph.nodes.map((node) => <button key={node.id} type="button" aria-pressed={node.id === selected} onClick={() => select(node.id)} style={{ cursor: "pointer", borderRadius: 30, padding: "8px 12px", font: "inherit", fontSize: 11, border: `1px solid ${palette.edge}`, background: node.id === selected ? palette.patient : "transparent", color: node.id === selected ? palette.background : palette.text }}>{node.label}</button>)}
      </div>
      {relations.length > 0 && <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 11, lineHeight: 1.8, opacity: 0.7 }}>{relations.map((edge, index) => <li key={`${edge.source}-${edge.target}-${index}`}>{graph.nodes.find((node) => node.id === edge.source)?.label} → {edge.label} → {graph.nodes.find((node) => node.id === edge.target)?.label}</li>)}</ul>}
    </details>
  </div>;
}
