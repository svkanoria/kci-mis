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
import { MultiCombobox } from "@/components/ui/multiCombobox";

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
                { value: "recipient", label: "Recipient" },
                { value: "distChannel", label: "Dist. Channel" },
                { value: "plant", label: "Plant" },
              ];

              return (
                <MultiCombobox
                  options={options}
                  value={selectedValues}
                  onValueChange={(newValues) =>
                    field.onChange(newValues.join(","))
                  }
                  className="w-[170px]"
                  dropdownClassName="w-[170px]"
                  placeholder="No Grouping"
                  renderValue={(selected) => {
                    if (selected.length > 1) {
                      return (
                        <span className="truncate">
                          {`${selected.length} Selected`}
                        </span>
                      );
                    }
                  }}
                />
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
