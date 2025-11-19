"use client";

import { DateRange, DateRangePicker } from "@/components/ui/dateRangePicker";
import { useState } from "react";

export function DRP() {
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date("2025-04-01"),
    to: new Date("2025-04-30"),
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
