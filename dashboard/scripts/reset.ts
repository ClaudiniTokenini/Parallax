import { deleteDbFile, getDbPath } from "../src/lib/db";

deleteDbFile();
console.log(`Removed ${getDbPath()}`);
