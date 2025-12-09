"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function MultiCombobox(props: {
  options: { value: string; label: string }[];
  placeholder?: string;
  emptyMessage?: string;
  searchMessage?: string;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  className?: string;
  dropdownClassName?: string;
}) {
  const {
    options,
    placeholder = "Select options...",
    emptyMessage = "No results.",
    searchMessage = "Search...",
    value: propValue,
    defaultValue = [],
    onValueChange,
    className,
    dropdownClassName,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] =
    React.useState<string[]>(defaultValue);

  const isControlled = props.value !== undefined;
  const value = isControlled ? (propValue as string[]) : internalValue;

  const handleSelect = (currentValue: string) => {
    const newValues = value.includes(currentValue)
      ? value.filter((v) => v !== currentValue)
      : [...value, currentValue];

    if (!isControlled) {
      setInternalValue(newValues);
    }
    onValueChange?.(newValues);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[200px] justify-between", className)}
        >
          <div className="truncate">
            {value.length > 0
              ? value
                  .map(
                    (val) =>
                      options.find((option) => option.value === val)?.label ||
                      val,
                  )
                  .join(", ")
              : placeholder}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[200px] p-0", dropdownClassName)}>
        <Command>
          <CommandInput placeholder={searchMessage} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  {option.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value.includes(option.value)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
