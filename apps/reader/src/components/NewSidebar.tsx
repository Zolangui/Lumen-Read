import clsx from 'clsx'
import React from 'react'

interface NewSidebarProps {
  className?: string
}

export const NewSidebar: React.FC<NewSidebarProps> = ({ className }) => {
  return (
    <aside
      className={clsx(
        'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark flex flex-col items-center justify-between border-r p-2 sm:p-4',
        className,
      )}
    >
      <nav className="flex flex-col items-center gap-2">
        <NavItem icon="menu" />
        <NavItem icon="search" />
        <NavItem icon="bookmark" />
        <NavItem icon="image" active />
        <NavItem icon="draw" />
        <NavItem icon="text_fields" />
        <NavItem icon="wb_sunny" />
        <NavItem icon="graphic_eq" />
        <NavItem icon="my_location" />
      </nav>
      <div className="flex flex-col items-center">
        <button className="text-subtle-light dark:text-subtle-dark flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <span className="material-symbols-outlined text-2xl">settings</span>
        </button>
      </div>
    </aside>
  )
}

interface NavItemProps {
  icon: string
  active?: boolean
  href?: string
}

const NavItem: React.FC<NavItemProps> = ({ icon, active, href = '#' }) => {
  return (
    <a
      href={href}
      className={clsx(
        'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
        active
          ? 'bg-primary/20 text-primary dark:bg-primary/30'
          : 'text-subtle-light dark:text-subtle-dark hover:bg-black/5 dark:hover:bg-white/5',
      )}
    >
      <span className="material-symbols-outlined text-2xl">{icon}</span>
    </a>
  )
}
