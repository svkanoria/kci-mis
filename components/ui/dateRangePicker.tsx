"use client";

import * as React from "react";
import { DatePicker } from "@/components/ui/datePicker";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import {
  getStartOfPreviousFY,
  getEndOfPreviousFY,
  getStartOfPreviousQuarter,
  getEndOfPreviousQuarter,
  getStartOfPreviousMonth,
  getEndOfPreviousMonth,
} from "@/lib/utils/date";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangePickerProps {
  value?: DateRange;
  defaultValue?: DateRange;
  onValueChange?: (dateRange: DateRange | undefined) => void;
  placeholderFrom?: string;
  placeholderTo?: string;
  disabled?: boolean;
  className?: string;
  datePickerClassName?: string;
}

export const DateRangePicker = React.forwardRef<
  HTMLDivElement,
  DateRangePickerProps
>((props, ref) => {
  const {
    value: controlledValue,
    defaultValue,
    onValueChange,
    placeholderFrom = "Start Date",
    placeholderTo = "End Date",
    disabled = false,
    className,
    datePickerClassName,
  } = props;

  // Component is controlled if 'value' prop was provided
  const isControlled = "value" in props;

  // Internal state for uncontrolled mode
  const [internalDateRange, setInternalDateRange] = React.useState<
    DateRange | undefined
  >(
    defaultValue ?? {
      from: undefined,
      to: undefined,
    },
  );

  const [open, setOpen] = React.useState(false);

  // Use controlled value if provided, otherwise use internal state
  const dateRange = isControlled ? controlledValue : internalDateRange;

  const handleDateRangeChange = (newDateRange: DateRange | undefined) => {
    // Always call onChange if provided
    onValueChange?.(newDateRange);

    // In uncontrolled mode, also update internal state
    if (!isControlled) {
      setInternalDateRange(newDateRange);
    }
  };

  const handlePresetSelect = (getRange: () => DateRange) => {
    const newRange = getRange();
    handleDateRangeChange(newRange);
    setOpen(false);
  };

  const presets = [
    {
      label: "Last Financial Year",
      getRange: () => ({
        from: getStartOfPreviousFY(),
        to: getEndOfPreviousFY(),
      }),
    },
    {
      label: "Last Quarter",
      getRange: () => ({
        from: getStartOfPreviousQuarter(),
        to: getEndOfPreviousQuarter(),
      }),
    },
    {
      label: "Last 1 Month",
      getRange: () => ({
        from: getStartOfPreviousMonth(),
        to: getEndOfPreviousMonth(),
      }),
    },
    {
      label: "Last 2 Months",
      getRange: () => ({
        from: getStartOfPreviousMonth(2),
        to: getEndOfPreviousMonth(),
      }),
    },
    {
      label: "Last 3 Months",
      getRange: () => ({
        from: getStartOfPreviousMonth(3),
        to: getEndOfPreviousMonth(),
      }),
    },
    {
      label: "Last 4 Months",
      getRange: () => ({
        from: getStartOfPreviousMonth(4),
        to: getEndOfPreviousMonth(),
      }),
    },
    {
      label: "Last 5 Months",
      getRange: () => ({
        from: getStartOfPreviousMonth(5),
        to: getEndOfPreviousMonth(),
      }),
    },
    {
      label: "Last 6 Months",
      getRange: () => ({
        from: getStartOfPreviousMonth(6),
        to: getEndOfPreviousMonth(),
      }),
    },
  ];

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
        onValueChange={handleFromChange}
        placeholder={placeholderFrom}
        disabled={disabled}
        className={datePickerClassName}
      />
      <span className="text-muted-foreground">to</span>
      <DatePicker
        value={dateRange?.to}
        onValueChange={handleToChange}
        placeholder={placeholderTo}
        disabled={disabled}
        className={datePickerClassName}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" disabled={disabled}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
          <div className="grid gap-1">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                className="justify-start font-normal"
                onClick={() => handlePresetSelect(preset.getRange)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

DateRangePicker.displayName = "DateRangePicker";
