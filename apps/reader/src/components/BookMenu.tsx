import { Overlay } from '@literal-ui/core'
import clsx from 'clsx'
import React, { useRef, useState } from 'react'
import FocusLock from 'react-focus-lock'
import {
  MdDelete,
  MdDownload,
  MdMoreHoriz,
  MdStar,
  MdStarBorder,
  MdVisibility,
} from 'react-icons/md'

import { useMobile } from '../hooks'

interface BookMenuProps {
  isFavorite?: boolean
  onToggleFavorite: () => void
  onDownload: () => void
  onRemove: () => void
  onViewDetails: () => void
  className?: string
}

export const BookMenu: React.FC<BookMenuProps> = ({
  isFavorite,
  onToggleFavorite,
  onDownload,
  onRemove,
  onViewDetails,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const mobile = useMobile()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const close = () => setIsOpen(false)

  return (
    <div className={clsx('relative', className)}>
      <button
        ref={buttonRef}
        onClick={toggle}
        className={clsx(
          'flex h-full w-full items-center justify-center rounded-md transition-colors focus:outline-none',
          isOpen && 'bg-black/80',
        )}
      >
        <MdMoreHoriz className="text-2xl drop-shadow-md" />
      </button>

      {isOpen && (
        <FocusLock disabled={mobile} returnFocus>
          <Overlay
            className="!z-40 !bg-transparent"
            onMouseDown={(e) => {
              e.stopPropagation()
              close()
            }}
          />
          <div
            className="bg-surface-light dark:bg-surface-dark shadow-2 absolute right-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-xl py-1 ring-1 ring-black/5 focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem
              icon={isFavorite ? MdStar : MdStarBorder}
              label={isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
              onClick={() => {
                onToggleFavorite()
                close()
              }}
              className={isFavorite ? 'text-yellow-500' : ''}
              iconClassName={isFavorite ? 'text-yellow-500 opacity-100' : ''}
            />
            <MenuItem
              icon={MdVisibility}
              label="View Details"
              onClick={() => {
                onViewDetails()
                close()
              }}
            />
            <MenuItem
              icon={MdDownload}
              label="Download"
              onClick={() => {
                onDownload()
                close()
              }}
            />
            <div className="border-border-light dark:border-border-dark my-1 border-t" />
            <MenuItem
              icon={MdDelete}
              label="Remove from Library"
              onClick={() => {
                onRemove()
                close()
              }}
              className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              iconClassName="text-red-600 dark:text-red-400 opacity-100"
            />
          </div>
        </FocusLock>
      )}
    </div>
  )
}

interface MenuItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  className?: string
  iconClassName?: string
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon: Icon,
  label,
  onClick,
  className,
  iconClassName,
}) => (
  <button
    onClick={onClick}
    className={clsx(
      'text-text-light dark:text-text-dark flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5',
      className,
    )}
  >
    <Icon className={clsx('text-lg opacity-70', iconClassName)} />
    <span className="font-medium">{label}</span>
  </button>
)
