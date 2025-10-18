import { useEffect } from 'react';
import type { GlobeMethods } from 'react-globe.gl';

type Opts = {
  min?: number;
  max?: number;
  base?: number;
  deltaUnit?: number;
  dragUnit?: number;
  tau?: number;
  eps?: number;
  startAlt?: number;
};

export function useGlobeZoom(
  ref: React.RefObject<GlobeMethods | undefined>,
  imgUrl: string | null,
  opts: Opts = {}
): void {
  useEffect(() => {
    const g = ref.current;
    if (!g || !imgUrl) return;

    const r = g.renderer?.();
    const dom = r?.domElement;
    if (!dom) return;

    const ALT_MIN = opts.min ?? 0.01;
    const ALT_MAX = opts.max ?? 3.0;
    const ZOOM_BASE = opts.base ?? 1.9;
    const DELTA_UNIT = opts.deltaUnit ?? 100;
    const DRAG_UNIT = opts.dragUnit ?? 120;
    const TAU = opts.tau ?? 0.12;
    const EPS = opts.eps ?? 0.0015;
    const START = opts.startAlt ?? 1.6;

    const targetAlt = { v: START };
    let raf = 0;
    let last = 0;

    const step = (tNow: number) => {
      const povNow = (g as any).pointOfView();
      const cur = typeof povNow?.altitude === 'number' ? povNow.altitude : START;
      const dt = Math.min(0.05, (tNow - last) / 1000 || 0.016);
      last = tNow;
      const alpha = 1 - Math.exp(-dt / TAU);
      const nxt = cur + (targetAlt.v - cur) * alpha;
      (g as any).pointOfView({ ...povNow, altitude: nxt }, 0);
      if (Math.abs(targetAlt.v - nxt) > EPS) raf = requestAnimationFrame(step);
      else raf = 0;
    };

    const kick = (next: number) => {
      targetAlt.v = Math.min(ALT_MAX, Math.max(ALT_MIN, next));
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const unit = e.deltaMode === 1 ? 35 : 1;
      const delta = e.deltaY * unit;
      const repeats = Math.max(1, Math.round(Math.abs(delta) / DELTA_UNIT));
      const factor = Math.pow(ZOOM_BASE, repeats);
      const pov = (g as any).pointOfView();
      const cur = typeof pov?.altitude === 'number' ? pov.altitude : START;
      kick(delta < 0 ? cur / factor : cur * factor);
    };

    let dragging = false;
    let startY = 0;
    let startAlt = START;

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dragging = true;
      startY = e.clientY;
      const pov = (g as any).pointOfView();
      startAlt = typeof pov?.altitude === 'number' ? pov.altitude : START;
      dom.addEventListener('mousemove', onMouseMove, { passive: false, capture: true });
      window.addEventListener('mouseup', onMouseUp, { passive: true, capture: true });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const dy = e.clientY - startY;
      const f = Math.pow(ZOOM_BASE, Math.abs(dy) / DRAG_UNIT);
      kick(dy < 0 ? startAlt / f : startAlt * f);
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      dom.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', onMouseUp, true);
    };

    dom.addEventListener('wheel', onWheel, { passive: false, capture: true });
    dom.addEventListener('contextmenu', onContextMenu);
    dom.addEventListener('mousedown', onMouseDown, { passive: false, capture: true });

    return () => {
      dom.removeEventListener('wheel', onWheel, true);
      dom.removeEventListener('contextmenu', onContextMenu);
      dom.removeEventListener('mousedown', onMouseDown, true);
      dom.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', onMouseUp, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    ref,
    imgUrl,
    opts.min,
    opts.max,
    opts.base,
    opts.deltaUnit,
    opts.dragUnit,
    opts.tau,
    opts.eps,
    opts.startAlt
  ]);
}
