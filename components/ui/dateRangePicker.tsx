"use client";

import * as React from "react";
import { DatePicker } from "@/components/ui/datePicker";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangePickerProps {
  value?: DateRange;
  defaultValue?: DateRange;
  onChange?: (dateRange: DateRange | undefined) => void;
  placeholderFrom?: string;
  placeholderTo?: string;
  disabled?: boolean;
  className?: string;
}

export const DateRangePicker = React.forwardRef<
  HTMLDivElement,
  DateRangePickerProps
>((props, ref) => {
  const {
    value: controlledValue,
    defaultValue,
    onChange,
    placeholderFrom = "Start Date",
    placeholderTo = "End Date",
    disabled = false,
    className = "",
  } = props;

  // Component is controlled if 'value' prop was provided
  const isControlled = "value" in props;

  // Internal state for uncontrolled mode
  const [internalDateRange, setInternalDateRange] = React.useState<
    DateRange | undefined
  >(
    defaultValue ?? {
      from: new Date("2000-01-01"),
      to: new Date("2000-01-31"),
    },
  );

  // Use controlled value if provided, otherwise use internal state
  const dateRange = isControlled ? controlledValue : internalDateRange;

  const handleDateRangeChange = (newDateRange: DateRange | undefined) => {
    // Always call onChange if provided
    onChange?.(newDateRange);

    // In uncontrolled mode, also update internal state
    if (!isControlled) {
      setInternalDateRange(newDateRange);
    }
  };

  const handleFromChange = (newFrom: Date | undefined) => {
    const newRange: DateRange = {
      from: newFrom,
      to: dateRange?.to,
    };
    handleDateRangeChange(newRange);
  };

  const handleToChange = (newTo: Date | undefined) => {
    const newRange: DateRange = {
      from: dateRange?.from,
      to: newTo,
    };
    handleDateRangeChange(newRange);
  };

  return (
    <div ref={ref} className={`flex gap-2 items-center ${className}`}>
      <DatePicker
        value={dateRange?.from}
        onChange={handleFromChange}
        placeholder={placeholderFrom}
        disabled={disabled}
      />
      <span className="text-muted-foreground">to</span>
      <DatePicker
        value={dateRange?.to}
        onChange={handleToChange}
        placeholder={placeholderTo}
        disabled={disabled}
      />
    </div>
  );
});

DateRangePicker.displayName = "DateRangePicker";
