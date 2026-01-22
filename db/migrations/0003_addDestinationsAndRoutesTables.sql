CREATE EXTENSION postgis;

CREATE TABLE "destinations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "destinations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"city" varchar NOT NULL,
	"region" varchar NOT NULL,
	"coordinates" geometry(point),
	CONSTRAINT "destinations_city_region_unique" UNIQUE("city","region")
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "routes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plant" integer NOT NULL,
	"destinationId" integer NOT NULL,
	"distanceKm" numeric,
	CONSTRAINT "routes_plant_destinationId_unique" UNIQUE("plant","destinationId")
);
--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_destinationId_destinations_id_fk" FOREIGN KEY ("destinationId") REFERENCES "public"."destinations"("id") ON DELETE no action ON UPDATE no action;