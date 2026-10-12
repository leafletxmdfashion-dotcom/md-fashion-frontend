"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";

import { Input } from "@/components/ui/input";

/**
 * Free-text input that offers matching suggestions while typing. Unlike a native
 * <datalist>, it draws no dropdown arrow in any browser and looks like a plain text field.
 */
export function SuggestInput({
  value,
  onChange,
  onBlur,
  suggestions,
  ...inputProps
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "list"> & {
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly string[];
}) {
  return (
    <Autocomplete.Root items={suggestions} value={value} onValueChange={(next) => onChange(next)}>
      <Autocomplete.Input render={<Input autoComplete="off" onBlur={onBlur} {...inputProps} />} />
      <Autocomplete.Portal>
        <Autocomplete.Positioner sideOffset={4} align="start" className="isolate z-50">
          <Autocomplete.Popup className="max-h-60 w-(--anchor-width) overflow-y-auto rounded-md bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none empty:hidden data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0">
            <Autocomplete.List>
              {(item: string) => (
                <Autocomplete.Item
                  key={item}
                  value={item}
                  className="flex cursor-default items-center rounded-sm px-2 py-1.5 outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  {item}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
