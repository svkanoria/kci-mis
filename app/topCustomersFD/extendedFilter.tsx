"use client";

import {
  Filter,
  FilterFormValues,
  FilterProps,
} from "@/app/_components/filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Controller } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

interface ExtendedFilterFormValues extends FilterFormValues {
  grouping: string;
  channels: string;
}

export function ExtendedFilter({
  initialGrouping,
  initialChannels,
  ...props
}: FilterProps<ExtendedFilterFormValues> & {
  initialGrouping?: string;
  initialChannels?: string;
}) {
  return (
    <Filter<ExtendedFilterFormValues>
      {...props}
      extraDefaultValues={{
        grouping: initialGrouping ?? "",
        channels: initialChannels ?? "",
      }}
      onExtraSubmit={(data, params) => {
        if (data.grouping !== "") {
          params.set("grouping", data.grouping);
        }
        if (data.channels !== "") {
          params.set("channels", data.channels);
        }
      }}
      renderExtraFields={(control) => (
        <>
          <Controller
            control={control}
            name="grouping"
            render={({ field }) => {
              const selectedValues = field.value
                ? field.value.split(",").filter((v) => v !== "" && v !== "none")
                : [];
              const options = [
                { value: "recipient", label: "+ Recipient" },
                { value: "distChannel", label: "+ Dist. Channel" },
                { value: "plant", label: "+ Plant" },
              ];

              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-[170px] justify-between font-normal"
                    >
                      {selectedValues.length > 0
                        ? `${selectedValues.length} selected`
                        : "Select Grouping"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[170px] p-0">
                    <Command>
                      <CommandList>
                        <CommandGroup>
                          {options.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.value}
                              onSelect={() => {
                                const isSelected = selectedValues.includes(
                                  option.value,
                                );
                                const newValues = isSelected
                                  ? selectedValues.filter(
                                      (v) => v !== option.value,
                                    )
                                  : [...selectedValues, option.value];
                                field.onChange(newValues.join(","));
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedValues.includes(option.value)
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {option.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              );
            }}
          />
          <Controller
            control={control}
            name="channels"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Select Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="dealer-known">Dealer Known</SelectItem>
                  <SelectItem value="dealer-unknown">Dealer Unknown</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </>
      )}
      productFilter={({ value }) =>
        value.includes("Formaldehyde") || value.includes("FD")
      }
    />
  );
}
