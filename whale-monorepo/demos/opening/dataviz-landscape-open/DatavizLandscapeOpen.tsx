'use client';

import React, { useEffect, useMemo } from 'react';
import {
  motion,
  useAnimate,
  useMotionValue,
  useTransform,
  useReducedMotion,
  type Variants,
} from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

interface DatavizLandscapeOpenProps {
  className?: string;
  /** Fires when the full animation sequence completes (~5.5s) */
  onAnimationComplete?: () => void;
  /** Total animation duration in ms (default 5500) */
  duration?: number;
}

interface StreamLine {
  id: string;
  path: string;
  layer: 'near' | 'mid' | 'far';
  isMainTrunk: boolean;
  drawDelay: number;   // ms delay before draw-on starts
  drawDuration: number; // ms for the draw-on to complete
}

interface LineTag {
  id: string;
  label: string;        // e.g. "APP-1843"
  lineId: string;       // which stream line this tag is anchored to
  t: number;            // position along the bezier (0..1)
  fadeInDelay: number;  // ms delay before fade-in
  offsetX: number;      // pixel offset from anchor point
  offsetY: number;
}

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */

const WORLD_W = 2400;
const WORLD_H = 1350;
const JUNCTION_X = 1550;
const JUNCTION_Y = 600;
const VIEWPORT_W = 1200;
const VIEWPORT_H = 675;

// Phase timing (ms)
const PHASE1_END = 1500;   // draw-on completes
const CAMERA_START = 1000;  // camera begins moving (overlaps draw-on)
const PHASE2_END = 4500;   // camera flyover
const TAG_FIRST = 1400;    // first tag appears
const TAG_LAST = 2400;     // last tag appears
const TOTAL_MS = 5500;

// Parallax multipliers
const PARALLAX_NEAR = 1.4;
const PARALLAX_MID = 1.0;
const PARALLAX_FAR = 0.6;

// Camera travel in world pixels (total horizontal displacement)
const CAMERA_TRAVEL = 280;

// Depth-of-field blur
const BLUR_NEAR = 12;
const BLUR_FAR = 2;

// Line widths per layer
const LINE_WIDTH_NEAR = 7;
const LINE_WIDTH_MID = 2.5;
const LINE_WIDTH_FAR = 1.2;
const LINE_WIDTH_TRUNK = 3;

// Brightness per layer (stroke opacity)
const BRIGHTNESS_NEAR = 0.20;
const BRIGHTNESS_MID = 0.65;
const BRIGHTNESS_FAR = 0.28;
const BRIGHTNESS_TRUNK = 0.85;

// Color palette
const LINE_COLOR = '#8BB8E0';   // cool blue-white for lines
const TAG_COLOR = '#FFFFFF';
const TAG_PIN_COLOR = '#5BA0D0';
const BG_COLOR = '#080C14';

/* ═══════════════════════════════════════════════════════════════════
   HELPERS — cubic bezier point at parameter t
   ═══════════════════════════════════════════════════════════════════ */

function bezierPoint(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): [number, number] {
  const mt = 1 - t;
  const x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0];
  const y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1];
  return [x, y];
}

function bezierToSvg(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): string {
  return `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`;
}

/* ═══════════════════════════════════════════════════════════════════
   DATA — stream line definitions
   ═══════════════════════════════════════════════════════════════════ */

interface TributaryDef {
  id: string;
  start: [number, number];
  cp1: [number, number];
  layer: 'near' | 'mid' | 'far';
  drawOrder: number; // 0 = first after trunk
}

// Tributaries come from the left, curve toward junction at (1550, 600).
// Control point 2 (cp2) is always ~220px before junction at same y,
// ensuring tangent continuity (horizontal arrival matches main trunk).
// Control point 1 (cp1) creates organic variation.
const TRIBUTARY_DEFS: TributaryDef[] = [
  // ── Mid layer (primary readable) ──
  { id: 't1',  start: [60,   180],  cp1: [320,  160],  layer: 'mid', drawOrder: 1 },
  { id: 't2',  start: [40,   340],  cp1: [280,  310],  layer: 'mid', drawOrder: 3 },
  { id: 't3',  start: [80,   520],  cp1: [350,  480],  layer: 'mid', drawOrder: 5 },
  { id: 't4',  start: [50,   720],  cp1: [300,  750],  layer: 'mid', drawOrder: 7 },
  { id: 't5',  start: [70,   900],  cp1: [340,  880],  layer: 'mid', drawOrder: 9 },
  { id: 't6',  start: [100,  1080], cp1: [380,  1100], layer: 'mid', drawOrder: 11 },

  // ── Far layer (thin, dim, distant) ──
  { id: 'f1',  start: [20,   80],   cp1: [200,  100],  layer: 'far', drawOrder: 2 },
  { id: 'f2',  start: [30,   430],  cp1: [250,  420],  layer: 'far', drawOrder: 4 },
  { id: 'f3',  start: [150,  800],  cp1: [400,  820],  layer: 'far', drawOrder: 6 },
  { id: 'f4',  start: [60,   1200], cp1: [300,  1180], layer: 'far', drawOrder: 8 },

  // ── Near layer (thick, heavily blurred, foreground) ──
  { id: 'n1',  start: [-20,  260],  cp1: [180,  220],  layer: 'near', drawOrder: 10 },
  { id: 'n2',  start: [10,   980],  cp1: [220,  1020], layer: 'near', drawOrder: 12 },
];

