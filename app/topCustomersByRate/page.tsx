import { Heading } from "@/components/typography/heading";
import { getTopCustomersByRate } from "@/dataApi";
import { Filters } from "./filters";

export default async function Page() {
  const data = await getTopCustomersByRate("Formaldehyde-37%", 1000);

  return (
    <div className="p-4">
      <Heading level="h1">Top Customers By Rate</Heading>
      <Filters />
      <table>
        <tbody>
          {data.map((row) => (
            <tr key={row.consigneeName}>
              <td>{row.consigneeName}</td>
              <td>{row.rate}</td>
              <td>{row.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>{data.length} results</div>
    </div>
  );
}
