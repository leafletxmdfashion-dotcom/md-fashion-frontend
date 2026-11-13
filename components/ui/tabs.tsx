"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import * as React from "react"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("grid min-w-0 gap-4", className)} {...props} />
}

/** Box of one tab label; shared by the real tabs and their copy inside the indicator so both line up. */
const tabItemClassName =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-medium whitespace-nowrap pointer-coarse:h-10 [&_svg]:size-4 [&_svg]:shrink-0"

/** Same timing for the indicator and the labels inside it, so they move as one. */
const slide = "duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"

/**
 * One bordered strip of tabs with a filled indicator that slides to the active tab.
 *
 * The indicator is a window: it holds a copy of every label in the active colour, shifted back
 * by exactly the indicator's own offset, so the copy stays still while the window slides. Text
 * therefore turns light exactly where the filled background is, with no colour jump.
 * Scrolls sideways on narrow screens with the scrollbar hidden.
 */
function TabsList({ className, children, ...props }: TabsPrimitive.List.Props) {
  const labels = React.Children.toArray(children)
    .filter(React.isValidElement<{ children?: React.ReactNode; className?: string }>)
    .map((child, index) => (
      <span key={child.key ?? index} data-active="" className={cn(tabItemClassName, child.props.className)}>
        {child.props.children}
      </span>
    ))

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative isolate flex w-fit max-w-full items-center gap-0.5 overflow-x-auto overflow-y-hidden rounded-xl border bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator
        data-slot="tabs-indicator"
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 left-0 z-10 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) overflow-hidden rounded-lg bg-primary shadow-sm transition-[translate,width,height] dark:bg-foreground",
          slide
        )}
      >
        <span
          className={cn(
            "absolute top-0 left-0 flex w-max -translate-x-(--active-tab-left) -translate-y-(--active-tab-top) items-center gap-0.5 p-1 text-primary-foreground transition-[translate] dark:text-background",
            slide
          )}
        >
          {labels}
        </span>
      </TabsPrimitive.Indicator>
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        tabItemClassName,
        "cursor-pointer text-muted-foreground transition-colors outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="tabs-content" className={cn("min-w-0 outline-none", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
