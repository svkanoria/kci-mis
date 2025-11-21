"use client";

import { DateRange, DateRangePicker } from "@/components/ui/dateRangePicker";
import { getEndOfPreviousFY, getStartOfPreviousFY } from "@/utils/date";
import { useState } from "react";

export function DRP() {
  const [range, setRange] = useState<DateRange | undefined>({
    from: getStartOfPreviousFY(),
    to: getEndOfPreviousFY(),
  });

  return (
    <DateRangePicker
      value={range}
      onChange={(range) => {
        setRange(range);
        console.log("Selected Date Range:", range);
      }}
    />
  );
}
