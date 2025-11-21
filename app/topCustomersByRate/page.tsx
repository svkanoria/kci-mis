import { Heading } from "@/components/typography/heading";
import { getTopCustomersByRate } from "@/dataApi";
import { Filters } from "./filters";
import { DateRange } from "@/components/ui/dateRangePicker";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { from, to, product } = await searchParams;
  const fromStr = typeof from === "string" ? from : undefined;
  const toStr = typeof to === "string" ? to : undefined;
  const productStr = typeof product === "string" ? product : undefined;

  const initialRange: DateRange = {
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr) : undefined,
  };

  const selectedProduct = productStr;

  const data = await getTopCustomersByRate(
    {
      from: initialRange.from,
      to: initialRange.to,
      product: selectedProduct,
    },
    1000,
  );

  return (
    <div className="p-4">
      <Heading level="h1">Top Customers By Rate</Heading>
      <Filters
        initialRange={initialRange}
        initialProduct={selectedProduct}
        key={`${selectedProduct}-${fromStr}-${toStr}`}
      />
      <div>{data.length} results</div>
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
    </div>
  );
}
