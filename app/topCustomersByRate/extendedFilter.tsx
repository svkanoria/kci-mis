"use client";

import {
  Filter,
  FilterFormValues,
  FilterProps,
} from "@/app/_components/filter";
import { Combobox } from "@/components/ui/combobox";
import { Controller } from "react-hook-form";

interface ExtendedFilterFormValues extends FilterFormValues {
  interval: string;
}

export function ExtendedFilter({
  initialInterval,
  ...props
}: FilterProps<ExtendedFilterFormValues> & {
  initialInterval?: string;
}) {
  return (
    <Filter<ExtendedFilterFormValues>
      {...props}
      extraDefaultValues={{ interval: initialInterval ?? "total" }}
      onExtraSubmit={(data, params) => {
        if (data.interval) {
          params.set("interval", data.interval);
        }
      }}
      renderExtraFields={(control) => (
        <Controller
          control={control}
          name="interval"
          render={({ field }) => (
            <Combobox
              options={[
                { value: "total", label: "Total" },
                { value: "year", label: "Year" },
                { value: "quarter", label: "Quarter" },
                { value: "month", label: "Month" },
              ]}
              placeholder="Select Interval"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      )}
    />
  );
}
