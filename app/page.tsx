import { Heading } from "@/components/typography/heading";
import Link from "next/link";

export default async function Home() {
  return (
    <div className="p-4">
      <Heading level="h1">KCI MIS</Heading>
      <ul>
        <li>
          <Link href="/topCustomersByRate">Top Customers By Rate</Link>
        </li>
        <li>
          <Link href="/topCustomersByRevenue">Top Customers By Revenue</Link>
        </li>
        <li>
          <Link href="/topCustomersByVolume">Top Customers By Volume</Link>
        </li>
        <li>
          <Link href="/mostConsistentCustomers">Most Consistent Customers</Link>
        </li>
      </ul>
    </div>
  );
}
