import { db } from "@/db/drizzle";
import { salesInvoicesRawTable } from "@/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await db
      .select({
        minDate: sql<string>`min(${salesInvoicesRawTable.invDate})`,
        maxDate: sql<string>`max(${salesInvoicesRawTable.invDate})`,
      })
      .from(salesInvoicesRawTable);

    if (result.length === 0) {
      return NextResponse.json({ minDate: null, maxDate: null });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error fetching date range:", error);
    return NextResponse.json(
      { error: "Failed to fetch date range" },
      { status: 500 },
    );
  }
}
