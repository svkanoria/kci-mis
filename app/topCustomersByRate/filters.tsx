"use client";

import { Combobox } from "@/components/ui/combobox";
import { DateRange, DateRangePicker } from "@/components/ui/dateRangePicker";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";

interface FiltersProps {
  initialRange?: DateRange;
  initialProduct?: string;
}

export function Filters({ initialRange, initialProduct }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [range, setRange] = useState<DateRange | undefined>(initialRange);
  const [product, setProduct] = useState<string | undefined>(initialProduct);

  const handleGo = () => {
    const params = new URLSearchParams();
    if (range?.from) {
      params.set("from", format(range.from, "yyyy-MM-dd"));
    }
    if (range?.to) {
      params.set("to", format(range.to, "yyyy-MM-dd"));
    }
    if (product) {
      params.set("product", product);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="p-4 border mb-4 flex gap-4 items-center">
      <DateRangePicker
        value={range}
        onChange={(range) => {
          setRange(range);
        }}
      />
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
        value={product}
        onChange={(value) => {
          setProduct(value);
        }}
      />
      <Button onClick={handleGo}>Go</Button>
    </div>
  );
}
