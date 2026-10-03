import { getDbPath, wipeDb } from "../src/lib/db";

wipeDb();
console.log(`Wiped ${getDbPath()}`);
