CREATE VIEW "public"."methanolPricesInterpolated" AS (
  WITH valid_prices AS (
      SELECT date, "dailyIcisKandlaPrice" as price
      FROM "methanolPrices"
      WHERE "dailyIcisKandlaPrice" IS NOT NULL
  ),
  ordered_prices AS (
      SELECT
          date,
          price,
          LEAD(date) OVER (ORDER BY date) as next_date,
          LEAD(price) OVER (ORDER BY date) as next_price
      FROM valid_prices
  )
  SELECT
      t.day::date as date,
      COALESCE(
          op.price + (op.next_price - op.price) * (t.day::date - op.date)::numeric / NULLIF((op.next_date - op.date)::numeric, 0),
          op.price
      ) as "dailyIcisKandlaPrice",
      op.price as "dailyIcisKandlaPriceForwardFill",
      CASE WHEN t.day::date = op.date THEN op.price ELSE op.next_price END as "dailyIcisKandlaPriceBackwardFill",
      (t.day::date != op.date) as "isInterpolated"
  FROM ordered_prices op
  CROSS JOIN LATERAL generate_series(op.date::timestamp, COALESCE(op.next_date::timestamp - interval '1 day', op.date::timestamp), interval '1 day') as t(day)
);