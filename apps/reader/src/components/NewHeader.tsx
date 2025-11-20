import clsx from 'clsx'
import React from 'react'

interface NewHeaderProps {
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onAddBook: () => void
}

export const NewHeader: React.FC<NewHeaderProps> = ({
  viewMode,
  onViewModeChange,
  onAddBook,
}) => {
  return (
    <header className="border-border-light dark:border-border-dark mb-6 flex flex-col items-start justify-between gap-4 border-b border-solid pb-6 sm:flex-row sm:items-center">
      <div className="flex items-center gap-8">
        <div className="text-text-light dark:text-text-dark flex items-center gap-3">
          <div className="size-8 text-primary">
            <svg
              fill="none"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
            >
              <path
                d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z"
                fill="currentColor"
              ></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold leading-tight tracking-tighter">
            My Library
          </h2>
        </div>
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <button
          onClick={onAddBook}
          className="bg-primary flex h-10 min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg px-4 text-sm font-bold leading-normal tracking-wide text-white transition-opacity hover:opacity-90"
        >
          <span className="truncate">Add New Book</span>
        </button>
        <div className="bg-background-light dark:bg-surface-dark border-border-light dark:border-border-dark flex items-center rounded-lg border">
          <button
            onClick={() => onViewModeChange('grid')}
            className={clsx(
              'flex h-10 min-w-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-l-lg px-3 text-sm font-bold leading-normal transition-colors',
              viewMode === 'grid'
                ? 'bg-primary/20 dark:bg-primary/30 text-primary'
                : 'text-subtle-light dark:text-subtle-dark bg-transparent hover:bg-black/5 dark:hover:bg-white/5',
            )}
          >
            <span className="material-symbols-outlined text-xl">grid_view</span>
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={clsx(
              'flex h-10 min-w-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-r-lg px-3 text-sm font-bold leading-normal transition-colors',
              viewMode === 'list'
                ? 'bg-primary/20 dark:bg-primary/30 text-primary'
                : 'text-subtle-light dark:text-subtle-dark bg-transparent hover:bg-black/5 dark:hover:bg-white/5',
            )}
          >
            <span className="material-symbols-outlined text-xl">list</span>
          </button>
        </div>
      </div>
    </header>
  )
}
