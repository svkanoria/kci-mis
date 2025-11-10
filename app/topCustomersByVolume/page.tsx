import { Heading } from "@/components/typography/heading";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/datePicker";
import { getTopCustomersByVolume } from "@/dataApi";

export default async function Page() {
  const data = await getTopCustomersByVolume("Formaldehyde-37%", 100);

  return (
    <div className="p-4">
      <Heading level="h1">Top Customers</Heading>
      <div className="p-4 border mb-4">
        <DatePicker />
        <Combobox
          options={[
            { value: "Formaldehyde", label: "Formaldehyde" },
            { value: "Formaldehyde-37%", label: "Formaldehyde-37%" },
            { value: "Formaldehyde-40%", label: "Formaldehyde-40%" },
            { value: "Formaldehyde-41%", label: "Formaldehyde-41%" },
            { value: "Formaldehyde-43%", label: "Formaldehyde-43%" },
            { value: "Formaldehyde-36.5%", label: "Formaldehyde-36.5%" },
          ]}
        />
      </div>
      <ul>
        {data.map((row) => (
          <li key={row.recipientName}>
            {row.recipientName}: {row.qty}
          </li>
        ))}
      </ul>
    </div>
  );
}
