import { Heading } from "@/components/typography/heading";
import { DatePicker } from "@/components/ui/datePicker";
import { getTopCustomersByVolume } from "@/lib/api";

export default async function Page() {
  const data = await getTopCustomersByVolume("Formaldehyde-37%", 100);

  return (
    <div className="p-4">
      <Heading level="h1">Top Customers</Heading>
      <div className="p-4 border mb-4">
        <DatePicker />
      </div>
      <ul>
        {data.map((row) => (
          <li key={row.recipientName}>
            {row.recipientName}: {row.totalQty}
          </li>
        ))}
      </ul>
    </div>
  );
}
