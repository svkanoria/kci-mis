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

export function Combobox(props: {
  options: { value: string; label: string }[];
  placeholder?: string;
  emptyMessage?: string;
  searchMessage?: string;
  value?: string;
  onValueChange?: (value: string | undefined) => void;
  className?: string;
  dropdownClassName?: string;
  allowDeselect?: boolean;
}) {
  const {
    options,
    placeholder = "Select an option...",
    emptyMessage = "No results.",
    searchMessage = "Search...",
    value: propValue,
    onValueChange,
    className,
    dropdownClassName,
    allowDeselect = true,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState<string | undefined>(
    undefined,
  );

  const isControlled = "value" in props;
  const value = isControlled ? propValue : internalValue;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[200px] justify-between", className)}
        >
          {value
            ? (options.find((option) => option.value === value)?.label ??
              "Bad value")
            : placeholder}
          <ChevronsUpDown className="opacity-50" />
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
                  onSelect={(currentValue) => {
                    // If currently selected value is clicked, deselect it.
                    // Note that to deselect it, we set the value to "", and not
                    // to undefined. Setting to undefined leads to problems with
                    // react-hook-form's default value handling.
                    const newValue =
                      currentValue === value && allowDeselect
                        ? ""
                        : currentValue;
                    if (!isControlled) {
                      setInternalValue(newValue);
                    }
                    onValueChange?.(newValue);
                    setOpen(false);
                  }}
                >
                  {option.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === option.value ? "opacity-100" : "opacity-0",
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
