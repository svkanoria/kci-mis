"use client";

import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DateRange,
  DateRangePicker,
  DateRangePreset,
} from "@/components/ui/dateRangePicker";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";
import { useForm, Controller, Control, DefaultValues } from "react-hook-form";
import {
  formatDate,
  getStartOfFY,
  getEndOfFY,
  getStartOfPreviousFY,
} from "@/lib/utils/date";
import { useEffect, useState } from "react";

export interface FilterProps<T extends FilterFormValues> {
  initialFrom?: Date;
  initialTo?: Date;
  initialPeriod?: string;
  initialProduct?: string;
  renderExtraFields?: (control: Control<T>) => React.ReactNode;
  onExtraSubmit?: (data: T, params: URLSearchParams) => void;
  extraDefaultValues?: Partial<T>;
  productFilter?: (option: { value: string; label: string }) => boolean;
  hideRange?: boolean;
  hidePeriod?: boolean;
  hideProduct?: boolean;
}

export interface FilterFormValues {
  range: DateRange;
  period: string;
  product: string;
}

export function Filter<T extends FilterFormValues = FilterFormValues>({
  initialFrom,
  initialTo,
  initialPeriod,
  initialProduct,
  renderExtraFields,
  onExtraSubmit,
  extraDefaultValues,
  productFilter,
  hideRange,
  hidePeriod,
  hideProduct,
}: FilterProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const [presets, setPresets] = useState<DateRangePreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);

  useEffect(() => {
    const fetchDateRange = async () => {
      try {
        const response = await fetch("/api/sales-date-range");
        const data = await response.json();

        if (data.minDate && data.maxDate) {
          const minDate = new Date(data.minDate);
          const maxDate = new Date(data.maxDate);

          const firstFYStart = getStartOfFY(minDate);
          const newPresets: DateRangePreset[] = [];

          let n = 0;
          while (true) {
            const fyStart = getStartOfPreviousFY(n, maxDate);
            if (fyStart < firstFYStart) break;

            const fyEnd = getEndOfFY(fyStart);
            const year = fyStart.getFullYear();

            newPresets.push({
              label: `FY ${year}-${(year + 1).toString().slice(-2)}`,
              getRange: () => ({ from: fyStart, to: fyEnd }),
            });
            n++;
          }
          setPresets(newPresets);
        }
      } catch (error) {
        console.error("Failed to fetch date range for presets", error);
      } finally {
        setIsLoadingPresets(false);
      }
    };

    fetchDateRange();
  }, []);

  const { control, handleSubmit } = useForm<T>({
    defaultValues: {
      range: { from: initialFrom, to: initialTo },
      period: initialPeriod ?? "",
      product: initialProduct ?? "",
      ...extraDefaultValues,
    } as DefaultValues<T>,
  });

  const onSubmit = (data: T) => {
    const params = new URLSearchParams();
    if (data.range?.from) {
      params.set("from", formatDate(data.range.from));
    }
    if (data.range?.to) {
      params.set("to", formatDate(data.range.to));
    }
    if (data.period !== "") {
      params.set("period", data.period);
    }
    if (data.product !== "") {
      params.set("product", data.product);
    }
    if (onExtraSubmit) {
      onExtraSubmit(data, params);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <form className="p-2 border flex gap-4 items-center shrink-0 rounded-md flex-wrap bg-neutral-200">
      {!hideRange && (
        <Controller
          control={control as unknown as Control<FilterFormValues>}
          name="range"
          render={({ field }) => (
            <DateRangePicker
              value={field.value}
              onValueChange={field.onChange}
              datePickerClassName="max-w-[150px]"
              presets={presets}
              isLoadingPresets={isLoadingPresets}
            />
          )}
        />
      )}
      {!hidePeriod && (
        <Controller
          control={control as unknown as Control<FilterFormValues>}
          name="period"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="quarter">Quarterly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      )}
      {!hideProduct && (
        <Controller
          control={control as unknown as Control<FilterFormValues>}
          name="product"
          render={({ field }) => {
            const options = [
              { value: "C:Formaldehyde", label: "Formaldehyde (All)" },
              { value: "Formaldehyde-37%", label: "Formaldehyde-37%" },
              { value: "Formaldehyde-40%", label: "Formaldehyde-40%" },
              { value: "Formaldehyde-41%", label: "Formaldehyde-41%" },
              { value: "Formaldehyde-43%", label: "Formaldehyde-43%" },
              { value: "Formaldehyde-36.5%", label: "Formaldehyde-36.5%" },
              { value: "Formaldehyde-37% in Drums", label: "FD-37% in Drums" },
              { value: "C:Hexamine", label: "Hexamine" },
              { value: "C:Penta", label: "Penta (All)" },
              { value: "Penta-TG", label: "Penta-TG" },
              { value: "Penta-NG", label: "Penta-NG" },
              { value: "DiPenta", label: "DiPenta" },
            ];
            const filteredOptions = productFilter
              ? options.filter(productFilter)
              : options;

            return (
              <Combobox
                options={filteredOptions}
                placeholder="Select Product"
                value={field.value}
                onValueChange={field.onChange}
                allowDeselect={false}
              />
            );
          }}
        />
      )}
      {renderExtraFields && renderExtraFields(control)}
      <Button className="min-w-[70px]" onClick={handleSubmit(onSubmit)}>
        Go
      </Button>
    </form>
  );
}
