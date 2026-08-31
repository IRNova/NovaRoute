/**
 * Memory System for NovaRoute
 * 
 * Provides persistent memory with vector search capabilities.
 * Includes LanceDB-style vector store integration.
 */

const { EventEmitter } = require("events");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { EmbeddingProvider, EnhancedMemoryManager } = require("./vectorStore");

/**
 * Memory Types
 */
const MemoryTypes = {
  CONVERSATION: "conversation",
  FACT: "fact",
  PREFERENCE: "preference",
  SKILL: "skill",
  EXPERIENCE: "experience",
};

/**
 * Memory Entry
 */
class MemoryEntry {
  constructor(options = {}) {
    this.id = options.id || crypto.randomUUID();
    this.type = options.type || MemoryTypes.CONVERSATION;
    this.content = options.content || "";
    this.metadata = options.metadata || {};
    this.embedding = options.embedding || null;
    this.timestamp = options.timestamp || Date.now();
    this.expiresAt = options.expiresAt || null;
    this.score = options.score || 0;
  }

  /**
   * Check if entry is expired
   */
  isExpired() {
    if (!this.expiresAt) return false;
    return Date.now() > this.expiresAt;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      content: this.content,
      metadata: this.metadata,
      embedding: this.embedding,
      timestamp: this.timestamp,
      expiresAt: this.expiresAt,
      score: this.score,
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data) {
    return new MemoryEntry(data);
  }
}

/**
 * Memory System
 */
class MemorySystem extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.dataDir = options.dataDir || process.env.DATA_DIR || "~/.novaroute/memory";
    this.maxEntries = options.maxEntries || 10000;
    this.embeddingDimension = options.embeddingDimension || 1536;
    
    this.entries = new Map();
    this.collections = new Map();
    
    this.vectorStore = null;
    this.embeddingProvider = options.embeddingProvider || null;
    
    // Load existing entries
    this._loadEntries();
  }

  /**
   * Add a memory entry
   */
  async addEntry(type, content, metadata = {}) {
    const entry = new MemoryEntry({
      type,
      content,
      metadata,
    });

    // Generate embedding if provider available
    if (this.embeddingProvider) {
      try {
        entry.embedding = await this.embeddingProvider.embed(content);
      } catch (error) {
        console.error("[Memory] Embedding generation failed:", error.message);
      }
    }

    this.entries.set(entry.id, entry);
    
    // Save to disk
    this._saveEntries();
    
    this.emit("entry_added", entry.toJSON());
    
    return entry;
  }

  /**
   * Get a memory entry
   */
  getEntry(entryId) {
    return this.entries.get(entryId);
  }

  /**
   * Search memories by text
   */
  async search(query, options = {}) {
    const { limit = 10, type, minScore = 0 } = options;
    
    // Simple text search (in production, use vector search)
    const results = [];
    
    for (const [id, entry] of this.entries) {
      if (entry.isExpired()) continue;
      if (type && entry.type !== type) continue;
      
      // Simple text matching
      const score = this._calculateRelevance(query, entry.content);
      if (score >= minScore) {
        entry.score = score;
        results.push(entry);
      }
    }
    
    // Sort by score
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, limit);
  }

  /**
   * Search with vector similarity
   */
  async vectorSearch(query, options = {}) {
    const { limit = 10, type, threshold = 0.7 } = options;
    
    if (!this.embeddingProvider) {
      throw new Error("Embedding provider not configured");
    }
    
    // Generate query embedding
    const queryEmbedding = await this.embeddingProvider.embed(query);
    
    // Calculate similarity
    const results = [];
    
    for (const [id, entry] of this.entries) {
      if (entry.isExpired()) continue;
      if (type && entry.type !== type) continue;
      if (!entry.embedding) continue;
      
      const similarity = this._cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity >= threshold) {
        entry.score = similarity;
        results.push(entry);
      }
    }
    
    // Sort by similarity
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, limit);
  }

  /**
   * Delete a memory entry
   */
  deleteEntry(entryId) {
    const deleted = this.entries.delete(entryId);
    if (deleted) {
      this._saveEntries();
      this.emit("entry_deleted", entryId);
    }
    return deleted;
  }

  /**
   * Clear expired entries
   */
  clearExpired() {
    let count = 0;
    
    for (const [id, entry] of this.entries) {
      if (entry.isExpired()) {
        this.entries.delete(id);
        count++;
      }
    }
    
    if (count > 0) {
      this._saveEntries();
      this.emit("expired_cleared", count);
    }
    
    return count;
  }

  /**
   * Get memory stats
   */
  getStats() {
    const entries = Array.from(this.entries.values());
    const byType = {};
    
    for (const entry of entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    }
    
    return {
      totalEntries: entries.length,
      byType,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null,
    };
  }

  /**
   * Export memories
   */
  exportMemories() {
    return Array.from(this.entries.values()).map(e => e.toJSON());
  }

  /**
   * Import memories
   */
  importMemories(data) {
    let count = 0;
    
    for (const item of data) {
      try {
        const entry = MemoryEntry.fromJSON(item);
        this.entries.set(entry.id, entry);
        count++;
      } catch (error) {
        console.error("[Memory] Import error:", error.message);
      }
    }
    
    this._saveEntries();
    this.emit("memories_imported", count);
    
    return count;
  }

  /**
   * Calculate text relevance
   */
  _calculateRelevance(query, text) {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Simple word matching
    const queryWords = queryLower.split(/\s+/);
    const textWords = textLower.split(/\s+/);
    
    let matches = 0;
    for (const word of queryWords) {
      if (textWords.includes(word)) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  /**
   * Calculate cosine similarity
   */
  _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Load entries from disk
   */
  _loadEntries() {
    try {
      const filePath = path.join(this.dataDir, "memories.json");
      
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        
        for (const item of data) {
          const entry = MemoryEntry.fromJSON(item);
          this.entries.set(entry.id, entry);
        }
        
        console.log(`[Memory] Loaded ${this.entries.size} entries`);
      }
    } catch (error) {
      console.error("[Memory] Failed to load entries:", error.message);
    }
  }

  /**
   * Save entries to disk
   */
  _saveEntries() {
    try {
      const dir = path.dirname(path.join(this.dataDir, "memories.json"));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const filePath = path.join(this.dataDir, "memories.json");
      const data = this.exportMemories();
      
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("[Memory] Failed to save entries:", error.message);
    }
  }
}

// Singleton instance
let memoryInstance = null;

/**
 * Get or create Memory System instance
 */
function getMemorySystem(options = {}) {
  if (!memoryInstance) {
    memoryInstance = new MemorySystem(options);
  }
  return memoryInstance;
}

module.exports = {
  MemorySystem,
  MemoryEntry,
  MemoryTypes,
  getMemorySystem,
};
