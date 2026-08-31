// Hourly routing timeline for observability heatmaps.
// routingTimeline: per (hour, taskType, provider, model) request/failure/latency
// buckets so the report page can render success-rate / latency heatmaps over time.
export default {
  version: 4,
  name: "routing-timeline",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS routingTimeline (
        hour TEXT NOT NULL,
        taskType TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        requests INTEGER DEFAULT 0,
        failures INTEGER DEFAULT 0,
        totalLatencyMs REAL DEFAULT 0,
        PRIMARY KEY (hour, taskType, provider, model)
      );
      CREATE INDEX IF NOT EXISTS idx_rt_hour ON routingTimeline(hour);
      CREATE INDEX IF NOT EXISTS idx_rt_provider ON routingTimeline(provider);
    `);
  },
};
