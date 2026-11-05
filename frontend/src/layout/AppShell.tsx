import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ThemeToggle } from '../theme/ThemeToggle'
import { secondaryButtonClass } from '../ui/classes'

export function AppShell() {
  const { me, can, logout } = useAuth()
  const [open, setOpen] = useState(false)

  // Only show the sections this user may open.
  const items = [
    { to: '/', label: 'Dashboard', end: true, show: true },
    { to: '/products', label: 'Products', end: false, show: can('products:read') },
  ].filter((item) => item.show)

  const roleLabel = me ? me.role.charAt(0).toUpperCase() + me.role.slice(1) : ''

  return (
    <div className="min-h-dvh md:flex">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        id="sidebar"
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-text transition-transform',
          'md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="px-5 py-5 text-lg font-bold tracking-tight text-white">StockFlow</div>
        <nav aria-label="Main" className="flex-1 space-y-1 px-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                [
                  'block rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-white',
                  isActive ? 'bg-white/15 text-white' : 'hover:bg-white/10',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-xs opacity-80">Signed in as {roleLabel}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
          <button
            type="button"
            className={secondaryButtonClass + ' md:hidden'}
            aria-label="Open menu"
            aria-controls="sidebar"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
          <div className="flex-1" />
          <ThemeToggle />
          <button type="button" className={secondaryButtonClass} onClick={() => void logout()}>
            Sign out
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
