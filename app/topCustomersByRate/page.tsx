import { Heading } from "@/components/typography/heading";
import { getTopCustomersByRate } from "@/lib/api";
import { ExtendedFilter } from "./extendedFilter";
import { extractFilterParams } from "../_utils/filter";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { from, to, product } = extractFilterParams(await searchParams);

  const data = await getTopCustomersByRate(
    {
      from,
      to,
      product,
    },
    1000,
  );

  return (
    <div className="p-4">
      <Heading level="h1">Top Customers By Rate</Heading>
      <ExtendedFilter
        initialFrom={from}
        initialTo={to}
        initialProduct={product}
        key={`${from}-${to}-${product}`}
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
