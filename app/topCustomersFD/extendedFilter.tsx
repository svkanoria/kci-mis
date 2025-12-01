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
  customerLevel: string;
}

export function ExtendedFilter({
  initialCustomerLevel,
  ...props
}: FilterProps<ExtendedFilterFormValues> & {
  initialCustomerLevel?: string;
}) {
  return (
    <Filter<ExtendedFilterFormValues>
      {...props}
      extraDefaultValues={{
        customerLevel: initialCustomerLevel ?? "",
      }}
      onExtraSubmit={(data, params) => {
        if (data.customerLevel !== "") {
          params.set("customerLevel", data.customerLevel);
        }
      }}
      renderExtraFields={(control) => (
        <Controller
          control={control}
          name="customerLevel"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Select Customer Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consignee">Consignee</SelectItem>
                <SelectItem value="trader-agent">Trader/Agent</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      )}
    />
  );
}
