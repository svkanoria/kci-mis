import { db } from "@/db/drizzle";
import { salesInvoicesRawTable } from "@/db/schema";
import { eq, sql, sum } from "drizzle-orm";

export default async function Home() {
  const data = await db
    .select({
      recipientName: salesInvoicesRawTable.recipientName,
      totalQty: sum(salesInvoicesRawTable.qty).as("totalQty"),
    })
    .from(salesInvoicesRawTable)
    .where(eq(salesInvoicesRawTable.materialDescription2, "FORMALDEHYDE"))
    .groupBy(salesInvoicesRawTable.recipientName)
    .orderBy(sql`"totalQty" DESC`)
    .limit(10);

  return (
    <div className="p-4">
      <h1 className="text-4xl">KCI MIS</h1>
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