function buildStreamLines(): StreamLine[] {
  const lines: StreamLine[] = [];

  // Main trunk: horizontal from junction to right edge
  const trunkPath = `M ${JUNCTION_X} ${JUNCTION_Y} L ${WORLD_W + 100} ${JUNCTION_Y}`;
  lines.push({
    id: 'trunk',
    path: trunkPath,
    layer: 'mid',
    isMainTrunk: true,
    drawDelay: 0,
    drawDuration: 1100, // ~33f at 30fps — spec says 30-40f
  });

  // Tributaries
  const STAGGER_MS = 120; // ~3.6f at 30fps — spec says 3-6f per tributary
  const BASE_DURATION = 900;

  for (const def of TRIBUTARY_DEFS) {
    const cp2: [number, number] = [JUNCTION_X - 220, JUNCTION_Y];
    const path = bezierToSvg(def.start, def.cp1, cp2, [JUNCTION_X, JUNCTION_Y]);
    lines.push({
      id: def.id,
      path,
      layer: def.layer,
      isMainTrunk: false,
      drawDelay: STAGGER_MS * def.drawOrder + 200, // offset from trunk start
      drawDuration: BASE_DURATION + Math.random() * 200,
    });
  }

  return lines;
}

/* ═══════════════════════════════════════════════════════════════════
   DATA — tag definitions
   ═══════════════════════════════════════════════════════════════════ */

const TAG_LABELS = [
  'APP-1843',
  'INFRA-927',
  'DATA-512',
  'API-2301',
  'UI-847',
  'DB-390',
];

function buildTags(lines: StreamLine[]): LineTag[] {
  const midTributaries = lines.filter(l => l.layer === 'mid' && !l.isMainTrunk);
  const tags: LineTag[] = [];

  for (let i = 0; i < Math.min(TAG_LABELS.length, midTributaries.length); i++) {
    // Place tag at varying positions along the tributary (0.35–0.65)
    const t = 0.35 + (i / (midTributaries.length - 1)) * 0.3;
    tags.push({
      id: `tag-${i}`,
      label: TAG_LABELS[i],
      lineId: midTributaries[i].id,
      t,
      fadeInDelay: TAG_FIRST + i * 130, // ~4f stagger at 30fps — spec says 6-10f
      offsetX: 24,
      offsetY: -36,
    });
  }

  return tags;
}

/* ═══════════════════════════════════════════════════════════════════
   TAG ANCHOR — computes bezier point for tag placement
   ═══════════════════════════════════════════════════════════════════ */

function getTagAnchor(def: TributaryDef, t: number): [number, number] {
  const cp2: [number, number] = [JUNCTION_X - 220, JUNCTION_Y];
  return bezierPoint(t, def.start, def.cp1, cp2, [JUNCTION_X, JUNCTION_Y]);
}

/* ═══════════════════════════════════════════════════════════════════
   TAG ANCHOR MAP — precomputed tag positions
   ═══════════════════════════════════════════════════════════════════ */

function buildTagAnchors(
  tags: LineTag[],
): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  for (const tag of tags) {
    const def = TRIBUTARY_DEFS.find(d => d.id === tag.lineId);
    if (!def) continue;
    const [x, y] = getTagAnchor(def, tag.t);
    map.set(tag.id, { x, y });
  }
  return map;
}

/* ═══════════════════════════════════════════════════════════════════
   TAG FADE VARIANTS
   ═══════════════════════════════════════════════════════════════════ */

const tagVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: delay / 1000,
      duration: 0.6,
      ease: [0.33, 0, 0.67, 1],
    },
  }),
};

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export const DatavizLandscapeOpen: React.FC<DatavizLandscapeOpenProps> = ({
  className = '',
  onAnimationComplete,
  duration = TOTAL_MS,
}) => {
  const prefersReduced = useReducedMotion();
  const [scope, animate] = useAnimate();

  // Camera motion value — drives all three parallax layers
  const cameraX = useMotionValue(0);
  const nearLayerX = useTransform(cameraX, v => v * PARALLAX_NEAR);
  const midLayerX = useTransform(cameraX, v => v * PARALLAX_MID);
  const farLayerX = useTransform(cameraX, v => v * PARALLAX_FAR);

  // Slow zoom (1.0 → 1.06) — adds subtle depth
  const cameraZoom = useMotionValue(1);

  // Derived data
  const streamLines = useMemo(() => buildStreamLines(), []);
  const tags = useMemo(() => buildTags(streamLines), [streamLines]);
  const tagAnchors = useMemo(() => buildTagAnchors(tags), [tags]);

  // Compute actual timeline based on duration prop
  const timeScale = duration / TOTAL_MS;

  // ── Animation orchestration ──
  useEffect(() => {
    if (prefersReduced) return;

    const run = async () => {
      // Phase 1: Draw-on — main trunk first
      const trunkEl = scope.current?.querySelector('[data-line="trunk"]') as SVGPathElement | null;
      if (trunkEl) {
        await animate(
          trunkEl,
          { pathLength: 1 },
          { duration: (streamLines[0].drawDuration * timeScale) / 1000, ease: [0.33, 0, 0.67, 1] },
        );
      }

      // Tributaries — staggered, each starts independently
      const tributaryLines = streamLines.filter(l => !l.isMainTrunk);
      const tributaryAnimations = tributaryLines.map(line => {
        const el = scope.current?.querySelector(`[data-line="${line.id}"]`) as SVGPathElement | null;
        if (!el) return Promise.resolve();
        return animate(
          el,
          { pathLength: 1 },
          {
            duration: (line.drawDuration * timeScale) / 1000,
            delay: (line.drawDelay * timeScale) / 1000,
            ease: [0.33, 0, 0.67, 1],
          },
        );
      });

      // Phase 2: Camera flyover — starts during draw-on (at CAMERA_START)
      const cameraAnim = animate(
        cameraX,
        CAMERA_TRAVEL,
        {
          duration: ((PHASE2_END - CAMERA_START) * timeScale) / 1000,
          delay: (CAMERA_START * timeScale) / 1000,
          ease: 'linear',
        },
      );

      // Subtle zoom
      const zoomAnim = animate(
        cameraZoom,
        1.06,
        {
          duration: ((PHASE2_END - CAMERA_START) * timeScale) / 1000,
          delay: (CAMERA_START * timeScale) / 1000,
          ease: 'linear',
        },
      );

      // Flow pulse — starts after draw-on, runs indefinitely
      const flowPulseDelay = (PHASE1_END * timeScale) / 1000;
      const flowPulseAnim = animate(
        '[data-flow-pulse]',
        { strokeDashoffset: [-40, 0] },
        {
          duration: 3,
          delay: flowPulseDelay,
          repeat: Infinity,
          ease: 'linear',
        },
      );

      // Wait for all draw-on animations
      await Promise.all(tributaryAnimations);

      // Signal completion after handoff window
      setTimeout(() => {
        onAnimationComplete?.();
      }, (PHASE2_END - PHASE1_END) * timeScale);

      // Keep camera/zoom/flow running — they continue through Phase 3
      await Promise.all([cameraAnim, zoomAnim, flowPulseAnim]);
    };

    run();
  // We intentionally only run this once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReduced]);

  // ── Reduced motion: static landscape ──
  if (prefersReduced) {
    return (
      <div
        className={`relative overflow-hidden ${className}`}
        style={{ width: '100%', height: '100%', background: BG_COLOR }}
      >
        <svg
          viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: '100%' }}
        >
          {renderStaticLayers(streamLines, tags, tagAnchors)}
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={scope}
      className={`relative overflow-hidden ${className}`}
      style={{ width: '100%', height: '100%', background: BG_COLOR }}
    >
      {/* Vignette overlay — darkens edges for depth */}
      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          background: `
            radial-gradient(ellipse at 65% 45%, transparent 55%, ${BG_COLOR} 95%),
            linear-gradient(to right, ${BG_COLOR} 0%, transparent 10%, transparent 85%, ${BG_COLOR} 100%)
          `,
        }}
      />

      <motion.svg
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        preserveAspectRatio="xMidYMid slice"
        style={{
          width: '100%',
          height: '100%',
          scale: cameraZoom,
          transformOrigin: '65% 45%',
        }}
      >
        <defs>
          {/* Soft glow filter for lines */}
          <filter id="glow-subtle" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="glow-trunk" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Flow pulse gradient — travels toward junction */}
          <linearGradient id="flowGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0" />
            <stop offset="40%" stopColor={LINE_COLOR} stopOpacity="0" />
            <stop offset="70%" stopColor={LINE_COLOR} stopOpacity="0.5" />
            <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* ═══════════ FAR LAYER — blur, parallax 0.6× ═══════════ */}
        <motion.g
          style={{
            x: farLayerX,
            filter: `blur(${BLUR_FAR}px)`,
            opacity: BRIGHTNESS_FAR,
          }}
        >
          {streamLines
            .filter(l => l.layer === 'far')
            .map(line => (
              <React.Fragment key={line.id}>
                <motion.path
                  data-line={line.id}
                  d={line.path}
                  fill="none"
                  stroke={LINE_COLOR}
                  strokeWidth={LINE_WIDTH_FAR}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                />
                {/* Flow pulse overlay */}
                <motion.path
                  data-flow-pulse
                  d={line.path}
                  fill="none"
                  stroke="url(#flowGradient)"
                  strokeWidth={LINE_WIDTH_FAR + 1}
                  strokeLinecap="round"
                  strokeDasharray="15 60"
                  initial={{ strokeDashoffset: 0 }}
                />
              </React.Fragment>
            ))}
        </motion.g>

        {/* ═══════════ MID LAYER — clear, parallax 1×, main content ═══════════ */}
        <motion.g style={{ x: midLayerX }}>
          {/* Mid tributaries */}
          {streamLines
            .filter(l => l.layer === 'mid' && !l.isMainTrunk)
            .map(line => (
              <React.Fragment key={line.id}>
                {/* Base line with subtle glow */}
                <motion.path
                  data-line={line.id}
                  d={line.path}
                  fill="none"
                  stroke={LINE_COLOR}
                  strokeWidth={LINE_WIDTH_MID}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow-subtle)"
                  initial={{ pathLength: 0 }}
                  style={{ opacity: BRIGHTNESS_MID }}
                />
                {/* Flow pulse overlay */}
                <motion.path
                  data-flow-pulse
                  d={line.path}
                  fill="none"
                  stroke="url(#flowGradient)"
                  strokeWidth={LINE_WIDTH_MID + 2}
                  strokeLinecap="round"
                  strokeDasharray="12 50"
                  initial={{ strokeDashoffset: 0 }}
                  style={{ opacity: 0.3 }}
                />
              </React.Fragment>
            ))}

          {/* Main trunk — brightest, strongest glow */}
          {streamLines
            .filter(l => l.isMainTrunk)
            .map(line => (
              <React.Fragment key={line.id}>
                <motion.path
                  data-line={line.id}
                  d={line.path}
                  fill="none"
                  stroke={LINE_COLOR}
                  strokeWidth={LINE_WIDTH_TRUNK}
                  strokeLinecap="round"
                  filter="url(#glow-trunk)"
                  initial={{ pathLength: 0 }}
                  style={{ opacity: BRIGHTNESS_TRUNK }}
                />
                {/* Flow pulse on trunk — wider, more visible */}
                <motion.path
                  data-flow-pulse
                  d={line.path}
                  fill="none"
                  stroke="url(#flowGradient)"
                  strokeWidth={LINE_WIDTH_TRUNK + 3}
                  strokeLinecap="round"
                  strokeDasharray="20 70"
                  initial={{ strokeDashoffset: 0 }}
                  style={{ opacity: 0.4 }}
                />
              </React.Fragment>
            ))}

          {/* Tags — on mid layer lines */}
          {tags.map(tag => {
            const anchor = tagAnchors.get(tag.id);
            if (!anchor) return null;
            return (
              <motion.g
                key={tag.id}
                variants={tagVariants}
                initial="hidden"
                animate="visible"
                custom={tag.fadeInDelay * timeScale}
                style={{
                  transform: `translate(${anchor.x + tag.offsetX}px, ${anchor.y + tag.offsetY}px)`,
                }}
              >
                {/* Pin block — small square anchored on the line */}
                <rect
                  x={-3}
                  y={-3}
                  width={6}
                  height={6}
                  rx={1}
                  fill={TAG_PIN_COLOR}
                />
                {/* Connector line from pin to label */}
                <line
                  x1={0}
                  y1={0}
                  x2={10}
                  y2={-14}
                  stroke={TAG_PIN_COLOR}
                  strokeWidth={0.8}
                  opacity={0.5}
                />
                {/* Label background */}
                <rect
                  x={10}
                  y={-32}
                  width={tag.label.length * 13 + 14}
                  height={24}
                  rx={3}
                  fill={BG_COLOR}
                  fillOpacity={0.78}
                  stroke={TAG_PIN_COLOR}
                  strokeWidth={0.8}
                  strokeOpacity={0.35}
                />
                {/* Label text — monospace, ≥18px equivalent at target viewport */}
                <text
                  x={17}
                  y={-15}
                  fill={TAG_COLOR}
                  fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
                  fontSize={20}
                  fontWeight={500}
                  letterSpacing="0.03em"
                  style={{ opacity: 0.92 }}
                >
                  {tag.label}
                </text>
              </motion.g>
            );
          })}
        </motion.g>

        {/* ═══════════ NEAR LAYER — heavy blur, parallax 1.4× ═══════════ */}
        <motion.g
          style={{
            x: nearLayerX,
            filter: `blur(${BLUR_NEAR}px)`,
            opacity: BRIGHTNESS_NEAR,
          }}
        >
          {streamLines
            .filter(l => l.layer === 'near')
            .map(line => (
              <React.Fragment key={line.id}>
                <motion.path
                  data-line={line.id}
                  d={line.path}
                  fill="none"
                  stroke={LINE_COLOR}
                  strokeWidth={LINE_WIDTH_NEAR}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                />
              </React.Fragment>
            ))}
        </motion.g>
      </motion.svg>

      {/* Handoff highlight — bright spot toward junction direction in final frames */}
      <motion.div
        className="pointer-events-none absolute z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.12, 0.08] }}
        transition={{
          duration: (duration * timeScale) / 1000,
          times: [0, 0.7, 0.85, 1],
          ease: 'easeOut',
        }}
        style={{
          top: '35%',
          right: '10%',
          width: 280,
          height: 120,
          background: `radial-gradient(ellipse at center, ${LINE_COLOR}22 0%, transparent 70%)`,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   STATIC RENDER — for reduced-motion preference
   ═══════════════════════════════════════════════════════════════════ */

function renderStaticLayers(
  lines: StreamLine[],
  tags: LineTag[],
  tagAnchors: Map<string, { x: number; y: number }>,
) {
  return (
    <>
      {/* Far layer */}
      <g filter={`blur(${BLUR_FAR}px)`} opacity={BRIGHTNESS_FAR}>
        {lines
          .filter(l => l.layer === 'far')
          .map(l => (
            <path key={l.id} d={l.path} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_WIDTH_FAR} strokeLinecap="round" />
          ))}
      </g>

      {/* Mid layer */}
      <g>
        {lines
          .filter(l => l.layer === 'mid' && !l.isMainTrunk)
          .map(l => (
            <path key={l.id} d={l.path} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_WIDTH_MID} strokeLinecap="round" opacity={BRIGHTNESS_MID} />
          ))}
        {lines
          .filter(l => l.isMainTrunk)
          .map(l => (
            <path key={l.id} d={l.path} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_WIDTH_TRUNK} strokeLinecap="round" opacity={BRIGHTNESS_TRUNK} />
          ))}
        {/* Static tags */}
        {tags.map(tag => {
          const anchor = tagAnchors.get(tag.id);
          if (!anchor) return null;
          return (
            <g key={tag.id} transform={`translate(${anchor.x + 24}, ${anchor.y - 36})`}>
              <rect x={-3} y={-3} width={6} height={6} rx={1} fill={TAG_PIN_COLOR} />
              <rect x={10} y={-32} width={tag.label.length * 13 + 14} height={24} rx={3} fill={BG_COLOR} fillOpacity={0.78} stroke={TAG_PIN_COLOR} strokeWidth={0.8} strokeOpacity={0.35} />
              <text x={17} y={-15} fill={TAG_COLOR} fontFamily="monospace" fontSize={20} fontWeight={500}>{tag.label}</text>
            </g>
          );
        })}
      </g>

      {/* Near layer */}
      <g filter={`blur(${BLUR_NEAR}px)`} opacity={BRIGHTNESS_NEAR}>
        {lines
          .filter(l => l.layer === 'near')
          .map(l => (
            <path key={l.id} d={l.path} fill="none" stroke={LINE_COLOR} strokeWidth={LINE_WIDTH_NEAR} strokeLinecap="round" />
          ))}
      </g>
    </>
  );
}

export default DatavizLandscapeOpen;
