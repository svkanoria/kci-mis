"use server";

import { db } from "@/db/drizzle";
import { routesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDestinationCustomers as fetchCustomers } from "@/lib/api";

export async function updateRouteDistance(id: number, distanceKm: number) {
  await db
    .update(routesTable)
    .set({ distanceKm: distanceKm.toString(), isEstimated: false })
    .where(eq(routesTable.id, id));

  revalidatePath("/admin/routes");
}

export async function getRouteCustomers(city: string, region: string) {
  return await fetchCustomers(city, region);
}
