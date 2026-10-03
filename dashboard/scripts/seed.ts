import { getDb } from "../src/lib/db";
import { seedDemoData } from "../src/lib/seed";

getDb();
seedDemoData();
console.log("Seeded demo digital and health data into data/parallax.db");
