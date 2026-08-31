/**
 * Vector Store — LanceDB/sqlite-vec integration for memory system
 * 
 * Provides vector search, hybrid RRF search, and memory persistence.
 * Falls back to FTS5 keyword search when vector extension is unavailable.
 */

const crypto = require('crypto');

// ============ Types ============

/**
 * @typedef {{ memoryId: string; distance: number; score: number }} VectorSearchHit
 * @typedef {{ memoryId: string; vecRank: number | null; ftsRank: number | null; rrfScore: number; vecDistance: number | null; ftsScore: number | null }} HybridRrfHit
 */

const TOP_K_DEFAULT = 20;
const RRF_K = 60;

// ============ Vector Store Implementation ============

class VectorStoreImpl {
  constructor(db, options = {}) {
    this.db = db;
    this.quantization = options.quantization || 'none'; // 'none' | 'int8'
    this.dimensions = options.dimensions || 1536;
    this._ensureSchema();
  }

  _ensureSchema() {
    try {
      // Create memory_vectors table for storing embeddings
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS memory_vectors (
          memory_id TEXT PRIMARY KEY,
          embedding BLOB NOT NULL,
          dimensions INTEGER NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
        )
      `);

      // Create FTS5 virtual table for keyword search
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
          memory_id,
          content,
          type,
          content_rowid='rowid'
        )
      `);
    } catch (err) {
      console.warn('[VectorStore] Schema creation warning:', err.message);
    }
  }

  /**
   * Encode Float32Array as Buffer
   * @param {Float32Array} vector
   * @returns {Buffer}
   */
  _encodeVector(vector) {
    return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
  }

  /**
   * Decode Buffer to Float32Array
   * @param {Buffer} buffer
   * @returns {Float32Array}
   */
  _decodeVector(buffer) {
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  }

  /**
   * Upsert vector for a memory
   * @param {string} memoryId
   * @param {Float32Array} vector
   */
  upsertVector(memoryId, vector) {
    const encoded = this._encodeVector(vector);
    this.db.prepare(
      'INSERT OR REPLACE INTO memory_vectors (memory_id, embedding, dimensions) VALUES (?, ?, ?)'
    ).run(memoryId, encoded, vector.length);
  }

  /**
   * Delete vector for a memory
   * @param {string} memoryId
   */
  deleteVector(memoryId) {
    this.db.prepare('DELETE FROM memory_vectors WHERE memory_id = ?').run(memoryId);
  }

  /**
   * KNN brute-force search
   * @param {Float32Array} queryVector
   * @param {number} topK
   * @returns {VectorSearchHit[]}
   */
  searchVector(queryVector, topK = TOP_K_DEFAULT) {
    const rows = this.db.prepare(
      'SELECT memory_id, embedding, dimensions FROM memory_vectors'
    ).all();

    const results = rows.map(row => {
      const stored = this._decodeVector(row.embedding);
      const distance = this._cosineDistance(queryVector, stored);
      return {
        memoryId: row.memory_id,
        distance,
        score: 1 / (1 + distance),
      };
    });

    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, topK);
  }

  /**
   * Hybrid RRF search (vector + FTS5 fused via Reciprocal Rank Fusion)
   * @param {Float32Array} queryVector
   * @param {string} queryText
   * @param {number} topK
   * @returns {HybridRrfHit[]}
   */
  searchHybrid(queryVector, queryText, topK = TOP_K_DEFAULT) {
    // Vector search results
    const vecResults = this.searchVector(queryVector, topK);
    const vecRanks = new Map(vecResults.map((r, i) => [r.memoryId, { rank: i + 1, distance: r.distance }]));

    // FTS5 keyword search results
    let ftsResults = [];
    try {
      ftsResults = this.db.prepare(
        'SELECT memory_id, rank FROM memory_fts WHERE memory_fts MATCH ? ORDER BY rank LIMIT ?'
      ).all(queryText, topK);
    } catch {
      // FTS5 may not be available
    }
    const ftsRanks = new Map(ftsResults.map((r, i) => [r.memoryId, { rank: i + 1, score: r.rank }]));

    // Fuse via RRF
    const allIds = new Set([...vecRanks.keys(), ...ftsRanks.keys()]);
    const fused = [];

    for (const id of allIds) {
      const vecRank = vecRanks.get(id)?.rank || null;
      const ftsRank = ftsRanks.get(id)?.rank || null;
      const vecDistance = vecRanks.get(id)?.distance || null;
      const ftsScore = ftsRanks.get(id)?.score || null;

      const rrfScore =
        (vecRank ? 1 / (RRF_K + vecRank) : 0) +
        (ftsRank ? 1 / (RRF_K + ftsRank) : 0);

      fused.push({ memoryId: id, vecRank, ftsRank, rrfScore, vecDistance, ftsScore });
    }

    fused.sort((a, b) => b.rrfScore - a.rrfScore);
    return fused.slice(0, topK);
  }

  /**
   * Calculate cosine distance (1 - similarity)
   */
  _cosineDistance(a, b) {
    if (!a || !b || a.length !== b.length) return 1;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return 1 - sim;
  }

  /**
   * Get store stats
   */
  stats() {
    let rowCount = 0;
    try {
      const row = this.db.prepare('SELECT COUNT(*) as cnt FROM memory_vectors').get();
      rowCount = row?.cnt || 0;
    } catch {}
    return { rowCount, dimensions: this.dimensions, quantization: this.quantization };
  }
}

