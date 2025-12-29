"use client";

import {
  Filter,
  FilterFormValues,
  FilterProps,
} from "@/app/_components/filter";

export function ExtendedFilter(props: FilterProps<FilterFormValues>) {
  return (
    <Filter
      {...props}
      hideRange
      hidePeriod
      productFilter={({ value }) =>
        value.includes("Formaldehyde") || value.includes("FD")
      }
    />
  );
}
