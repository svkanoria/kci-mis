import { Period, parseDate } from "@/lib/utils/date";

export function extractFilterParams(
  searchParams: {
    [key: string]: string | string[] | undefined;
  },
  defaults?: Partial<{
    from: Date;
    to: Date;
    period: Period;
    product: string;
  }>,
) {
  const { from, to, product, period } = searchParams;

  const parsedFrom = typeof from === "string" ? parseDate(from) : defaults?.from;
  const parsedTo = typeof to === "string" ? parseDate(to) : defaults?.to;
  const parsedPeriod = (
    typeof period === "string" && ["month", "quarter", "year"].includes(period)
      ? period
      : defaults?.period
  ) as Period;
  const parsedProduct =
    typeof product === "string" ? product : defaults?.product;

  return {
    from: parsedFrom,
    to: parsedTo,
    period: parsedPeriod,
    product: parsedProduct,
  };
}
