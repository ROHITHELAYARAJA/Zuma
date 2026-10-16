(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/web/EvidenceGraph.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>EvidenceGraph
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$three$2f$fiber$2f$dist$2f$react$2d$three$2d$fiber$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@react-three/fiber/dist/react-three-fiber.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$three$2f$fiber$2f$dist$2f$events$2d$e51d7528$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__F__as__useFrame$3e$__ = __turbopack_context__.i("[project]/node_modules/@react-three/fiber/dist/events-e51d7528.esm.js [app-client] (ecmascript) <export F as useFrame>");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
const DEFAULTS = {
    background: "#111610",
    patient: "#c8eb83",
    hospital: "#f1ecdc",
    record: "#8eaa81",
    edge: "#526447",
    text: "#f1ecdc"
};
// Layout follows source relationships: the patient is central, hospitals flank it,
// and each record sits on the side of its actual originating hospital.
function positionNodes(graph) {
    const result = new Map();
    const hospitals = graph.nodes.filter((node)=>node.type === "hospital").sort((a, b)=>a.id.localeCompare(b.id));
    const records = graph.nodes.filter((node)=>![
            "patient",
            "hospital"
        ].includes(node.type));
    graph.nodes.filter((node)=>node.type === "patient").forEach((node, index)=>result.set(node.id, [
            0,
            index * 0.7,
            0.4
        ]));
    hospitals.forEach((hospital, index)=>{
        const direction = index % 2 === 0 ? -1 : 1;
        result.set(hospital.id, [
            direction * 3.05,
            0.25,
            -0.15
        ]);
        const linked = records.filter((record)=>graph.edges.some((edge)=>edge.source === record.id && edge.target === hospital.id));
        linked.forEach((record, recordIndex)=>result.set(record.id, [
                direction * (1.35 + recordIndex % 2 * 0.45),
                (recordIndex - (linked.length - 1) / 2) * 0.75,
                recordIndex % 2 ? 0.45 : -0.35
            ]));
    });
    records.filter((node)=>!result.has(node.id)).forEach((node, index)=>result.set(node.id, [
            Math.cos(index * 2.1) * 1.8,
            Math.sin(index * 2.1) * 1.5,
            0
        ]));
    return result;
}
class GraphBoundary extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Component"] {
    state = {
        failed: false
    };
    static getDerivedStateFromError() {
        return {
            failed: true
        };
    }
    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}
