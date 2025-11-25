"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import * as chrono from "chrono-node";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return !isNaN(date.getTime());
}

/**
 * Props for the DatePicker component.
 *
 * @interface DatePickerProps
 *
 * @property {Date} [value] - The currently selected date. If provided, the
 * component operates in controlled mode.
 * @property {Date} [defaultValue] - The default date to be selected when the
 * component is first rendered. Used in uncontrolled mode.
 * @property {(date: Date | undefined) => void} [onChange] - Callback function
 * triggered when the selected date changes. Receives the new date or
 * `undefined` if the selection is cleared.
 * @property {string} [placeholder] - Placeholder text to display when no date
 * is selected.
 * @property {boolean} [disabled] - Whether the date picker is disabled and not
 * interactive.
 * @property {string} [className] - Additional CSS classes to apply to the
 * component container.
 */
interface DatePickerProps {
  value?: Date;
  defaultValue?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (props, ref) => {
    const {
      value: controlledValue,
      defaultValue,
      onChange,
      placeholder = "Select Date",
      disabled = false,
      className,
    } = props;

    const [open, setOpen] = React.useState(false);

    // Component is controlled if 'value' prop was provided
    const isControlled = "value" in props;

    // Internal state for uncontrolled mode
    const [internalDate, setInternalDate] = React.useState<Date | undefined>(
      defaultValue ?? undefined,
    );

    const date = isControlled ? controlledValue : internalDate;

    const [month, setMonth] = React.useState<Date | undefined>(date);
    const [inputValue, setInputValue] = React.useState(formatDate(date));
    const lastEmittedDate = React.useRef<Date | undefined>(date);

    // Sync input value when date changes (for controlled mode)
    React.useEffect(() => {
      if (isControlled) {
        const isSameAsEmitted =
          (controlledValue === undefined &&
            lastEmittedDate.current === undefined) ||
          controlledValue?.getTime() === lastEmittedDate.current?.getTime();

        if (isSameAsEmitted) {
          if (controlledValue) {
            setMonth(controlledValue);
          }
          return;
        }

        setInputValue(formatDate(controlledValue));
        if (controlledValue) {
          setMonth(controlledValue);
        }
        lastEmittedDate.current = controlledValue;
      }
    }, [controlledValue, isControlled]);

    const handleDateChange = (newDate: Date | undefined) => {
      lastEmittedDate.current = newDate;
      // Always call onChange if provided
      onChange?.(newDate);

      // In uncontrolled mode, also update internal state
      if (!isControlled) {
        setInternalDate(newDate);
      }
    };

    return (
      <div className={cn("relative flex gap-2", className)}>
        <Input
          ref={ref}
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          className="bg-background pr-10"
          onChange={(e) => {
            const newDate = chrono.parseDate(e.target.value) ?? undefined;
            setInputValue(e.target.value);
            if (isValidDate(newDate)) {
              handleDateChange(newDate);
              setMonth(newDate);
            }
          }}
          onBlur={(e) => {
            const newDate = chrono.parseDate(e.target.value) ?? undefined;
            // Reformat to 'canonicalize' input value on blur
            setInputValue(formatDate(newDate));
            if (!isValidDate(newDate)) {
              handleDateChange(undefined);
              setMonth(undefined);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !disabled) {
              e.preventDefault();
              setOpen(true);
            }
          }}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id="date-picker"
              variant="ghost"
              disabled={disabled}
              className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
            >
              <CalendarIcon className="size-3.5" />
              <span className="sr-only">Select date</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto overflow-hidden p-0"
            align="end"
            alignOffset={-8}
            sideOffset={10}
          >
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              month={month}
              onMonthChange={setMonth}
              onSelect={(newDate) => {
                handleDateChange(newDate);
                setInputValue(formatDate(newDate));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);

DatePicker.displayName = "DatePicker";
