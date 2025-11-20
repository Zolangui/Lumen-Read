import React from 'react'

interface NewReaderLayoutProps {
  header: React.ReactNode
  footer: React.ReactNode
  children: React.ReactNode
}

export const NewReaderLayout: React.FC<NewReaderLayoutProps> = ({
  header,
  footer,
  children,
}) => {
  return (
    <div className="bg-background-light dark:bg-background-dark flex h-screen flex-1 flex-col">
      <div className="flex h-full flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          {header}
          <div className="relative flex-1 overflow-hidden">{children}</div>
          {footer}
        </div>
      </div>
    </div>
  )
}
