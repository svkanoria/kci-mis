"use server";

import { db } from "@/db/drizzle";
import { routesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateRouteDistance(id: number, distanceKm: number) {
  await db
    .update(routesTable)
    .set({ distanceKm: distanceKm.toString() })
    .where(eq(routesTable.id, id));

  revalidatePath("/admin/routes");
}
