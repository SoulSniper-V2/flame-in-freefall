"use client"
import { useEffect, useRef, type CSSProperties } from 'react'
import { ditherImage, fillStyle, useDitherColors } from '@/lib/dither'
import { cn } from '@/lib/utils'

/** A scalar field (rows top→bottom) drawn as an ordered dither between paper and ink. */
export function DitherHeatmap({ values, cols, rows, ink = '--foreground', paper = '--surface', className, label }: {
  values: Float32Array | number[]; cols: number; rows: number; ink?: string; paper?: string; className?: string; label: string
}) {
  const box = useRef<HTMLDivElement>(null); const cv = useRef<HTMLCanvasElement>(null)
  const colors = useDitherColors(box, [paper, ink] as const)
  useEffect(() => {
    const el = box.current, c = cv.current; if (!el || !c || !colors) return
    const draw = () => {
      const cell = 3; const W = Math.max(8, Math.floor(el.clientWidth / cell)), H = Math.max(8, Math.floor(el.clientHeight / cell))
      c.width = W; c.height = H
      const ctx = c.getContext('2d')!; const img = ctx.createImageData(W, H)
      const [pp, ii] = colors
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        // bilinear sample of the grid
        const gx = (x / (W - 1)) * (cols - 1), gy = (y / (H - 1)) * (rows - 1)
        const x0 = Math.floor(gx), y0 = Math.floor(gy), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1), fx = gx - x0, fy = gy - y0
        const v = (values[y0 * cols + x0] * (1 - fx) + values[y0 * cols + x1] * fx) * (1 - fy) + (values[y1 * cols + x0] * (1 - fx) + values[y1 * cols + x1] * fx) * fy
        const t = 0.86 * Math.max(0, Math.min(1, v)); const k = (y * W + x) * 4
        img.data[k] = 255 * (pp[0] + (ii[0] - pp[0]) * t); img.data[k + 1] = 255 * (pp[1] + (ii[1] - pp[1]) * t); img.data[k + 2] = 255 * (pp[2] + (ii[2] - pp[2]) * t); img.data[k + 3] = 255
      }
      const out = ditherImage(img, { method: 'bayer8', palette: [[pp[0], pp[1], pp[2]], [ii[0], ii[1], ii[2]]] })
      ctx.putImageData(out, 0, 0)
    }
    draw(); const ro = new ResizeObserver(draw); ro.observe(el); return () => ro.disconnect()
  }, [values, cols, rows, colors])
  return <div ref={box} className={cn('relative', className)} role="img" aria-label={label}>
    <canvas ref={cv} className="absolute inset-0 h-full w-full" style={{ imageRendering: 'pixelated' }} />
  </div>
}

/** A dithered photograph (PSI thumbnail), Atkinson-diffused into two theme colours. */
export function DitherPhoto({ src, alt, className, ink = '--foreground', paper = '--surface', scale = 3 }: { src: string; alt: string; className?: string; ink?: string; paper?: string; scale?: number }) {
  const box = useRef<HTMLDivElement>(null); const cv = useRef<HTMLCanvasElement>(null)
  const colors = useDitherColors(box, [paper, ink] as const)
  useEffect(() => {
    const el = box.current, c = cv.current; if (!el || !c || !colors) return
    const im = new Image(); im.crossOrigin = 'anonymous'; im.src = src
    im.onload = () => {
      const W = Math.max(16, Math.floor(el.clientWidth / scale)), H = Math.max(16, Math.floor(el.clientHeight / scale))
      c.width = W; c.height = H; const ctx = c.getContext('2d', { willReadFrequently: true })!
      const r = Math.max(W / im.width, H / im.height); const w = im.width * r, h = im.height * r
      ctx.filter = 'grayscale(1) contrast(1.25)'; ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); ctx.filter = 'none'
      const [pp, ii] = colors; const src2 = ctx.getImageData(0, 0, W, H)
      // map luminance onto the paper→ink axis so the diffusion lands on theme colours
      for (let k = 0; k < src2.data.length; k += 4) { const t = 1 - src2.data[k] / 255; for (let ch = 0; ch < 3; ch++) src2.data[k + ch] = 255 * (pp[ch] + (ii[ch] - pp[ch]) * t) }
      ctx.putImageData(ditherImage(src2, { method: 'atkinson', palette: [[pp[0], pp[1], pp[2]], [ii[0], ii[1], ii[2]]] }), 0, 0)
    }
  }, [src, colors, scale])
  return <div ref={box} className={cn('relative overflow-hidden', className)} role="img" aria-label={alt}>
    <canvas ref={cv} className="absolute inset-0 h-full w-full" style={{ imageRendering: 'pixelated' }} />
  </div>
}

/** Score meter: a dithered fill whose density follows the value. */
export function Meter({ value, max = 100, tone = 'primary', className, label }: { value: number; max?: number; tone?: 'primary' | 'signal' | 'ink'; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100
  const color = tone === 'primary' ? '--primary' : tone === 'signal' ? '--signal' : '--foreground'
  return <div className={cn('relative h-2 w-full overflow-hidden rounded-[2px] bg-muted', className)} role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
    <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, ...(fillStyle('gradient', { color, edge: 'left', length: 18, from: 1, to: 0.35, cell: 2 }) as CSSProperties) }} />
  </div>
}
