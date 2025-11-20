import { useState, useEffect, useMemo } from 'react'
import Highlighter from 'react-highlight-words'

import { useAction, useList, useTranslation } from '@flow/reader/hooks'
import { IMatch, useReaderSnapshot, reader } from '@flow/reader/models'
import { flatTree } from '@flow/reader/models/tree'

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
    <div className="bg-surface-light dark:bg-surface-dark flex h-full flex-col">
      <div className="border-border-light dark:border-border-dark flex items-center gap-3 border-b p-6">
        <span className="material-symbols-outlined text-primary text-2xl">
          search
        </span>
        <h2 className="text-text-light dark:text-text-dark text-xl font-bold">
          Search
        </h2>
      </div>

      <div className="p-6 pb-0">
        <label className="flex h-10 w-full flex-col">
          <div className="flex h-full w-full flex-1 items-stretch rounded-lg">
            <div className="text-subtle-light dark:text-subtle-dark bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark flex items-center justify-center rounded-l-lg border border-r-0 pl-3">
              <span className="material-symbols-outlined text-xl">search</span>
            </div>
            <input
              className="form-input text-text-light dark:text-text-dark focus:ring-primary/50 border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark placeholder:text-subtle-light dark:placeholder:text-subtle-dark flex h-full w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg border border-l-0 px-4 text-base font-normal leading-normal focus:outline-0 focus:ring-2"
              placeholder={t('search.title')}
              value={keyword}
              autoFocus={action === 'search'}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
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
const ResultList: React.FC<ResultListProps> = ({ results, keyword }) => {
  const rows = useMemo(() => {
    if (!results) return []
    const expandedState = Object.fromEntries(
      results.map((r) => [r.id, r.expanded ?? false]),
    )
    return results.flatMap((r) => flatTree(r, 0, expandedState))
  }, [results])
  const { outerRef, innerRef, items } = useList(rows)

  return (
    <div className="space-y-4">
      <div ref={outerRef} className="h-full">
        <div ref={innerRef}>
          {items.map(({ index }) => (
            <ResultRow
              key={rows[index]?.id ?? index}
              result={rows[index]}
              keyword={keyword}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface ResultRowProps {
  result?: IMatch
  keyword: string
}
const ResultRow: React.FC<ResultRowProps> = ({ result, keyword }) => {
  if (!result) return null
  const { cfi, depth, id } = result
  let { excerpt, description } = result
  const tab = reader.focusedBookTab
  const isResult = depth === 1

  excerpt = excerpt.trim()
  description = description?.trim()

  if (!isResult) {
    return (
      <div className="text-text-light dark:text-text-dark px-1 py-2 text-sm font-bold">
        {excerpt}
      </div>
    )
  }

  return (
    <div
      onClick={() => {
        if (tab) {
          tab.activeResultID = id
          tab.display(cfi)
        }
      }}
      className="border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark hover:border-primary/50 mb-4 cursor-pointer rounded-lg border p-4 transition-colors"
    >
      <p className="text-text-light dark:text-text-dark line-clamp-3 text-sm">
        <Highlighter
          highlightClassName="bg-primary/30 px-1 rounded text-text-light dark:text-text-dark"
          searchWords={[keyword]}
          textToHighlight={excerpt}
          autoEscape
        />
      </p>
      {description && (
        <p className="text-subtle-light dark:text-subtle-dark mt-2 text-xs">
          {description}
        </p>
      )}
    </div>
  )
}
