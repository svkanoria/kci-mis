TRUNCATE TABLE "salesInvoicesDerived";--> statement-breakpoint
ALTER TABLE "salesInvoicesDerived" ADD COLUMN "routeId" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "salesInvoicesDerived" ADD CONSTRAINT "salesInvoicesDerived_routeId_routes_id_fk" FOREIGN KEY ("routeId") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;