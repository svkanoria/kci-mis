CREATE TABLE "salesInvoiceDerived" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "salesInvoiceDerived_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rawId" integer,
	"normalizationFactor" numeric NOT NULL,
	"normBasicRate" numeric,
	"normNetRealisationPerUnit" numeric,
	"normQty" numeric NOT NULL,
	"productCategory" varchar NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salesInvoiceDerived" ADD CONSTRAINT "salesInvoiceDerived_rawId_salesInvoicesRaw_id_fk" FOREIGN KEY ("rawId") REFERENCES "public"."salesInvoicesRaw"("id") ON DELETE no action ON UPDATE no action;