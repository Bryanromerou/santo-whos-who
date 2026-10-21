// Applies pending Drizzle migrations to the configured SQLite database.
// The app also runs this automatically on startup; this script is for explicit setup.
import { closeDb, getDb } from "../src/db/client";
import { databasePath } from "../src/lib/config";

getDb();
closeDb();
console.log(`Base de datos lista: ${databasePath()}`);
