import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Moon, Sun, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  ['/', 'Dashboard'], ['/brief/lunar-base', 'Habitat brief'], ['/margin', 'Margin'], ['/lab', 'Model lab'], ['/atlas', 'Atlas'], ['/ask', 'Ask'], ['/investigations', 'Investigations'], ['/method', 'Method'],
] as const

function useTheme() {
  const [dark, setDark] = useState(() => typeof window !== 'undefined' && (localStorage.getItem('fif-theme') === 'dark' || (!localStorage.getItem('fif-theme') && matchMedia('(prefers-color-scheme: dark)').matches)))
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('fif-theme', dark ? 'dark' : 'light') }, [dark])
  return [dark, setDark] as const
}

export function Shell({ children }: { children: ReactNode }) {
  const [dark, setDark] = useTheme(); const [open, setOpen] = useState(false); const loc = useLocation()
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])
  return <div className="min-h-dvh">
    <header className="site sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
      <div className="wrap flex h-14 items-center gap-6">
        <Link to="/" className="text-[15px] font-semibold tracking-[-0.01em]">Flame in Freefall</Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn('rounded px-3 py-1.5 text-[13.5px] transition-colors hover:text-foreground', isActive || (to.startsWith('/brief') && loc.pathname.startsWith('/brief')) ? 'text-foreground' : 'text-muted-foreground')}>{label}</NavLink>)}
        </nav>
        <button onClick={() => setDark(!dark)} className="ml-auto grid h-8 w-8 place-items-center rounded border transition-colors hover:border-foreground md:ml-2" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
        <button onClick={() => setOpen(!open)} className="grid h-8 w-8 place-items-center rounded border md:hidden" aria-label="Menu" aria-expanded={open}>{open ? <X size={16} /> : <Menu size={16} />}</button>
      </div>
      {open && <nav className="wrap flex flex-col border-t py-3 md:hidden">{NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className="py-2.5 text-lg">{label}</NavLink>)}</nav>}
    </header>
    <main>{children}</main>
    <footer className="site mt-24 border-t">
      <div className="wrap grid gap-6 py-10 text-[13px] text-muted-foreground md:grid-cols-[1fr_auto]">
        <div className="max-w-2xl">
          <div className="mb-2 font-semibold text-foreground">Flame in Freefall</div>
          NASA Space Apps 2026 · Team Tee to Three. Data: NASA PSI (CC0). Not affiliated with NASA. For research triage, not certification.
        </div>
        <div className="flex gap-5 md:justify-end"><a className="link" href="https://psi.nasa.gov/physci/repo/search?q=combustion" target="_blank" rel="noreferrer">PSI database</a><a className="link" href="https://github.com/SoulSniper-V2/flame-in-freefall" target="_blank" rel="noreferrer">Source code</a><Link className="link" to="/method">Method</Link></div>
      </div>
    </footer>
  </div>
}

export function PageHead({ eyebrow, title, children, aside }: { eyebrow: string; title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return <section className="border-b"><div className="wrap grid gap-6 py-8 md:grid-cols-[1fr_auto] md:items-end md:py-10">
    <div className="max-w-3xl" data-section={eyebrow}><h1 className="display text-[32px] md:text-[40px]">{title}</h1>{children && <div className="mt-3 max-w-2xl text-[15px] text-muted-foreground">{children}</div>}</div>
    {aside}
  </div></section>
}

export function Loading({ what = 'NASA PSI data' }: { what?: string }) {
  return <div className="wrap py-24"><div className="eyebrow">Loading {what}</div></div>
}
