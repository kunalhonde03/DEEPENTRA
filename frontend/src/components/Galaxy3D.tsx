import { useCallback, useEffect, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { getWalletArchetype } from "../utils/archetypeHelper";

// Store references to threat & pulse meshes for 60fps standard material animation
const _threatMeshes = new Set<{
  core: THREE.Mesh;
  halo: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  haloMaterial: THREE.MeshBasicMaterial;
}>();

// Reference for active shockwaves
interface Shockwave {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  startTime: number;
  duration: number;
}
const _shockwaves: Shockwave[] = [];

let animationFrameId: number;
const startSceneAnimations = (sceneRef: React.MutableRefObject<THREE.Scene | null>) => {
  let t = 0;
  const animate = () => {
    t += 0.04;
    const pulseScale = 1.0 + 0.07 * Math.sin(t * 1.8);
    const emissiveIntensity = 0.5 + 0.45 * Math.abs(Math.sin(t * 1.8));

    // Pulse threat nodes
    _threatMeshes.forEach(({ core, halo, material, haloMaterial }) => {
      core.scale.set(pulseScale, pulseScale, pulseScale);
      halo.scale.set(pulseScale * 1.05, pulseScale * 1.05, pulseScale * 1.05);
      material.emissiveIntensity = emissiveIntensity;
      haloMaterial.opacity = 0.15 + 0.2 * Math.abs(Math.sin(t * 1.8));
    });

    // Animate shockwaves
    const now = performance.now();
    for (let i = _shockwaves.length - 1; i >= 0; i--) {
      const sw = _shockwaves[i];
      const elapsed = now - sw.startTime;
      const progress = elapsed / sw.duration;
      if (progress >= 1.0) {
        if (sceneRef.current) sceneRef.current.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        sw.material.dispose();
        _shockwaves.splice(i, 1);
      } else {
        const scale = 1.0 + progress * 24;
        sw.mesh.scale.set(scale, scale, scale);
        sw.material.opacity = (1.0 - progress) * 0.85;
      }
    }

    animationFrameId = requestAnimationFrame(animate);
  };
  animate();
};

// ── Types ──────────────────────────────────────────────────────
export interface GalaxyNode {
  id: string;             // wallet address (0x...)
  address: string;
  label: "defi_user" | "bot" | "exchange" | "whale" | "attacker" | "unknown";
  riskScore: number;      // 0.0 → 1.0
  flagged: boolean;
  txCount: number;
  balanceEth: number;
  keyword?: string;
  icon?: string;
  summary?: string;
  badge?: string;
  archetypeColor?: string;
  category?: string;
  x?: number;
  y?: number;
  z?: number;
  __threeObj?: THREE.Object3D;
}

export interface GalaxyLink {
  source: string | GalaxyNode;
  target: string | GalaxyNode;
  txHash: string;
  valueEth: number;
}

export interface GraphData {
  nodes: GalaxyNode[];
  links: GalaxyLink[];
}

interface Galaxy3DProps {
  graphData: GraphData;
  onNodeSelect: (node: GalaxyNode) => void;
  selectedNode: GalaxyNode | null;
  alertMode?: boolean;
}

// ── Risk Color Mapping ─────────────────────────────────────────
function riskToColor(riskScore: number, flagged: boolean): string {
  if (flagged || riskScore > 0.85) return "#FF3B3B";   // Critical — glowing red
  if (riskScore > 0.65) return "#FF8C00";              // High — amber
  if (riskScore > 0.40) return "#F59E0B";              // Medium — gold
  if (riskScore > 0.20) return "#00D4FF";              // Low — cyan
  return "#10B981";                                    // Safe — emerald
}

function labelToSize(label: GalaxyNode["label"], riskScore: number): number {
  const base = label === "whale" ? 6.8 : label === "exchange" ? 5.8 : 3.8;
  return base + riskScore * 4.0;
}

// ── Component ──────────────────────────────────────────────────
export default function Galaxy3D({
  graphData,
  onNodeSelect,
  selectedNode,
  alertMode = false,
}: Galaxy3DProps) {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [legendOpen, setLegendOpen] = useState(true);
  const [renderQuality, setRenderQuality] = useState<"ultra" | "lite" | "flat">("ultra");
  const [autoRotateActive, setAutoRotateActive] = useState(true);
  const [fps, setFps] = useState(60);

  // Responsive resize
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Clear threat meshes on data change
  useEffect(() => {
    _threatMeshes.clear();
  }, [graphData, renderQuality]);

  // FPS Monitor & Auto-Degrade
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let lowFpsCount = 0;

    const checkFps = () => {
      const now = performance.now();
      frameCount++;
      if (now - lastTime >= 1000) {
        const currentFps = Math.round((frameCount * 1000) / (now - lastTime));
        setFps(currentFps);
        frameCount = 0;
        lastTime = now;

        if (currentFps < 28 && renderQuality === "ultra") {
          lowFpsCount++;
          if (lowFpsCount >= 3) {
            console.warn("Rakshak 3D: Auto-downgrading to Lite Quality for smooth 60fps performance.");
            setRenderQuality("lite");
          }
        } else {
          lowFpsCount = 0;
        }
      }
      requestAnimationFrame(checkFps);
    };
    const animId = requestAnimationFrame(checkFps);
    return () => cancelAnimationFrame(animId);
  }, [renderQuality]);

  // Three.js Scene Setup (Starfield, Lights, Fog, Floor Grid)
  useEffect(() => {
    if (!graphRef.current) return;
    const scene: THREE.Scene = graphRef.current.scene();
    sceneRef.current = scene;

    // Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0x0e172a, 1.6);
    ambientLight.name = "rakshak_ambient";
    scene.add(ambientLight);

    // Primary Cyan Key Light
    const dirLight1 = new THREE.DirectionalLight(0x00d4ff, 2.6);
    dirLight1.position.set(300, 400, 250);
    dirLight1.name = "rakshak_keylight";
    scene.add(dirLight1);

    // Crimson Counter Rim Light
    const dirLight2 = new THREE.DirectionalLight(0xff3b3b, 2.0);
    dirLight2.position.set(-300, -200, -250);
    dirLight2.name = "rakshak_rimlight";
    scene.add(dirLight2);

    // Top Sky Soft Light
    const pointLight = new THREE.PointLight(0x38bdf8, 2.2, 900);
    pointLight.position.set(0, 250, 0);
    pointLight.name = "rakshak_pointlight";
    scene.add(pointLight);

    // Volumetric Cosmic Fog
    scene.fog = new THREE.FogExp2(0x030712, 0.0013);

    // 3D Particle Starfield
    if (renderQuality !== "flat") {
      const starCount = renderQuality === "ultra" ? 2800 : 1200;
      const starGeometry = new THREE.BufferGeometry();
      const starPositions = new Float32Array(starCount * 3);
      const starColors = new Float32Array(starCount * 3);

      const colorPalette = [
        new THREE.Color(0x00d4ff),
        new THREE.Color(0xffffff),
        new THREE.Color(0x38bdf8),
        new THREE.Color(0x94a3b8),
      ];

      for (let i = 0; i < starCount; i++) {
        // Spherical distribution around graph
        const r = 650 + Math.random() * 1100;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPositions[i * 3 + 2] = r * Math.cos(phi);

        const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        starColors[i * 3] = col.r;
        starColors[i * 3 + 1] = col.g;
        starColors[i * 3 + 2] = col.b;
      }

      starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
      starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

      const starMaterial = new THREE.PointsMaterial({
        size: renderQuality === "ultra" ? 2.4 : 1.8,
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      });

      const starField = new THREE.Points(starGeometry, starMaterial);
      starField.name = "rakshak_starfield";
      scene.add(starField);
    }

    // 3D Spatial Ground Reference Grid
    if (renderQuality === "ultra") {
      const gridHelper = new THREE.GridHelper(1400, 36, 0x00d4ff, 0x1e293b);
      gridHelper.position.y = -220;
      if (gridHelper.material instanceof THREE.Material) {
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.14;
      }
      gridHelper.name = "rakshak_grid";
      scene.add(gridHelper);
    }

    // Start 60fps animations
    startSceneAnimations(sceneRef);

    return () => {
      cancelAnimationFrame(animationFrameId);
      // Clean up scene objects
      ["rakshak_ambient", "rakshak_keylight", "rakshak_rimlight", "rakshak_pointlight", "rakshak_starfield", "rakshak_grid"].forEach((name) => {
        const obj = scene.getObjectByName(name);
        if (obj) scene.remove(obj);
      });
    };
  }, [renderQuality]);

  // OrbitControls Configuration & Smart Idle Auto-Rotation
  useEffect(() => {
    if (!graphRef.current) return;
    const controls = graphRef.current.controls();
    if (!controls) return;

    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotateActive;
    controls.autoRotateSpeed = 0.55;

    // Reset idle timer on user interaction
    const handleUserInteraction = () => {
      controls.autoRotate = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (autoRotateActive) {
          controls.autoRotate = true;
        }
      }, 4500); // 4.5s idle threshold
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("pointerdown", handleUserInteraction);
      container.addEventListener("wheel", handleUserInteraction);
    }

    return () => {
      if (container) {
        container.removeEventListener("pointerdown", handleUserInteraction);
        container.removeEventListener("wheel", handleUserInteraction);
      }
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [autoRotateActive]);

  // Connected nodes map for 3D spotlighting
  const connectedNodeIds = useRef(new Set<string>());
  useEffect(() => {
    connectedNodeIds.current.clear();
    if (selectedNode) {
      connectedNodeIds.current.add(selectedNode.id);
      graphData.links.forEach((link) => {
        const sId = typeof link.source === "object" ? (link.source as GalaxyNode).id : link.source;
        const tId = typeof link.target === "object" ? (link.target as GalaxyNode).id : link.target;
        if (sId === selectedNode.id) connectedNodeIds.current.add(tId);
        if (tId === selectedNode.id) connectedNodeIds.current.add(sId);
      });
    }
  }, [selectedNode, graphData]);

  // Camera Fly-To on Node Selection (Smooth Eased 3D Dolly)
  useEffect(() => {
    if (selectedNode && graphRef.current) {
      const targetX = selectedNode.x ?? 0;
      const targetY = selectedNode.y ?? 0;
      const targetZ = selectedNode.z ?? 0;

      graphRef.current.cameraPosition(
        { x: targetX + 80, y: targetY + 25, z: targetZ + 95 },
        { x: targetX, y: targetY, z: targetZ },
        650
      );
    }
  }, [selectedNode]);

  // Cinematic Threat Detection Shockwave Trigger
  const triggerShockwave = useCallback((originNode: GalaxyNode) => {
    if (!sceneRef.current) return;
    const ringGeo = new THREE.TorusGeometry(3.5, 0.8, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#FF3B3B"),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(originNode.x ?? 0, originNode.y ?? 0, originNode.z ?? 0);
    ringMesh.rotation.x = Math.PI / 2;

    sceneRef.current.add(ringMesh);
    _shockwaves.push({
      mesh: ringMesh,
      material: ringMat,
      startTime: performance.now(),
      duration: 1600,
    });
  }, []);

  // Alert Mode Trigger: Fly to Threat Node & Fire Shockwave
  useEffect(() => {
    if (alertMode && graphRef.current) {
      const threatNode = graphData.nodes.find((n) => n.label === "attacker" || n.flagged || n.riskScore > 0.85) || graphData.nodes[0];
      if (threatNode) {
        triggerShockwave(threatNode);
        graphRef.current.cameraPosition(
          { x: (threatNode.x ?? 0) + 70, y: (threatNode.y ?? 0) + 20, z: (threatNode.z ?? 0) + 85 },
          { x: threatNode.x ?? 0, y: threatNode.y ?? 0, z: threatNode.z ?? 0 },
          800
        );
      }
    }
  }, [alertMode, graphData.nodes, triggerShockwave]);

  // Manual Camera Controls
  const handleZoomIn = () => {
    if (!graphRef.current) return;
    const current = graphRef.current.cameraPosition();
    graphRef.current.cameraPosition(
      { x: current.x * 0.72, y: current.y * 0.72, z: current.z * 0.72 },
      undefined,
      400
    );
  };

  const handleZoomOut = () => {
    if (!graphRef.current) return;
    const current = graphRef.current.cameraPosition();
    graphRef.current.cameraPosition(
      { x: current.x * 1.38, y: current.y * 1.38, z: current.z * 1.38 },
      undefined,
      400
    );
  };

  const handleResetCamera = () => {
    if (!graphRef.current) return;
    graphRef.current.cameraPosition({ x: 0, y: 30, z: 340 }, { x: 0, y: 0, z: 0 }, 800);
  };

  // ── 3D Node Object Factory with Real Material Lighting ─────────
  const nodeThreeObject = useCallback(
    (node: GalaxyNode) => {
      const isAttacker = node.label === "attacker";
      const isSelected = selectedNode?.id === node.id;
      const isFocused = !selectedNode || isSelected || connectedNodeIds.current.has(node.id);
      const isThreat = isAttacker || node.flagged || node.riskScore > 0.65;

      const arch = getWalletArchetype(
        node.address,
        node.label,
        node.riskScore,
        node.txCount,
        node.balanceEth,
        node.flagged
      );

      const colorHex = node.archetypeColor || arch.color || (isAttacker ? "#FF1111" : riskToColor(node.riskScore, node.flagged));
      const baseSize = labelToSize(node.label, node.riskScore);
      const size = isSelected ? baseSize * 1.65 : isFocused ? baseSize : baseSize * 0.8;

      const segments = renderQuality === "ultra" ? 24 : 14;
      const geometry = new THREE.SphereGeometry(size, segments, segments);
      const opacity = isFocused ? 1.0 : 0.3;

      // Real MeshStandardMaterial with physical roughness, metalness, and emissive glow
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.24,
        metalness: 0.68,
        emissive: new THREE.Color(isThreat ? "#FF2222" : isSelected ? "#00D4FF" : colorHex),
        emissiveIntensity: isThreat ? 0.85 : isSelected ? 0.65 : 0.22,
        transparent: opacity < 1.0,
        opacity: opacity,
      });

      const mesh = new THREE.Mesh(geometry, material);

      // Outer Volumetric Aura Halo
      const haloSize = isAttacker ? size * 3.4 : isSelected ? size * 2.8 : node.flagged ? size * 2.3 : size * 1.5;
      const haloOpacity = isAttacker ? 0.32 : isSelected ? 0.26 : isFocused ? 0.12 : 0.02;

      const haloGeo = new THREE.SphereGeometry(haloSize, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: haloOpacity,
        side: THREE.BackSide,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);

      const group = new THREE.Group();
      group.add(mesh);
      group.add(haloMesh);

      if (isThreat || isSelected) {
        _threatMeshes.add({
          core: mesh,
          halo: haloMesh,
          material,
          haloMaterial: haloMat,
        });
      }

      return group;
    },
    [selectedNode, renderQuality]
  );

  // Link Flow Colors and Dynamic Width
  const linkColor = useCallback((link: GalaxyLink) => {
    if (selectedNode) {
      const sId = typeof link.source === "object" ? (link.source as GalaxyNode).id : link.source;
      const tId = typeof link.target === "object" ? (link.target as GalaxyNode).id : link.target;
      const isConnected = sId === selectedNode.id || tId === selectedNode.id;
      if (!isConnected) return "rgba(100, 116, 139, 0.06)";
    }
    if (link.valueEth > 10) return "rgba(255, 59, 59, 0.82)";
    if (link.valueEth > 1) return "rgba(255, 140, 0, 0.72)";
    return "rgba(0, 212, 255, 0.52)";
  }, [selectedNode]);

  const linkWidth = useCallback((link: GalaxyLink) => {
    if (selectedNode) {
      const sId = typeof link.source === "object" ? (link.source as GalaxyNode).id : link.source;
      const tId = typeof link.target === "object" ? (link.target as GalaxyNode).id : link.target;
      if (sId === selectedNode.id || tId === selectedNode.id) {
        return Math.min(2.0 + link.valueEth * 0.25, 4.8);
      }
      return 0.4;
    }
    return Math.min(1.0 + link.valueEth * 0.14, 3.8);
  }, [selectedNode]);

  return (
    <div
      ref={containerRef}
      className="galaxy-container bg-canvas-depth"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: alertMode
          ? "radial-gradient(ellipse at center, #1c0505 0%, #030712 100%)"
          : "radial-gradient(ellipse at center, #070d1e 0%, #030712 100%)",
        transition: "background 0.5s ease",
      }}
    >
      {/* Node Count & Performance HUD — Top Left */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          background: "rgba(11, 17, 33, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 9999,
          padding: "6px 14px",
          color: "#E2E8F0",
          fontSize: 11.5,
          fontFamily: "'JetBrains Mono', monospace",
          backdropFilter: "blur(14px)",
          boxShadow: "0 8px 24px -4px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ color: "#00D4FF" }}>⬡</span>
        <span>{graphData.nodes.length.toLocaleString()} nodes</span>
        <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>
        <span style={{ color: "#94A3B8" }}>{graphData.links.length.toLocaleString()} edges</span>
        <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>
        <span style={{ color: fps >= 45 ? "#10B981" : fps >= 28 ? "#F59E0B" : "#FF3B3B", fontWeight: 700 }}>
          {fps} FPS
        </span>
        {selectedNode && (
          <>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>
            <span style={{ color: "#F59E0B", fontWeight: 600 }}>Spotlight Active</span>
          </>
        )}
      </div>

      {/* Collapsible Node Legend — Bottom Left */}
      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: 18,
          zIndex: 10,
          background: "rgba(11, 17, 33, 0.88)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 10,
          padding: legendOpen ? "12px 14px" : "6px 12px",
          backdropFilter: "blur(14px)",
          boxShadow: "0 12px 32px -4px rgba(0, 0, 0, 0.6)",
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          minWidth: legendOpen ? 210 : "auto",
        }}
      >
        <div
          onClick={() => setLegendOpen(!legendOpen)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
            color: "#94A3B8",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontFamily: "'JetBrains Mono', monospace",
            gap: 8,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>🗺️</span> GRAPH LEGEND
          </span>
          <span style={{ fontSize: 10, color: "#64748B" }}>{legendOpen ? "▼" : "▲"}</span>
        </div>

        {legendOpen && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#F1F5F9" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF3B3B", boxShadow: "0 0 8px #FF3B3B" }} />
              <span>Critical / Threat (&gt;85%)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#F1F5F9" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF8C00" }} />
              <span>High Risk (65–85%)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#F1F5F9" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
              <span>Medium Risk (40–65%)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#F1F5F9" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00D4FF" }} />
              <span>Low Risk / Active DeFi</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#F1F5F9" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
              <span>Trusted Wallet (&lt;20%)</span>
            </div>
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)", color: "#64748B", fontSize: 10 }}>
              Directional flow indicates fund routing
            </div>
          </div>
        )}
      </div>

      {/* 3D Camera & Quality Controls Cluster — Bottom Right */}
      <div
        style={{
          position: "absolute",
          bottom: 18,
          right: 18,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          background: "rgba(11, 17, 33, 0.90)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 8,
          padding: 6,
          backdropFilter: "blur(14px)",
          boxShadow: "0 12px 32px -4px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Quality Mode Switcher */}
        <div style={{ display: "flex", gap: 3, marginBottom: 2 }}>
          <button
            onClick={() => setRenderQuality("ultra")}
            style={{
              flex: 1,
              padding: "4px 6px",
              borderRadius: 4,
              fontSize: 9.5,
              fontWeight: 700,
              cursor: "pointer",
              border: "1px solid",
              background: renderQuality === "ultra" ? "rgba(0, 212, 255, 0.2)" : "rgba(255, 255, 255, 0.03)",
              borderColor: renderQuality === "ultra" ? "#00D4FF" : "transparent",
              color: renderQuality === "ultra" ? "#00D4FF" : "#94A3B8",
              fontFamily: "'JetBrains Mono', monospace",
            }}
            title="Full 3D: High-poly standard materials, 3D starfield, spatial grid"
          >
            3D MAX
          </button>
          <button
            onClick={() => setRenderQuality("lite")}
            style={{
              flex: 1,
              padding: "4px 6px",
              borderRadius: 4,
              fontSize: 9.5,
              fontWeight: 700,
              cursor: "pointer",
              border: "1px solid",
              background: renderQuality === "lite" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.03)",
              borderColor: renderQuality === "lite" ? "#10B981" : "transparent",
              color: renderQuality === "lite" ? "#10B981" : "#94A3B8",
              fontFamily: "'JetBrains Mono', monospace",
            }}
            title="Lite 3D: Optimized polygons for mid-range laptops"
          >
            LITE
          </button>
        </div>

        {/* Auto Rotate Toggle */}
        <button
          onClick={() => setAutoRotateActive(!autoRotateActive)}
          style={{
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            cursor: "pointer",
            border: "1px solid",
            background: autoRotateActive ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.03)",
            borderColor: autoRotateActive ? "rgba(56, 189, 248, 0.4)" : "rgba(255, 255, 255, 0.08)",
            color: autoRotateActive ? "#38BDF8" : "#64748B",
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: 2,
          }}
          title="Toggle automatic idle orbit rotation"
        >
          {autoRotateActive ? "🔄 ROTATE ON" : "⏸ ROTATE OFF"}
        </button>

        {/* Camera Navigation Cluster */}
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            style={{
              flex: 1,
              height: 28,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 4,
              color: "#E2E8F0",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            style={{
              flex: 1,
              height: 28,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 4,
              color: "#E2E8F0",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            −
          </button>
          <button
            onClick={handleResetCamera}
            title="Reset Camera View"
            style={{
              flex: 1,
              height: 28,
              background: "rgba(0, 212, 255, 0.08)",
              border: "1px solid rgba(0, 212, 255, 0.25)",
              borderRadius: 4,
              color: "#00D4FF",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ⊙
          </button>
        </div>
      </div>

      {/* Force Graph 3D Component */}
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="rgba(0,0,0,0)"
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={(node: GalaxyNode) => {
          const arch = getWalletArchetype(
            node.address,
            node.label,
            node.riskScore,
            node.txCount,
            node.balanceEth,
            node.flagged
          );
          const color = node.archetypeColor || arch.color;
          const icon = node.icon || arch.icon;
          const kw = node.keyword || arch.keyword;
          const category = node.category || arch.category;
          const sum = node.summary || arch.summary;
          const riskPct = (node.riskScore * 100).toFixed(1);
          const bal = (node.balanceEth ?? 0).toFixed(2);

          return `<div style="background:rgba(8,12,24,0.96);border:1px solid ${color}90;padding:12px 14px;border-radius:10px;font-family:'Inter',sans-serif;color:#fff;box-shadow:0 12px 32px rgba(0,0,0,0.85);max-width:290px;backdrop-filter:blur(18px);">
            <div style="font-weight:800;font-size:12px;color:${color};letter-spacing:0.04em;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span style="display:flex;align-items:center;gap:6px;"><span>${icon}</span> <span style="font-family:'JetBrains Mono',monospace;">${kw}</span></span>
              <span style="font-size:9.5px;background:${color}22;color:${color};padding:2px 6px;border-radius:4px;border:1px solid ${color}60;white-space:nowrap;font-family:'JetBrains Mono',monospace;">${riskPct}% RISK</span>
            </div>
            <div style="font-size:9.5px;color:#38BDF8;font-family:'JetBrains Mono',monospace;margin-bottom:4px;display:flex;align-items:center;gap:4px;">
              <span style="font-weight:700;">📖 PLAIN ENGLISH MEANING</span>
              <span style="color:#64748B;">•</span>
              <span style="color:#94A3B8;text-transform:uppercase;">${category}</span>
            </div>
            <div style="font-size:11.5px;color:#F1F5F9;line-height:1.5;margin-bottom:8px;background:rgba(255,255,255,0.03);padding:6px 8px;border-radius:6px;border-left:2px solid ${color};">
              ${sum}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94A3B8;font-family:'JetBrains Mono',monospace;border-top:1px solid rgba(255,255,255,0.08);padding-top:6px;">
              <span style="color:#E2E8F0;">${node.address.slice(0, 8)}…${node.address.slice(-6)}</span>
              <span style="color:#38BDF8;">${bal} ETH · ${node.txCount.toLocaleString()} txs</span>
            </div>
          </div>`;
        }}
        onNodeClick={(node: GalaxyNode) => onNodeSelect(node)}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={selectedNode ? 0.65 : 0.45}
        linkDirectionalParticles={selectedNode ? 5 : 3}
        linkDirectionalParticleSpeed={selectedNode ? 0.009 : 0.006}
        linkDirectionalParticleWidth={selectedNode ? 3.0 : 2.2}
        linkDirectionalParticleColor={(link: GalaxyLink) =>
          link.valueEth > 10 ? "#FF3B3B" : link.valueEth > 1 ? "#FF8C00" : "#00D4FF"
        }
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
        d3AlphaDecay={0.018}
        d3VelocityDecay={0.28}
        warmupTicks={120}
        cooldownTicks={250}
      />
    </div>
  );
}
