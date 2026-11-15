import { useRef } from 'react'
import { AsciiGrid, autoLevels, mapTones, sampleToField, useMediaElement } from '@/lib/ascii'
import type { AsciiGridDrawContext, CharsetName, ToneField } from '@/lib/ascii'
import { cn } from '@/lib/utils'

/** A real NASA photograph rendered as ASCII (asciicn image recipe), drawn once. */
export function AsciiPhoto({ src, alt, charset = 'standard', cell = 9, contrast = 1.25, className }: { src: string; alt: string; charset?: CharsetName; cell?: number; contrast?: number; className?: string }) {
  const { element } = useMediaElement(src)
  const fieldRef = useRef<ToneField | undefined>(undefined)
  const draw = ({ frame, columns, rows, metrics }: AsciiGridDrawContext) => {
    if (!element) return
    const field = sampleToField(element, { aspect: (columns * metrics.width) / (rows * metrics.height), charset, columns, fit: 'contain', into: fieldRef.current, rows })
    fieldRef.current = field
    autoLevels(field)
    mapTones(field, columns, rows, { charset, colorMode: 'truecolor', grade: { contrast } }, frame)
  }
  return <AsciiGrid draw={draw} cell={cell} colored animate={false} paper="transparent" role="img" aria-hidden={false} aria-label={alt} className={cn('block', className)} />
}
