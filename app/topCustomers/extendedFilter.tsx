"use client";

import {
  Filter,
  FilterFormValues,
  FilterProps,
} from "@/app/_components/filter";
import { Combobox } from "@/components/ui/combobox";
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
            <Combobox
              options={[
                { value: "month", label: "Month" },
                { value: "quarter", label: "Quarter" },
                { value: "year", label: "Year" },
              ]}
              placeholder="Select Period"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      )}
    />
  );
}
