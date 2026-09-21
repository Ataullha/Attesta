'use client';

import { useEffect, useRef, useState } from 'react';
import { placeholdersIn, type Design, type DesignElement } from '@/lib/design';
import type { AssetStore } from './assets';
import { ensureFonts, renderPage, type RenderValues } from './renderer';
import { elementLabel } from './elements';

type Rect = { x: number; y: number; w: number; h: number };
type Targets = { v: number[]; h: number[] };
type Drag = { mode: 'move' | 'resize'; dir: string; id: string; sx: number; sy: number; orig: Rect; targets: Targets; moved: boolean };

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
const CURSOR: Record<string, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

const r1 = (v: number) => Math.round(v * 10) / 10;

function targetsFor(d: Design, exceptId: string): Targets {
  const v = [0, d.page.width / 2, d.page.width];
  const h = [0, d.page.height / 2, d.page.height];
  for (const e of d.elements) {
    if (e.id === exceptId) continue;
    v.push(e.x, e.x + e.w / 2, e.x + e.w);
    h.push(e.y, e.y + e.h / 2, e.y + e.h);
  }
  return { v, h };
}

function snap(points: number[], lines: number[], threshold: number) {
  let best: { delta: number; line: number } | null = null;
  for (const p of points)
    for (const l of lines) {
      const delta = l - p;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line: l };
    }
  return best;
}

