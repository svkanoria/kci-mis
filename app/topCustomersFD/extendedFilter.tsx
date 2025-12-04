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

interface ExtendedFilterFormValues extends FilterFormValues {
  grouping: string;
}

export function ExtendedFilter({
  initialGrouping,
  ...props
}: FilterProps<ExtendedFilterFormValues> & {
  initialGrouping?: string;
}) {
  return (
    <Filter<ExtendedFilterFormValues>
      {...props}
      extraDefaultValues={{
        grouping: initialGrouping ?? "",
      }}
      onExtraSubmit={(data, params) => {
        if (data.grouping !== "") {
          params.set("grouping", data.grouping);
        }
      }}
      renderExtraFields={(control) => (
        <Controller
          control={control}
          name="grouping"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Select Grouping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Grouping</SelectItem>
                <SelectItem value="recipient">+ Recipient</SelectItem>
                <SelectItem value="distChannel">+ Dist. Channel</SelectItem>
                <SelectItem value="plant">+ Plant</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      )}
      productFilter={({ value }) =>
        value.includes("Formaldehyde") || value.includes("FD")
      }
    />
  );
}
