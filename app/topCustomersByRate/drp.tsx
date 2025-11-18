"use client";

import { DatePicker } from "@/components/ui/datePicker";
import { DateRange, DateRangePicker } from "@/components/ui/dateRangePicker";
import { useState } from "react";

export function DRP() {
  const [date, setDate] = useState<Date | undefined>(new Date("2025-05-20"));

  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date("2025-04-01"),
    to: new Date("2025-04-30"),
  });

  return (
    <>
      <DatePicker
        value={date}
        onChange={(date) => {
          setDate(date);
          console.log("Selected date:", date);
        }}
      />
      <DateRangePicker
        value={range}
        onChange={(range) => {
          setRange(range);
          console.log("Selected Date Range:", range);
        }}
      />
    </>
  );
}
