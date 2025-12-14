import { Heading } from "@/components/typography/heading";
import Link from "next/link";

export default async function Home() {
  return (
    <div className="p-3">
      <Heading level="h1">KCI MIS</Heading>
      <ul>
        <li>
          <Link href="/topCustomersFD">Top Customers - Formaldehyde</Link>
        </li>
        <li>
          <Link href="/lostCustomersFD">Lost Customers - Formaldehyde</Link>
        </li>
      </ul>
    </div>
  );
}
