import clsx from 'clsx'
import { useState, useEffect, useMemo } from 'react'
import Highlighter from 'react-highlight-words'

import { useAction, useList, useTranslation } from '@flow/reader/hooks'
import { IMatch, useReaderSnapshot, reader } from '@flow/reader/models'

import { PaneViewProps } from '../base'

// When inputting with IME and storing state in `valtio`,
// unexpected rendering with `e.target.value === ''` occurs,
// which leads to `<input>` and IME flash to empty,
// while this will not happen when using `React.useState`,
// so we should create an intermediate `keyword` state to fix this.
function useIntermediateKeyword() {
  const [keyword, setKeyword] = useState('')
  const { focusedBookTab } = useReaderSnapshot()

  useEffect(() => {
    setKeyword(focusedBookTab?.keyword ?? '')
  }, [focusedBookTab?.keyword])

  useEffect(() => {
    reader.focusedBookTab?.setKeyword(keyword)
  }, [keyword])

  return [keyword, setKeyword] as const
}

export const SearchView: React.FC<PaneViewProps> = (_props) => {
  const [action] = useAction()
  const { focusedBookTab } = useReaderSnapshot()
  const t = useTranslation()

  const [keyword, setKeyword] = useIntermediateKeyword()

  const results = focusedBookTab?.results

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex h-16 shrink-0 items-center border-b border-gray-200 px-4 dark:border-gray-700">
        <span className="material-symbols-outlined mr-2 text-xl text-gray-600 dark:text-gray-400">
          search
        </span>
        <h2 className="font-semibold text-gray-800 dark:text-white">Search</h2>
      </div>

      <div className="p-4 pb-0">
        <label className="relative mb-4 block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            search
          </span>
          <input
            className="focus:ring-primary focus:border-primary w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:ring-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
            placeholder={t('search.title')}
            value={keyword}
            autoFocus={action === 'search'}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {keyword && results && (
          <ResultList results={results as IMatch[]} keyword={keyword} />
        )}
      </div>
    </div>
  )
}

interface ResultListProps {
  results: IMatch[]
  keyword: string
}

interface ResultRowItem {
  id: string
  type: 'chapter' | 'match'
  item: IMatch
  chapterId?: string // For matches, to know which chapter they belong to
  firstMatch?: IMatch // For chapters, to show the preview
  matchCount?: number // For chapters, to show count
  expanded?: boolean // For chapters
}

const ResultList: React.FC<ResultListProps> = ({ results, keyword }) => {
  const rows = useMemo(() => {
    if (!results) return []
    const output: ResultRowItem[] = []

    for (const chapter of results) {
      const subitems = chapter.subitems || []
      const expanded = chapter.expanded ?? false

      // Add Chapter Row (Parent)
      // We attach the first match to the chapter row for the preview
      output.push({
        id: chapter.id,
        type: 'chapter',
        item: chapter,
        firstMatch: subitems[0],
        matchCount: subitems.length,
        expanded,
      })

      // If expanded, add the REST of the matches (skipping the first one which is shown in preview)
      // OR: Should we show ALL matches below when expanded?
      // The design shows "Expand results". If we expand, we probably want to see the full list.
      // If we keep the first match in the header, we should skip it here to avoid duplication.
      // However, if the user clicks the header to navigate, it goes to the chapter?
      // Usually search results go to the match.
      // Let's skip the first match in the expanded list to avoid visual duplication.
      if (expanded) {
        const remainingMatches = subitems.slice(1)
        remainingMatches.forEach((match) => {
          output.push({
            id: match.id || match.cfi || '',
            type: 'match',
            item: match,
            chapterId: chapter.id,
          })
        })
      }
    }
    return output
  }, [results])

  const { outerRef, innerRef, items } = useList(rows)

  return (
    <div className="h-full" ref={outerRef}>
      <div className="space-y-3 text-sm" ref={innerRef}>
        {items.map(({ index }) => {
          const row = rows[index]
          if (!row) return null
          return <ResultRow key={row.id} row={row} keyword={keyword} />
        })}
      </div>
    </div>
  )
}

interface ResultRowProps {
  row: ResultRowItem
  keyword: string
}

// Helper to ensure keyword is visible in the snippet
const getSmartSnippet = (text: string, keyword: string) => {
  if (!text || !keyword) return text
  const index = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (index === -1) return text

  // If keyword is near the start (within first 60 chars), return as is
  if (index < 60) return text

  // Otherwise, cut the beginning to center/start around the keyword
  // We keep ~40 chars context before the keyword
  return '...' + text.slice(index - 40)
}

const ResultRow: React.FC<ResultRowProps> = ({ row, keyword }) => {
  const { type, item, firstMatch, expanded, matchCount } = row
  const tab = reader.focusedBookTab
  const t = useTranslation()

  const handleNavigate = (cfi: string) => {
    if (tab) {
      tab.display(cfi)
    }
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (tab && row.type === 'chapter') {
      tab.toggleResult(row.id)
    }
  }

  if (type === 'chapter') {
    const hasMoreMatches = (matchCount || 0) > 1
    const snippet = firstMatch
      ? getSmartSnippet(firstMatch.excerpt, keyword)
      : ''

    return (
      <div>
        <h3 className="mb-1 font-bold text-gray-900 dark:text-white">
          {item.excerpt || t('search.untitled') || 'Untitled Section'}
        </h3>

        {/* Preview Match (First Match) */}
        {firstMatch && (
          <div
            className="mt-1 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => handleNavigate(firstMatch.cfi!)}
          >
            <p className="line-clamp-3 border-primary/30 ml-1 border-l-2 py-0.5 pl-3 text-xs leading-snug text-gray-500 dark:text-gray-400">
              <Highlighter
                highlightClassName="text-primary bg-transparent font-bold"
                searchWords={[keyword]}
                textToHighlight={snippet.trim()}
                autoEscape
              />
            </p>
          </div>
        )}

        {/* Expand Button */}
        {hasMoreMatches && (
          <button
            onClick={handleToggle}
            className="text-primary hover:bg-primary/10 mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
          >
            {expanded ? 'Recolher resultados' : 'Expandir resultados'}
            <span
              className={clsx(
                'material-symbols-outlined text-base transition-transform',
                expanded ? 'rotate-180' : '',
              )}
            >
              expand_more
            </span>
          </button>
        )}
      </div>
    )
  }

  // Match Row (Subsequent matches)
  const snippet = getSmartSnippet(item.excerpt, keyword)

  return (
    <div className="mt-1">
      <div
        className="cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() => handleNavigate(item.cfi!)}
      >
        <p className="line-clamp-3 border-primary/30 ml-1 border-l-2 py-0.5 pl-3 text-xs leading-snug text-gray-500 dark:text-gray-400">
          <Highlighter
            highlightClassName="text-primary bg-transparent font-bold"
            searchWords={[keyword]}
            textToHighlight={snippet.trim()}
            autoEscape
          />
        </p>
      </div>
    </div>
  )
}
