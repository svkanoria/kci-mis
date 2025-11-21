import { Heading } from "@/components/typography/heading";
import { Combobox } from "@/components/ui/combobox";
import { getTopCustomersByVolume } from "@/dataApi";

export default async function Page() {
  const data = await getTopCustomersByVolume(
    { product: "Formaldehyde-37%" },
    1000,
  );

  return (
    <div className="p-4">
      <Heading level="h1">Top Customers By Volume</Heading>
      <div className="p-4 border mb-4">
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
      <table>
        <tbody>
          {data.map((row) => (
            <tr key={row.consigneeName}>
              <td>{row.consigneeName}</td>
              <td>{row.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>{data.length} results</div>
    </div>
  );
}
