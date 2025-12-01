"use client";

import { Combobox } from "@/components/ui/combobox";
import { DateRange, DateRangePicker } from "@/components/ui/dateRangePicker";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";
import { useForm, Controller, Control, DefaultValues } from "react-hook-form";
import { format } from "date-fns";

export interface FilterProps<T extends FilterFormValues> {
  initialFrom?: Date;
  initialTo?: Date;
  initialProduct?: string;
  renderExtraFields?: (control: Control<T>) => React.ReactNode;
  onExtraSubmit?: (data: T, params: URLSearchParams) => void;
  extraDefaultValues?: Partial<T>;
}

export interface FilterFormValues {
  range: DateRange;
  product: string;
}

export function Filter<T extends FilterFormValues = FilterFormValues>({
  initialFrom,
  initialTo,
  initialProduct,
  renderExtraFields,
  onExtraSubmit,
  extraDefaultValues,
}: FilterProps<T>) {
  const router = useRouter();
  const pathname = usePathname();

  const { control, handleSubmit } = useForm<T>({
    defaultValues: {
      range: { from: initialFrom, to: initialTo },
      product: initialProduct ?? "C:Formaldehyde",
      ...extraDefaultValues,
    } as DefaultValues<T>,
  });

  const onSubmit = (data: T) => {
    const params = new URLSearchParams();
    if (data.range?.from) {
      params.set("from", format(data.range.from, "yyyy-MM-dd"));
    }
    if (data.range?.to) {
      params.set("to", format(data.range.to, "yyyy-MM-dd"));
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
    <form className="p-2 border flex gap-4 items-center shrink-0 rounded-md flex-wrap">
      <Controller
        control={control as unknown as Control<FilterFormValues>}
        name="range"
        render={({ field }) => (
          <DateRangePicker
            value={field.value}
            onValueChange={field.onChange}
            datePickerClassName="max-w-[150px]"
          />
        )}
      />
      <Controller
        control={control as unknown as Control<FilterFormValues>}
        name="product"
        render={({ field }) => (
          <Combobox
            options={[
              { value: "C:Formaldehyde", label: "Formaldehyde" },
              { value: "Formaldehyde-37%", label: "Formaldehyde-37%" },
              { value: "Formaldehyde-40%", label: "Formaldehyde-40%" },
              { value: "Formaldehyde-41%", label: "Formaldehyde-41%" },
              { value: "Formaldehyde-43%", label: "Formaldehyde-43%" },
              { value: "Formaldehyde-36.5%", label: "Formaldehyde-36.5%" },
              { value: "Formaldehyde-37% in Drums", label: "FD-37% in Drums" },
            ]}
            placeholder="Select Product"
            value={field.value}
            onValueChange={field.onChange}
            allowDeselect={false}
          />
        )}
      />
      {renderExtraFields && renderExtraFields(control)}
      <Button onClick={handleSubmit(onSubmit)}>Go</Button>
    </form>
  );
}
