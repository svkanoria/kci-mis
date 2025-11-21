"use client";

import { Combobox } from "@/components/ui/combobox";
import { DateRange, DateRangePicker } from "@/components/ui/dateRangePicker";
import { getEndOfPreviousFY, getStartOfPreviousFY } from "@/utils/date";
import { useState } from "react";

export function Filters() {
  const [range, setRange] = useState<DateRange | undefined>({
    from: getStartOfPreviousFY(),
    to: getEndOfPreviousFY(),
  });
  const [product, setProduct] = useState<string | undefined>(undefined);

  return (
    <div className="p-4 border mb-4 flex gap-4 items-center">
      <DateRangePicker
        value={range}
        onChange={(range) => {
          setRange(range);
          console.log("Selected Date Range:", range);
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
        onValueChange={(value) => {
          setProduct(value);
          console.log("Selected Product:", value);
        }}
        value={product}
        placeholder="Select Product"
      />
    </div>
  );
}
