"use client";

import {
  Filter,
  FilterFormValues,
  FilterProps,
} from "@/app/_components/filter";
import { Input } from "@/components/ui/input";
import { Controller } from "react-hook-form";

interface ExtendedFilterFormValues extends FilterFormValues {
  qtyThreshold: string;
}

export function ExtendedFilter({
  initialQtyThreshold,
  ...props
}: FilterProps<ExtendedFilterFormValues> & {
  initialQtyThreshold?: number;
}) {
  return (
    <Filter<ExtendedFilterFormValues>
      {...props}
      extraDefaultValues={{
        qtyThreshold: initialQtyThreshold?.toString() ?? "",
      }}
      onExtraSubmit={(data, params) => {
        if (data.qtyThreshold !== "") {
          params.set("qtyThreshold", data.qtyThreshold);
        }
      }}
      renderExtraFields={(control) => (
        <Controller
          control={control}
          name="qtyThreshold"
          render={({ field }) => (
            <Input
              className="max-w-50"
              type="number"
              placeholder="Qty Threshold (MT)"
              {...field}
            />
          )}
        />
      )}
    />
  );
}
