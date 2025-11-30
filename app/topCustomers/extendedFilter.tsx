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
  period: string;
}

export function ExtendedFilter({
  initialPeriod,
  ...props
}: FilterProps<ExtendedFilterFormValues> & {
  initialPeriod?: string;
}) {
  return (
    <Filter<ExtendedFilterFormValues>
      {...props}
      extraDefaultValues={{
        period: initialPeriod ?? "month",
      }}
      onExtraSubmit={(data, params) => {
        if (data.period !== "") {
          params.set("period", data.period);
        }
      }}
      renderExtraFields={(control) => (
        <Controller
          control={control}
          name="period"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="quarter">Quarterly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      )}
    />
  );
}
