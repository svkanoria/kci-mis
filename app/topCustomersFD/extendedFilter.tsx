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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Controller } from "react-hook-form";

interface ExtendedFilterFormValues extends FilterFormValues {
  grouping: string;
  noDirect: boolean;
}

export function ExtendedFilter({
  initialGrouping,
  initialNoDirect,
  ...props
}: FilterProps<ExtendedFilterFormValues> & {
  initialGrouping?: string;
  initialNoDirect?: boolean;
}) {
  return (
    <Filter<ExtendedFilterFormValues>
      {...props}
      extraDefaultValues={{
        grouping: initialGrouping ?? "",
        noDirect: initialNoDirect ?? false,
      }}
      onExtraSubmit={(data, params) => {
        if (data.grouping !== "") {
          params.set("grouping", data.grouping);
        }
        if (data.noDirect) {
          params.set("noDirect", "true");
        }
      }}
      renderExtraFields={(control) => (
        <>
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
          <Controller
            control={control}
            name="noDirect"
            render={({ field }) => (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="noDirect"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Label htmlFor="noDirect">Indirect only</Label>
              </div>
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
