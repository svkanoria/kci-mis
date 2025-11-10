import { drizzle } from "drizzle-orm/node-postgres";

export const db = drizzle({
  connection: {
    host: "localhost",
    port: Number(process.env.HOST_DB_PORT),
    user: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
    database: process.env.POSTGRES_DB!,
  },
});
