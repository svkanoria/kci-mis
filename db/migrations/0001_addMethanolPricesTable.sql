CREATE TABLE "methanolPrices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "methanolPrices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"dailyIcisKandlaPrice" numeric,
	CONSTRAINT "methanolPrices_date_unique" UNIQUE("date")
);
