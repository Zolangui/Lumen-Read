import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import React, { useState, useMemo } from 'react'

import { db } from '@flow/reader/db'
import { useAction, useLibrary } from '@flow/reader/hooks'
import { reader, useReaderSnapshot } from '@flow/reader/models'

import { PaneViewProps } from '../base'

export const LibrarySideView: React.FC<PaneViewProps> = () => {
  const [, setAction] = useAction()
  const books = useLibrary()
  const covers = useLiveQuery(() => db?.covers.toArray() ?? [])
  const { focusedBookTab, groups } = useReaderSnapshot()
  const [searchQuery, setSearchQuery] = useState('')

  // Determine which books are currently open in any tab
  const openBookIds = useMemo(() => {
    const ids = new Set<string>()
    groups.forEach((group) => {
      group.tabs.forEach((tab) => {
        if (tab.isBook) {
          ids.add(tab.id) // BookTab id is the book id
        }
      })
    })
    return ids
  }, [groups])

  const filteredBooks = useMemo(() => {
    if (!books) return []
    return books.filter((book) => {
      return (
        (book.metadata?.title || book.name)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (book.metadata?.creator || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
    })
  }, [books, searchQuery])

  // Placeholder for missing covers
  const placeholder = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="gray" fill-opacity="0.1" width="1" height="1"/></svg>`

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center">
          <button
            onClick={() => setAction(undefined)}
            className="rounded p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <span className="material-symbols-outlined text-xl">
              library_books
            </span>
          </button>
          <div className="ml-2 flex flex-col">
            <h2 className="font-semibold text-gray-800 dark:text-white">
              Books
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Open a book in a new tab
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 pb-0">
        <label className="relative mb-4 block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            search
          </span>
          <input
            className="focus:ring-primary focus:border-primary w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:ring-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
            placeholder="Search books..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
      </div>

      {/* Book List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          {filteredBooks.map((book) => {
            const cover = covers?.find((c) => c.id === book.id)?.cover
            const isActive = focusedBookTab?.id === book.id
            const isOpen = openBookIds.has(book.id)

            return (
              <div
                key={book.id}
                onClick={() => reader.addTab(book)}
                className={clsx(
                  'flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors',
                  isActive
                    ? 'bg-primary/10'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800',
                )}
              >
                {/* Cover Thumbnail */}
                <div className="h-12 w-8 shrink-0 overflow-hidden rounded shadow-sm">
                  <img
                    src={cover || placeholder}
                    alt={book.metadata?.title}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <h3
                    className={clsx(
                      'truncate text-sm font-medium',
                      isActive
                        ? 'text-primary'
                        : 'text-gray-900 dark:text-white',
                    )}
                  >
                    {book.metadata?.title || book.name}
                  </h3>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {book.metadata?.creator || 'Unknown Author'}
                  </p>
                </div>

                {/* Indicators */}
                {isOpen && (
                  <div
                    className="bg-primary h-2 w-2 shrink-0 rounded-full"
                    title="Open in tab"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
