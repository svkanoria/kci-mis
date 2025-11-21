"use client";

import { Combobox } from "@/components/ui/combobox";
import { DateRange, DateRangePicker } from "@/components/ui/dateRangePicker";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";

interface FiltersProps {
  initialRange?: DateRange;
  initialProduct?: string;
}

interface FilterFormValues {
  range: DateRange | undefined;
  product: string | undefined;
}

export function Filters({ initialRange, initialProduct }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { control, handleSubmit } = useForm<FilterFormValues>({
    defaultValues: {
      range: initialRange,
      product: initialProduct,
    },
  });

  const onSubmit = (data: FilterFormValues) => {
    const params = new URLSearchParams();
    if (data.range?.from) {
      params.set("from", format(data.range.from, "yyyy-MM-dd"));
    }
    if (data.range?.to) {
      params.set("to", format(data.range.to, "yyyy-MM-dd"));
    }
    if (data.product) {
      params.set("product", data.product);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <form className="p-4 border mb-4 flex gap-4 items-center">
      <Controller
        control={control}
        name="range"
        render={({ field }) => (
          <DateRangePicker value={field.value} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="product"
        render={({ field }) => (
          <Combobox
            options={[
              { value: "Formaldehyde", label: "Formaldehyde" },
              { value: "Formaldehyde-37%", label: "Formaldehyde-37%" },
              { value: "Formaldehyde-40%", label: "Formaldehyde-40%" },
              { value: "Formaldehyde-41%", label: "Formaldehyde-41%" },
              { value: "Formaldehyde-43%", label: "Formaldehyde-43%" },
              { value: "Formaldehyde-36.5%", label: "Formaldehyde-36.5%" },
            ]}
            placeholder="Select Product"
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Button onClick={handleSubmit(onSubmit)}>Go</Button>
    </form>
  );
}
