// Per-key request limits: rpmLimit (requests per minute) and concurrencyLimit
// (in-flight requests). Both nullable — null or 0 means "no limit", which is
// what every existing key gets, so nothing changes for current installs.
export default {
  version: 10,
  name: "key-rate-limits",
  up(db) {
    for (const column of ["rpmLimit", "concurrencyLimit"]) {
      try {
        db.exec(`ALTER TABLE apiKeys ADD COLUMN ${column} INTEGER`);
      } catch (e) {
        // "duplicate column" = the additive schema sync already added it;
        // "no such table" = fresh database, the sync will create it with the column.
        const message = e?.message || "";
        if (!/duplicate column|no such table/i.test(message)) throw e;
      }
    }
  },
};
