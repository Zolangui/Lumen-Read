import clsx from 'clsx'
import React, { useState, useMemo } from 'react'

import { BookRecord, CoverRecord } from '../db'
import { useLibraryState } from '../state'

import { BookCard } from './BookCard'
import { NewHeader } from './NewHeader'
import { DropZone } from './base'

interface LibraryViewProps {
  books: BookRecord[]
  covers: CoverRecord[]
  onAddBook: () => void
  onBookClick: (book: BookRecord) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  covers,
  onAddBook,
  onBookClick,
  onDrop,
}) => {
  const [{ viewMode, filter }, setLibraryState] = useLibraryState()
  const [searchQuery, setSearchQuery] = useState('')

  const setViewMode = (mode: 'grid' | 'list') =>
    setLibraryState((prev) => ({ ...prev, viewMode: mode }))

  const setFilter = (f: 'All' | 'Unread' | 'In Progress' | 'Finished') =>
    setLibraryState((prev) => ({ ...prev, filter: f }))

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesSearch =
        (book.metadata?.title || book.name)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (book.metadata?.creator || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      const percentage = book.percentage || 0
      if (filter === 'Unread') return percentage === 0
      if (filter === 'In Progress') return percentage > 0 && percentage < 1
      if (filter === 'Finished') return percentage === 1

      return true
    })
  }, [books, searchQuery, filter])

  return (
    <DropZone
      className="bg-background-light dark:bg-background-dark flex h-full w-full flex-col"
      onDrop={onDrop}
    >
      <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 md:p-8">
        <NewHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAddBook={onAddBook}
        />

        <div className="mb-6 flex flex-col items-start gap-4 md:flex-row md:items-center">
          <label className="flex h-10 w-full flex-col md:max-w-md">
            <div className="flex h-full w-full flex-1 items-stretch rounded-lg">
              <div className="text-subtle-light dark:text-subtle-dark bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark flex items-center justify-center rounded-l-lg border border-r-0 pl-3">
                <span className="material-symbols-outlined text-xl">
                  search
                </span>
              </div>
              <input
                className="form-input text-text-light dark:text-text-dark focus:ring-primary/50 border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark placeholder:text-subtle-light dark:placeholder:text-subtle-dark flex h-full w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg border border-l-0 px-4 text-base font-normal leading-normal focus:outline-0 focus:ring-2"
                placeholder="Search by title or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </label>
          <div className="flex flex-wrap gap-2">
            {['All', 'Unread', 'In Progress', 'Finished'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={clsx(
                  'flex h-9 shrink-0 items-center justify-center gap-x-2 whitespace-nowrap rounded-full px-4 transition-colors',
                  filter === f
                    ? 'bg-primary/20 dark:bg-primary/30 text-primary'
                    : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark border hover:bg-black/5 dark:hover:bg-white/5',
                )}
              >
                <p className="text-sm font-medium leading-normal">{f}</p>
              </button>
            ))}
            <button className="bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full border pl-4 pr-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <p className="text-sm font-medium leading-normal">Sort By</p>
              <span className="material-symbols-outlined text-lg">
                expand_more
              </span>
            </button>
          </div>
        </div>

        <div
          className={clsx(
            viewMode === 'grid'
              ? 'grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-4 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]'
              : 'flex flex-col gap-4',
          )}
        >
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              cover={covers.find((c) => c.id === book.id)?.cover}
              viewMode={viewMode}
              onClick={() => onBookClick(book)}
            />
          ))}
        </div>
      </div>
    </DropZone>
  )
}
