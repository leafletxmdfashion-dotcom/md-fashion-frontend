"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"
import { ChevronDownIcon, CheckIcon } from "lucide-react"

const Select = SelectPrimitive.Root

/**
 * Field-trigger look shared by every dropdown-style control (Select, item picker, comboboxes),
 * so they all match Input: same height, radius, border, focus ring and invalid state.
 */
const selectTriggerClassName =
  "flex h-9 min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-card py-2 pr-2.5 pl-3 text-left text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground pointer-coarse:h-10 dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/** Popup surface shared by Select, Popover pickers and menus. */
const selectPopupClassName =
  "relative isolate z-50 max-h-[min(var(--available-height),20rem)] min-w-(--anchor-width) w-max max-w-[min(28rem,var(--available-width))] origin-(--transform-origin) overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("block min-w-0 flex-1 truncate text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        selectTriggerClassName,
        "w-fit data-[size=sm]:h-8",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<ChevronDownIcon className="size-4 text-muted-foreground" />}
      />
    </SelectPrimitive.Trigger>
  )
}

/**
 * Opens below the trigger (flipping above near the bottom of the screen), never over it:
 * the overlay mode clipped long rows and showed scroll arrows on top of the scrollbar.
 */
function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={false}
        collisionPadding={8}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(selectPopupClassName, className)}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

/**
 * One option. `description` is a muted second part (code, role, hint) shown only in the list;
 * the trigger shows the label from the Select's `items`.
 */
function SelectItem({
  className,
  children,
  description,
  ...props
}: SelectPrimitive.Item.Props & { description?: React.ReactNode }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none pointer-coarse:py-2.5 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <SelectPrimitive.ItemText className="truncate">
          {children}
        </SelectPrimitive.ItemText>
        {description ? (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  selectPopupClassName,
  selectTriggerClassName,
}
