import { db } from "@/db/drizzle";
import {
  salesInvoicesRawTable,
  salesInvoicesDerivedTable,
  methanolPricesInterpolatedView,
  routesTable,
} from "@/db/schema";
import { and, eq, isNotNull, not, sql } from "drizzle-orm";
import { mean, standardDeviation, sum } from "simple-statistics";
import { calculateRegression } from "@/lib/utils/stats";
import { match } from "ts-pattern";
import {
  CommonFilterParams,
  getRawCommonConditions,
  getDerivedCommonConditions,
  processTimeSeries,
  DeltaType,
  inferDeltaType,
} from "./utils";

export async function getTopCustomers(
  filters: CommonFilterParams &
    Required<Pick<CommonFilterParams, "period">> & {
      grouping: string;
      channels: string;
    },
  deltaType: DeltaType | null = null,
) {
  const groupings = filters.grouping.split(",");
  const groupRecipient = groupings.includes("recipient");
  const groupDistChannel = groupings.includes("distChannel");
  const groupPlant = groupings.includes("plant");
  const groupDestination = groupings.includes("destination");
  const groupRouteDistance = groupings.includes("routeDistance");

  const rawConditions = [
    ...getRawCommonConditions(filters),
    ...(filters.channels === "dealer-known"
      ? [
          not(
            eq(
              salesInvoicesRawTable.consigneeName,
              salesInvoicesRawTable.recipientName,
            ),
          ),
          eq(salesInvoicesRawTable.distChannelDescription, "Dealer"),
        ]
      : filters.channels === "dealer-unknown"
        ? [
            eq(
              salesInvoicesRawTable.consigneeName,
              salesInvoicesRawTable.recipientName,
            ),
            eq(salesInvoicesRawTable.distChannelDescription, "Dealer"),
          ]
        : []),
  ];

  const effectiveDeltaType = deltaType ?? inferDeltaType(filters.product);

  const filteredRawSq = db
    .select()
    .from(salesInvoicesRawTable)
    .where(
      and(
        ...rawConditions,
        isNotNull(salesInvoicesRawTable.basicAmount),
        isNotNull(salesInvoicesRawTable.contractDate),
      ),
    )
    .as("filtered_raw");

  const isCategoryFilter = filters.product?.startsWith("C:");

  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : filteredRawSq.qty;

  const rateCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normBasicRate
    : filteredRawSq.basicRate;

  let recipientNames: Map<string, string> = new Map();
  if (!groupRecipient) {
    const recipientNamesArray = await db
      .select({
        consigneeName: filteredRawSq.consigneeName,
        recipientName: sql<string>`COALESCE(
            json_agg(
              DISTINCT ${filteredRawSq.recipientName}
              ORDER BY ${filteredRawSq.recipientName} ASC
            )::text, 
            '')`,
      })
      .from(filteredRawSq)
      .groupBy(filteredRawSq.consigneeName);

    recipientNamesArray.forEach((row) => {
      recipientNames.set(row.consigneeName, row.recipientName);
    });
  }

  const baseQuery = db
    .select({
      plant: groupPlant ? filteredRawSq.plant : sql<number>`0`,
      distChannelDescription: groupDistChannel
        ? filteredRawSq.distChannelDescription
        : sql<string>`''`,
      recipientName: groupRecipient
        ? filteredRawSq.recipientName
        : sql<string>`''`,
      routeDistanceBucket: (groupRouteDistance
        ? sql<number>`floor(COALESCE(${routesTable.distanceKm}, -1) / 100.0) * 100`.mapWith(
            Number,
          )
        : sql<number>`0`
      ).as("routeDistanceBucket"),
      destination: groupDestination
        ? sql<string>`${filteredRawSq.consigneeCity} || ', ' || ${filteredRawSq.consigneeRegion}`.as(
            "destination",
          )
        : sql<string>`''`.as("destination"),
      consigneeName: filteredRawSq.consigneeName,
      period: (filters.period === "year"
        ? sql`date_trunc('year', ${filteredRawSq.invDate} - interval '3 months') + interval '3 months'`
        : sql`date_trunc(${filters.period}, ${filteredRawSq.invDate})`
      )
        .mapWith((v) => new Date(v as string))
        .as("period"),
      qty: sql<number>`sum(${qtyCol})`.mapWith(Number).as("qty"),
      amount: sql<number>`sum(${filteredRawSq.basicAmount})`
        .mapWith(Number)
        .as("amount"),
      deltaAmount: match(effectiveDeltaType)
        .with("FormaldehydeNorms", () =>
          sql<number>`sum((${rateCol} - (${methanolPricesInterpolatedView.dailyIcisKandlaPrice} * 500)) * ${filteredRawSq.qty})`.mapWith(
            Number,
          ),
        )
        .with("HexamineNorms", () =>
          sql<number>`sum((${rateCol} - (${methanolPricesInterpolatedView.dailyIcisKandlaPrice} * 3600 * 0.43)) * ${filteredRawSq.qty})`.mapWith(
            Number,
          ),
        )
        .otherwise(() => sql<number | null>`null`)
        .as("deltaAmount"),
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId),
    );

  const queryWithOptionalJoins = match(effectiveDeltaType)
    .with("FormaldehydeNorms", "HexamineNorms", () =>
      baseQuery.leftJoin(
        methanolPricesInterpolatedView,
        eq(filteredRawSq.contractDate, methanolPricesInterpolatedView.date),
      ),
    )
    .otherwise(() => baseQuery);

  const rows = await queryWithOptionalJoins
    .leftJoin(
      routesTable,
      eq(salesInvoicesDerivedTable.routeId, routesTable.id),
    )
    .where(and(...getDerivedCommonConditions(filters), isNotNull(rateCol)))
    .groupBy(
      ...(groupPlant ? [filteredRawSq.plant] : []),
      ...(groupDistChannel ? [filteredRawSq.distChannelDescription] : []),
      ...(groupRecipient ? [filteredRawSq.recipientName] : []),
      ...(groupRouteDistance
        ? [sql`floor(COALESCE(${routesTable.distanceKm}, -1) / 100.0) * 100`]
        : []),
      ...(groupDestination
        ? [filteredRawSq.consigneeCity, filteredRawSq.consigneeRegion]
        : []),
      filteredRawSq.consigneeName,
      sql`period`,
    )
    .orderBy(
      sql`period`,
      filteredRawSq.consigneeName,
      ...(groupRecipient ? [filteredRawSq.recipientName] : []),
      ...(groupDistChannel ? [filteredRawSq.distChannelDescription] : []),
      ...(groupPlant ? [filteredRawSq.plant] : []),
      ...(groupRouteDistance ? [sql`"routeDistanceBucket"`] : []),
      ...(groupDestination ? [sql`"destination"`] : []),
    );

  const data = processTimeSeries(
    rows,
    filters.period,
    (r) => r.period,
    "key",
    { qty: 0, amount: 0, rate: null, delta: null },
    (r) =>
      JSON.stringify({
        p: r.plant,
        d: r.distChannelDescription,
        r: r.recipientName,
        c: r.consigneeName,
        rd: r.routeDistanceBucket,
        dest: r.destination,
      }),
    (r) => ({
      qty: r.qty,
      amount: r.amount,
      rate: r.qty > 0 ? r.amount / r.qty : null,
      delta: r.qty > 0 && r.deltaAmount !== null ? r.deltaAmount / r.qty : null,
    }),
  );

  const result = data.map((item) => {
    const qtys = item.series.map((s) => s.value.qty);
    const amounts = item.series.map((s) => s.value.amount);
    const rates = item.series.map((s) => s.value.rate);
    const deltas = item.series.map((s) => s.value.delta);

    // Qty related fields
    const totalQty = sum(qtys);
    const avgQty = qtys.length > 0 ? mean(qtys) : 0;
    const stdDevQty = qtys.length > 0 ? standardDeviation(qtys) : 0;
    const cvQty = avgQty > 0 ? stdDevQty / avgQty : 0;
    const { slope: slopeQty, intercept: interceptQty } =
      calculateRegression(qtys);

    const totalAmount = sum(amounts);
    // Rate related fields
    const avgRate = totalQty > 0 ? totalAmount / totalQty : null;
    const filteredRates = rates.filter((r) => r !== null);
    const stdDevRate =
      filteredRates.length > 0 ? standardDeviation(filteredRates) : 0;

    let totalDeltaAmount: number | null = null;
    let avgDelta: number | null = null;
    let stdDevDelta: number | null = null;
    let cvDelta: number | null = null;
    let slopeDelta: number | null = null;
    let interceptDelta: number | null = null;

    if (effectiveDeltaType) {
      totalDeltaAmount = item.series.reduce(
        (sum, s) => sum + (s.value.delta ?? 0) * s.value.qty,
        0,
      );
      avgDelta = totalQty > 0 ? totalDeltaAmount / totalQty : null;
      const filteredDeltas = deltas.filter((d) => d !== null);
      stdDevDelta =
        filteredDeltas.length > 0 ? standardDeviation(filteredDeltas) : 0;
      cvDelta =
        avgDelta !== null && avgDelta !== 0
          ? stdDevDelta / Math.abs(avgDelta)
          : 0;
      const regression = calculateRegression(filteredDeltas);
      slopeDelta = regression.slope;
      interceptDelta = regression.intercept;
    }

    const { p, d, r, c, rd, dest } = JSON.parse(item.key);

    return {
      ...item,
      plant: parseInt(p),
      distChannelDescription: d,
      recipientName: r === "" ? recipientNames.get(c) || "" : r,
      consigneeName: c,
      routeDistanceBucket: parseInt(rd),
      destination: dest,
      // Qty related fields
      slopeQty,
      interceptQty,
      totalQty,
      avgQty,
      stdDevQty,
      cvQty,
      // Rate related fields
      avgRate,
      stdDevRate,
      // Delta related fields
      avgDelta,
      slopeDelta,
      interceptDelta,
      stdDevDelta,
      cvDelta,
      // Other
      totalAmount,
      totalDeltaAmount,
    };
  });

  return result.sort((a, b) => a.totalQty - b.totalQty).reverse();
}
