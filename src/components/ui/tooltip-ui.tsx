'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TooltipUIProps {
  children: React.ReactNode
  content: React.ReactNode
  className?: string
}

export function TooltipUI({ children, content, className }: TooltipUIProps) {
  const [isVisible, setIsVisible] = React.useState(false)

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-3 py-2 text-sm bg-popover text-popover-foreground rounded-md shadow-md border',
            'bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap',
            className
          )}
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-popover" />
          </div>
        </div>
      )}
    </div>
  )
}