function Scene({ graph, points, selected, select, palette, animate }) {
    _s();
    const group = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const phase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    const lines = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Scene.useMemo[lines]": ()=>{
            const normal = [], active = [];
            for (const edge of graph.edges){
                const a = points.get(edge.source), b = points.get(edge.target);
                if (a && b) (edge.source === selected || edge.target === selected ? active : normal).push(...a, ...b);
            }
            return {
                normal: new Float32Array(normal),
                active: new Float32Array(active)
            };
        }
    }["Scene.useMemo[lines]"], [
        graph.edges,
        points,
        selected
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$three$2f$fiber$2f$dist$2f$events$2d$e51d7528$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__F__as__useFrame$3e$__["useFrame"])({
        "Scene.useFrame": (_, delta)=>{
            if (!group.current) return;
            if (animate) {
                phase.current += Math.min(delta, 0.05);
                group.current.rotation.y = Math.sin(phase.current * 0.16) * 0.12;
            } else group.current.rotation.y = 0;
        }
    }["Scene.useFrame"]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ambientLight", {
                intensity: 1.7
            }, void 0, false, {
                fileName: "[project]/web/EvidenceGraph.tsx",
                lineNumber: 54,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("directionalLight", {
                position: [
                    2,
                    5,
                    5
                ],
                intensity: 2.4
            }, void 0, false, {
                fileName: "[project]/web/EvidenceGraph.tsx",
                lineNumber: 55,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("group", {
                ref: group,
                rotation: [
                    -0.08,
                    0,
                    0
                ],
                children: [
                    [
                        "normal",
                        "active"
                    ].map((key)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("lineSegments", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("bufferGeometry", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("bufferAttribute", {
                                        attach: "attributes-position",
                                        args: [
                                            lines[key],
                                            3
                                        ]
                                    }, void 0, false, {
                                        fileName: "[project]/web/EvidenceGraph.tsx",
                                        lineNumber: 58,
                                        columnNumber: 25
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/web/EvidenceGraph.tsx",
                                    lineNumber: 58,
                                    columnNumber: 9
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("lineBasicMaterial", {
                                    color: key === "active" ? palette.patient : palette.edge,
                                    transparent: true,
                                    opacity: key === "active" ? 0.95 : 0.5
                                }, void 0, false, {
                                    fileName: "[project]/web/EvidenceGraph.tsx",
                                    lineNumber: 59,
                                    columnNumber: 9
                                }, this)
                            ]
                        }, key, true, {
                            fileName: "[project]/web/EvidenceGraph.tsx",
                            lineNumber: 57,
                            columnNumber: 53
                        }, this)),
                    graph.nodes.map((node)=>{
                        const active = selected === node.id;
                        const radius = node.type === "patient" ? 0.36 : node.type === "hospital" ? 0.26 : 0.12;
                        const color = active || node.type === "patient" ? palette.patient : node.type === "hospital" ? palette.hospital : palette.record;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("group", {
                            position: points.get(node.id),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("mesh", {
                                    scale: active ? 1.16 : 1,
                                    onClick: (event)=>{
                                        event.stopPropagation();
                                        select(node.id);
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("sphereGeometry", {
                                            args: [
                                                radius,
                                                20,
                                                16
                                            ]
                                        }, void 0, false, {
                                            fileName: "[project]/web/EvidenceGraph.tsx",
                                            lineNumber: 67,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meshStandardMaterial", {
                                            color: color,
                                            roughness: 0.35,
                                            metalness: 0.12,
                                            emissive: color,
                                            emissiveIntensity: active ? 0.24 : 0.04
                                        }, void 0, false, {
                                            fileName: "[project]/web/EvidenceGraph.tsx",
                                            lineNumber: 68,
                                            columnNumber: 13
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/EvidenceGraph.tsx",
                                    lineNumber: 66,
                                    columnNumber: 11
                                }, this),
                                (active || node.type === "patient") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("mesh", {
                                    rotation: [
                                        Math.PI / 2,
                                        0,
                                        0
                                    ],
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("torusGeometry", {
                                            args: [
                                                radius + 0.14,
                                                0.012,
                                                6,
                                                40
                                            ]
                                        }, void 0, false, {
                                            fileName: "[project]/web/EvidenceGraph.tsx",
                                            lineNumber: 71,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meshBasicMaterial", {
                                            color: palette.patient,
                                            transparent: true,
                                            opacity: 0.7
                                        }, void 0, false, {
                                            fileName: "[project]/web/EvidenceGraph.tsx",
                                            lineNumber: 72,
                                            columnNumber: 13
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/EvidenceGraph.tsx",
                                    lineNumber: 70,
                                    columnNumber: 51
                                }, this)
                            ]
                        }, node.id, true, {
                            fileName: "[project]/web/EvidenceGraph.tsx",
                            lineNumber: 65,
                            columnNumber: 16
                        }, this);
                    })
                ]
            }, void 0, true, {
                fileName: "[project]/web/EvidenceGraph.tsx",
                lineNumber: 56,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/web/EvidenceGraph.tsx",
        lineNumber: 53,
        columnNumber: 10
    }, this);
}
_s(Scene, "HuovbAtURSELY8zRrcxj9WDtJ80=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$three$2f$fiber$2f$dist$2f$events$2d$e51d7528$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__F__as__useFrame$3e$__["useFrame"]
    ];
});
_c = Scene;
function StaticGraph({ graph, points, selected, select, palette }) {
    const project = (id)=>{
        const p = points.get(id) ?? [
            0,
            0,
            0
        ];
        return [
            400 + p[0] * 95,
            190 - p[1] * 80
        ];
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        viewBox: "0 0 800 380",
        width: "100%",
        height: "100%",
        role: "img",
        "aria-label": "Patient records connected to their source hospitals. Use the evidence list below to select a node.",
        children: [
            graph.edges.map((edge, index)=>{
                const a = project(edge.source), b = project(edge.target);
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                    x1: a[0],
                    y1: a[1],
                    x2: b[0],
                    y2: b[1],
                    stroke: edge.source === selected || edge.target === selected ? palette.patient : palette.edge,
                    strokeWidth: edge.source === selected || edge.target === selected ? 2 : 1
                }, `${edge.source}-${edge.target}-${index}`, false, {
                    fileName: "[project]/web/EvidenceGraph.tsx",
                    lineNumber: 83,
                    columnNumber: 106
                }, this);
            }),
            graph.nodes.map((node)=>{
                const [x, y] = project(node.id);
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                    onClick: ()=>select(node.id),
                    style: {
                        cursor: "pointer"
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                            children: [
                                node.label,
                                " · ",
                                node.type
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/EvidenceGraph.tsx",
                            lineNumber: 85,
                            columnNumber: 7
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                            cx: x,
                            cy: y,
                            r: node.type === "patient" ? 22 : node.type === "hospital" ? 17 : 9,
                            fill: selected === node.id || node.type === "patient" ? palette.patient : node.type === "hospital" ? palette.hospital : palette.record
                        }, void 0, false, {
                            fileName: "[project]/web/EvidenceGraph.tsx",
                            lineNumber: 86,
                            columnNumber: 7
                        }, this),
                        ([
                            "patient",
                            "hospital"
                        ].includes(node.type) || selected === node.id) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                            x: x,
                            y: y + 39,
                            textAnchor: "middle",
                            fill: palette.text,
                            fontSize: "12",
                            fontFamily: "inherit",
                            children: node.label
                        }, void 0, false, {
                            fileName: "[project]/web/EvidenceGraph.tsx",
                            lineNumber: 87,
                            columnNumber: 81
                        }, this)
                    ]
                }, node.id, true, {
                    fileName: "[project]/web/EvidenceGraph.tsx",
                    lineNumber: 84,
                    columnNumber: 74
                }, this);
            })
        ]
    }, void 0, true, {
        fileName: "[project]/web/EvidenceGraph.tsx",
        lineNumber: 82,
        columnNumber: 10
    }, this);
}
_c1 = StaticGraph;
function EvidenceGraph({ graph, onSelect, reducedMotion, colors }) {
    _s1();
    const container = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [selected, setSelected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "EvidenceGraph.useState": ()=>graph.nodes.find({
                "EvidenceGraph.useState": (node)=>node.type === "patient"
            }["EvidenceGraph.useState"])?.id ?? ""
    }["EvidenceGraph.useState"]);
    const [visible, setVisible] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [pageVisible, setPageVisible] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [systemReduced, setSystemReduced] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [failed, setFailed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const palette = {
        ...DEFAULTS,
        ...colors
    };
    const points = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "EvidenceGraph.useMemo[points]": ()=>positionNodes(graph)
    }["EvidenceGraph.useMemo[points]"], [
        graph
    ]);
    const selectedNode = graph.nodes.find((node)=>node.id === selected);
    const relations = graph.edges.filter((edge)=>edge.source === selected || edge.target === selected);
    const select = (id)=>{
        setSelected(id);
        onSelect?.(id);
    };
    const motion = systemReduced || reducedMotion === true;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EvidenceGraph.useEffect": ()=>{
            const query = window.matchMedia("(prefers-reduced-motion: reduce)");
            const update = {
                "EvidenceGraph.useEffect.update": ()=>setSystemReduced(query.matches)
            }["EvidenceGraph.useEffect.update"];
            update();
            query.addEventListener("change", update);
            return ({
                "EvidenceGraph.useEffect": ()=>query.removeEventListener("change", update)
            })["EvidenceGraph.useEffect"];
        }
    }["EvidenceGraph.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EvidenceGraph.useEffect": ()=>{
            const update = {
                "EvidenceGraph.useEffect.update": ()=>setPageVisible(document.visibilityState !== "hidden")
            }["EvidenceGraph.useEffect.update"];
            update();
            document.addEventListener("visibilitychange", update);
            return ({
                "EvidenceGraph.useEffect": ()=>document.removeEventListener("visibilitychange", update)
            })["EvidenceGraph.useEffect"];
        }
    }["EvidenceGraph.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EvidenceGraph.useEffect": ()=>{
            if (!container.current) return;
            const element = container.current;
            if (!("IntersectionObserver" in window)) {
                setVisible(true);
                return;
            }
            const observer = new IntersectionObserver({
                "EvidenceGraph.useEffect": ([entry])=>setVisible(entry.isIntersecting)
            }["EvidenceGraph.useEffect"], {
                threshold: 0.05
            });
            observer.observe(element);
            return ({
                "EvidenceGraph.useEffect": ()=>observer.disconnect()
            })["EvidenceGraph.useEffect"];
        }
    }["EvidenceGraph.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EvidenceGraph.useEffect": ()=>{
            if (!graph.nodes.some({
                "EvidenceGraph.useEffect": (node)=>node.id === selected
            }["EvidenceGraph.useEffect"])) setSelected(graph.nodes.find({
                "EvidenceGraph.useEffect": (node)=>node.type === "patient"
            }["EvidenceGraph.useEffect"])?.id ?? "");
        }
    }["EvidenceGraph.useEffect"], [
        graph.nodes,
        selected
    ]);
    const fallback = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StaticGraph, {
        graph: graph,
        points: points,
        selected: selected,
        select: select,
        palette: palette
    }, void 0, false, {
        fileName: "[project]/web/EvidenceGraph.tsx",
        lineNumber: 129,
        columnNumber: 20
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: container,
        style: {
            borderRadius: 20,
            overflow: "hidden",
            background: palette.background,
            color: palette.text,
            border: `1px solid ${palette.edge}55`
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    padding: "22px 24px 0",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    alignItems: "center"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        style: {
                            fontSize: 10,
                            fontWeight: 650,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            opacity: 0.65
                        },
                        children: "Source provenance"
                    }, void 0, false, {
                        fileName: "[project]/web/EvidenceGraph.tsx",
                        lineNumber: 132,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        style: {
                            color: palette.patient,
                            fontSize: 11
                        },
                        children: [
                            graph.nodes.length,
                            " linked evidence nodes"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/EvidenceGraph.tsx",
                        lineNumber: 133,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/web/EvidenceGraph.tsx",
                lineNumber: 131,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    height: 310,
                    minHeight: 220,
                    position: "relative"
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(GraphBoundary, {
                    fallback: fallback,
                    children: failed ? fallback : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$three$2f$fiber$2f$dist$2f$react$2d$three$2d$fiber$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Canvas"], {
                        "aria-label": "Interactive evidence graph",
                        dpr: [
                            1,
                            1.5
                        ],
                        frameloop: visible && pageVisible && !motion ? "always" : "demand",
                        camera: {
                            position: [
                                0,
                                0.15,
                                8.8
                            ],
                            fov: 42
                        },
                        gl: {
                            alpha: true,
                            antialias: true,
                            powerPreference: "low-power"
                        },
                        fallback: fallback,
                        onCreated: ({ gl })=>{
                            gl.setClearColor(0x000000, 0);
                            gl.domElement.addEventListener("webglcontextlost", (event)=>{
                                event.preventDefault();
                                setFailed(true);
                            }, {
                                once: true
                            });
                        },
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Scene, {
                            graph: graph,
                            points: points,
                            selected: selected,
                            select: select,
                            palette: palette,
                            animate: visible && pageVisible && !motion
                        }, void 0, false, {
                            fileName: "[project]/web/EvidenceGraph.tsx",
                            lineNumber: 141,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/web/EvidenceGraph.tsx",
                        lineNumber: 137,
                        columnNumber: 30
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/web/EvidenceGraph.tsx",
                    lineNumber: 136,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/web/EvidenceGraph.tsx",
                lineNumber: 135,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "aria-live": "polite",
                style: {
                    padding: "0 24px 20px",
                    minHeight: 60
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            fontSize: 17,
                            fontWeight: 550
                        },
                        children: selectedNode?.label ?? "Select an evidence node"
                    }, void 0, false, {
                        fileName: "[project]/web/EvidenceGraph.tsx",
                        lineNumber: 146,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            fontSize: 11,
                            marginTop: 6,
                            opacity: 0.65
                        },
                        children: selectedNode ? `${selectedNode.type} · ${relations.length} provenance ${relations.length === 1 ? "connection" : "connections"}` : "Only currently permitted records appear in this graph."
                    }, void 0, false, {
                        fileName: "[project]/web/EvidenceGraph.tsx",
                        lineNumber: 147,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/web/EvidenceGraph.tsx",
                lineNumber: 145,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                style: {
                    borderTop: `1px solid ${palette.edge}66`,
                    padding: "14px 24px 18px"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                        style: {
                            fontSize: 11,
                            cursor: "pointer",
                            opacity: 0.8
                        },
                        children: "Explore the evidence · keyboard accessible"
                    }, void 0, false, {
                        fileName: "[project]/web/EvidenceGraph.tsx",
                        lineNumber: 150,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        role: "group",
                        "aria-label": "Select an evidence node",
                        style: {
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 7,
                            paddingTop: 14
                        },
                        children: graph.nodes.map((node)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                "aria-pressed": node.id === selected,
                                onClick: ()=>select(node.id),
                                style: {
                                    cursor: "pointer",
                                    borderRadius: 30,
                                    padding: "8px 12px",
                                    font: "inherit",
                                    fontSize: 11,
                                    border: `1px solid ${palette.edge}`,
                                    background: node.id === selected ? palette.patient : "transparent",
                                    color: node.id === selected ? palette.background : palette.text
                                },
                                children: node.label
                            }, node.id, false, {
                                fileName: "[project]/web/EvidenceGraph.tsx",
                                lineNumber: 152,
                                columnNumber: 36
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/web/EvidenceGraph.tsx",
                        lineNumber: 151,
                        columnNumber: 7
                    }, this),
                    relations.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        style: {
                            margin: "12px 0 0",
                            paddingLeft: 18,
                            fontSize: 11,
                            lineHeight: 1.8,
                            opacity: 0.7
                        },
                        children: relations.map((edge, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: [
                                    graph.nodes.find((node)=>node.id === edge.source)?.label,
                                    " → ",
                                    edge.label,
                                    " → ",
                                    graph.nodes.find((node)=>node.id === edge.target)?.label
                                ]
                            }, `${edge.source}-${edge.target}-${index}`, true, {
                                fileName: "[project]/web/EvidenceGraph.tsx",
                                lineNumber: 154,
                                columnNumber: 161
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/web/EvidenceGraph.tsx",
                        lineNumber: 154,
                        columnNumber: 32
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/web/EvidenceGraph.tsx",
                lineNumber: 149,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/web/EvidenceGraph.tsx",
        lineNumber: 130,
        columnNumber: 10
    }, this);
}
_s1(EvidenceGraph, "/nB0d4JCWdpZIfzeGuO4VeNWa7U=");
_c2 = EvidenceGraph;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "Scene");
__turbopack_context__.k.register(_c1, "StaticGraph");
__turbopack_context__.k.register(_c2, "EvidenceGraph");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/EvidenceGraph.tsx [app-client] (ecmascript, next/dynamic entry)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/web/EvidenceGraph.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=web_EvidenceGraph_tsx_07yj7ti-__2hv._.js.map