export function Stage(props: {
  design: Design;
  values: RenderValues;
  assets: AssetStore;
  assetVersion: number;
  selectedId: string | null;
  showBoxes: boolean;
  onSelect: (id: string | null) => void;
  onChangeLive: (fn: (d: Design) => Design) => void;
  onCommit: () => void;
  onEditText: (id: string) => void;
}) {
  const { design, values, assets, assetVersion, selectedId, showBoxes } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const [box, setBox] = useState({ w: 900, h: 640 });
  const [guides, setGuides] = useState<Targets>({ v: [], h: [] });
  const W = design.page.width;
  const H = design.page.height;
  const zoom = Math.max(0.1, Math.min((box.w - 56) / W, (box.h - 56) / H, 2));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const raf = requestAnimationFrame(async () => {
      await ensureFonts(design);
      const c = canvasRef.current;
      if (!c || cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.max(1, Math.round(W * zoom * dpr));
      const ph = Math.max(1, Math.round(H * zoom * dpr));
      // Draw off-screen first so async image loads never show a half-drawn frame.
      const off = document.createElement('canvas');
      off.width = pw;
      off.height = ph;
      const ctx = off.getContext('2d')!;
      ctx.scale(zoom * dpr, zoom * dpr);
      await renderPage(ctx, design, values, assets, { preview: true });
      if (cancelled) return;
      c.width = pw;
      c.height = ph;
      c.getContext('2d')!.drawImage(off, 0, 0);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [design, values, assets, assetVersion, zoom, W, H]);

  function start(e: React.PointerEvent, el: DesignElement, mode: 'move' | 'resize', dir = '') {
    if (e.button !== 0) return;
    e.stopPropagation();
    props.onSelect(el.id);
    if (el.locked) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, dir, id: el.id, sx: e.clientX, sy: e.clientY, orig: { x: el.x, y: el.y, w: el.w, h: el.h }, targets: targetsFor(design, el.id), moved: false };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / zoom;
    const dy = (e.clientY - d.sy) / zoom;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 1.5 / zoom) return;
    d.moved = true;
    const el = design.elements.find((x) => x.id === d.id);
    if (!el) return;
    const th = 6 / zoom;
    let { x, y, w, h } = d.orig;
    const gv: number[] = [];
    const gh: number[] = [];

    if (d.mode === 'move') {
      x += dx;
      y += dy;
      if (!e.altKey) {
        const sx = snap([x, x + w / 2, x + w], d.targets.v, th);
        if (sx) { x += sx.delta; gv.push(sx.line); }
        const sy = snap([y, y + h / 2, y + h], d.targets.h, th);
        if (sy) { y += sy.delta; gh.push(sy.line); }
      }
    } else {
      const dir = d.dir;
      const min = 6;
      if (dir.includes('e')) w = Math.max(min, d.orig.w + dx);
      if (dir.includes('s')) h = Math.max(min, d.orig.h + dy);
      if (dir.includes('w')) { w = Math.max(min, d.orig.w - dx); x = d.orig.x + d.orig.w - w; }
      if (dir.includes('n')) { h = Math.max(min, d.orig.h - dy); y = d.orig.y + d.orig.h - h; }
      const keepRatio = (e.shiftKey || el.type === 'qr' || el.type === 'seal') && dir.length === 2;
      if (keepRatio) {
        const ratio = d.orig.w / d.orig.h;
        if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
        if (dir.includes('w')) x = d.orig.x + d.orig.w - w;
        if (dir.includes('n')) y = d.orig.y + d.orig.h - h;
      } else if (!e.altKey) {
        if (dir.includes('e')) { const s = snap([x + w], d.targets.v, th); if (s) { w += s.delta; gv.push(s.line); } }
        if (dir.includes('w')) { const s = snap([x], d.targets.v, th); if (s) { x += s.delta; w -= s.delta; gv.push(s.line); } }
        if (dir.includes('s')) { const s = snap([y + h], d.targets.h, th); if (s) { h += s.delta; gh.push(s.line); } }
        if (dir.includes('n')) { const s = snap([y], d.targets.h, th); if (s) { y += s.delta; h -= s.delta; gh.push(s.line); } }
      }
    }
    props.onChangeLive((des) => ({
      ...des,
      elements: des.elements.map((it) => (it.id === d.id ? { ...it, x: r1(x), y: r1(y), w: r1(w), h: r1(h) } : it)),
    }));
    setGuides({ v: gv, h: gh });
  }

  function end() {
    if (!drag.current) return;
    const moved = drag.current.moved;
    drag.current = null;
    setGuides({ v: [], h: [] });
    if (moved) props.onCommit();
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#EAE5DA]" onPointerDown={() => props.onSelect(null)}>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_18px_44px_-20px_rgba(25,23,18,0.35)]" style={{ width: W * zoom, height: H * zoom }}>
        <canvas ref={canvasRef} className="absolute inset-0 block" style={{ width: W * zoom, height: H * zoom }} aria-label="Certificate preview" role="img" />
        <div className="absolute inset-0" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          {design.elements.map((el) => {
            const selected = el.id === selectedId;
            const keys = el.type === 'text' ? placeholdersIn(el.content) : [];
            const showDashed = showBoxes && !selected && (keys.length > 0 || el.type === 'qr' || el.type === 'barcode' || el.type === 'image');
            return (
              <div
                key={el.id}
                className={`absolute touch-none ${el.locked ? 'cursor-default' : 'cursor-move'} ${selected ? 'outline outline-[1.5px] outline-brass' : showDashed ? 'outline outline-1 outline-dashed outline-brass/60 hover:outline-brass' : 'hover:outline hover:outline-1 hover:outline-brass/50'}`}
                style={{ left: el.x * zoom, top: el.y * zoom, width: Math.max(el.w * zoom, 4), height: Math.max(el.h * zoom, 4) }}
                onPointerDown={(e) => start(e, el, 'move')}
                onDoubleClick={() => el.type === 'text' && props.onEditText(el.id)}
                title={elementLabel(el)}
              >
                {showDashed && keys.length > 0 && (
                  <span className="pointer-events-none absolute -top-[18px] left-0 whitespace-nowrap rounded-[2px] bg-brass px-1.5 py-[1px] font-mono text-[10px] leading-[14px] text-card">
                    {keys.map((k) => `{${k}}`).join(' ')}
                  </span>
                )}
                {selected && !el.locked &&
                  HANDLES.map((dir) => (
                    <span
                      key={dir}
                      onPointerDown={(e) => start(e, el, 'resize', dir)}
                      className="absolute h-[11px] w-[11px] rounded-[2px] border border-brass bg-card"
                      style={{
                        cursor: CURSOR[dir],
                        left: dir.includes('w') ? -6 : dir.includes('e') ? 'calc(100% - 5px)' : 'calc(50% - 5.5px)',
                        top: dir.includes('n') ? -6 : dir.includes('s') ? 'calc(100% - 5px)' : 'calc(50% - 5.5px)',
                      }}
                    />
                  ))}
              </div>
            );
          })}
          {guides.v.map((x, i) => (
            <div key={`v${i}`} className="pointer-events-none absolute top-0 h-full w-px bg-[#D2386C]" style={{ left: x * zoom }} />
          ))}
          {guides.h.map((y, i) => (
            <div key={`h${i}`} className="pointer-events-none absolute left-0 h-px w-full bg-[#D2386C]" style={{ top: y * zoom }} />
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-4 text-[12.5px] text-muted">
        {Math.round(zoom * 100)}% · drag to move · Shift keeps proportions · Alt turns off snapping
      </div>
    </div>
  );
}