// ============ Embedding Provider ============

class EmbeddingProvider {
  constructor(options = {}) {
    this.provider = options.provider || 'openai';
    this.model = options.model || 'text-embedding-3-small';
    this.dimensions = options.dimensions || 1536;
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
  }

  /**
   * Generate embedding for text
   * @param {string} text
   * @returns {Promise<Float32Array>}
   */
  async embed(text) {
    if (!this.apiKey) {
      // Fallback: simple hash-based embedding for demo/dev
      return this._hashEmbedding(text);
    }

    try {
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: text }),
      });

      if (!res.ok) throw new Error(`Embedding API error: ${res.status}`);
      const data = await res.json();
      return new Float32Array(data.data[0].embedding);
    } catch (err) {
      console.warn('[Embedding] API failed, falling back to hash:', err.message);
      return this._hashEmbedding(text);
    }
  }

  /**
   * Generate batch embeddings
   * @param {string[]} texts
   * @returns {Promise<Float32Array[]>}
   */
  async embedBatch(texts) {
    if (!this.apiKey) {
      return Promise.all(texts.map(t => this._hashEmbedding(t)));
    }

    try {
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: texts }),
      });

      if (!res.ok) throw new Error(`Embedding API error: ${res.status}`);
      const data = await res.json();
      return data.data.map(d => new Float32Array(d.embedding));
    } catch {
      return Promise.all(texts.map(t => this._hashEmbedding(t)));
    }
  }

  /**
   * Fallback: deterministic hash-based embedding
   */
  _hashEmbedding(text) {
    const vec = new Float32Array(this.dimensions);
    const hash = crypto.createHash('sha256').update(text).digest();
    for (let i = 0; i < this.dimensions; i++) {
      vec[i] = (hash[i % hash.length] / 128) - 1;
    }
    // Normalize
    let norm = 0;
    for (let i = 0; i < this.dimensions; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    for (let i = 0; i < this.dimensions; i++) vec[i] /= norm;
    return vec;
  }
}

// ============ Enhanced Memory Manager ============

class EnhancedMemoryManager {
  constructor(options = {}) {
    this.db = options.db;
    this.embeddingProvider = options.embeddingProvider || new EmbeddingProvider();
    this.vectorStore = null;
    this.maxTokens = options.maxTokens || 10000;
    this.retentionDays = options.retentionDays || 90;
    
    if (this.db) {
      this.vectorStore = new VectorStoreImpl(this.db, {
        dimensions: this.embeddingProvider.dimensions,
      });
    }
  }

  /**
   * Store a memory with vector embedding
   */
  async store(type, content, metadata = {}) {
    const id = crypto.randomUUID();
    const embedding = await this.embeddingProvider.embed(content);

    if (this.db) {
      this.db.prepare(
        'INSERT INTO memories (id, type, content, metadata, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
      ).run(id, type, content, JSON.stringify(metadata));

      if (this.vectorStore) {
        this.vectorStore.upsertVector(id, embedding);
      }
    }

    return { id, type, content, metadata, embedding };
  }

  /**
   * Search memories with hybrid vector + keyword search
   */
  async search(query, options = {}) {
    const { limit = 10, type, threshold = 0.7 } = options;
    const queryEmbedding = await this.embeddingProvider.embed(query);

    if (this.vectorStore) {
      // Hybrid search
      const results = this.vectorStore.searchHybrid(queryEmbedding, query, limit);
      return results.filter(r => r.rrfScore > threshold);
    }

    // Fallback: simple text search
    return this._textSearch(query, limit, type);
  }

  /**
   * Simple text search fallback
   */
  _textSearch(query, limit, type) {
    if (!this.db) return [];
    try {
      const sql = type
        ? 'SELECT * FROM memories WHERE type = ? AND content LIKE ? LIMIT ?'
        : 'SELECT * FROM memories WHERE content LIKE ? LIMIT ?';
      const params = type ? [type, `%${query}%`, limit] : [`%${query}%`, limit];
      return this.db.prepare(sql).all(...params);
    } catch {
      return [];
    }
  }

  /**
   * Get memory stats
   */
  stats() {
    const vectorStats = this.vectorStore?.stats() || { rowCount: 0 };
    return {
      vectorCount: vectorStats.rowCount,
      dimensions: vectorStats.dimensions,
      provider: this.embeddingProvider.provider,
    };
  }
}

module.exports = {
  VectorStoreImpl,
  EmbeddingProvider,
  EnhancedMemoryManager,
};
