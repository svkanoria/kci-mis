"use server";

import { db } from "@/db/drizzle";
import { destinationsTable } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateDestinationCoordinates(
  id: number,
  lat: number | null,
  lng: number | null,
) {
  await db
    .update(destinationsTable)
    .set({
      coordinates:
        lat === null || lng === null
          ? null
          : sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
    })
    .where(eq(destinationsTable.id, id));

  revalidatePath("/admin/destinations");
}
