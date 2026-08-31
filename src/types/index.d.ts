/**
 * NovaRoute TypeScript Type Definitions
 * 
 * Core types for the AI gateway platform.
 */

// ============ Provider Types ============

export interface Provider {
  id: string;
  name: string;
  type: 'api-key' | 'oauth' | 'cookie' | 'no-auth';
  baseUrl: string;
  models: Model[];
  capabilities: ProviderCapability[];
  pricing?: ProviderPricing;
  quota?: ProviderQuota;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  maxOutputTokens: number;
  capabilities: ModelCapability[];
  pricing?: {
    input: number;
    output: number;
    currency: string;
  };
}

export type ModelCapability = 
  | 'chat' 
  | 'completion' 
  | 'embedding' 
  | 'image-generation' 
  | 'image-analysis'
  | 'audio-transcription'
  | 'audio-synthesis'
  | 'video-generation'
  | 'search'
  | 'function-calling'
  | 'vision';

export type ProviderCapability = 
  | 'streaming'
  | 'batch'
  | 'embeddings'
  | 'images'
  | 'audio'
  | 'video'
  | 'search'
  | 'tools';

export interface ProviderPricing {
  tier: 'free' | 'basic' | 'pro' | 'enterprise';
  monthlyPrice?: number;
  tokenPricing?: {
    input: number;
    output: number;
  };
}

export interface ProviderQuota {
  remaining: number;
  limit: number;
  resetAt: string;
}

// ============ A2A Types ============

export type TaskState = 'submitted' | 'working' | 'completed' | 'failed' | 'cancelled';

export interface A2AMessage {
  role: string;
  content: string;
}

export interface TaskArtifact {
  type: 'text' | 'json' | 'error';
  content: string;
}

export interface TaskEvent {
  timestamp: string;
  state: TaskState;
  message?: string;
}

export interface A2ATask {
  id: string;
  skill: string;
  state: TaskState;
  input: {
    skill: string;
    messages: A2AMessage[];
    metadata?: Record<string, unknown>;
  };
  artifacts: TaskArtifact[];
  events: TaskEvent[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  owner?: string;
}

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
  };
  skills: AgentSkill[];
  authentication: {
    schemes: string[];
    apiKeyHeader: string;
  };
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
}

// ============ Memory Types ============

export type MemoryType = 'factual' | 'episodic' | 'procedural' | 'semantic' | 'conversation';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: Float32Array;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface VectorSearchHit {
  memoryId: string;
  distance: number;
  score: number;
}

export interface HybridRrfHit {
  memoryId: string;
  vecRank: number | null;
  ftsRank: number | null;
  rrfScore: number;
  vecDistance: number | null;
  ftsScore: number | null;
}

// ============ Voice Types ============

export type CallState = 'idle' | 'ringing' | 'connecting' | 'active' | 'on_hold' | 'ended' | 'failed';

export interface CallSession {
  id: string;
  callerId: string;
  calleeId: string;
  state: CallState;
  mediaType: 'audio' | 'video';
  metadata: Record<string, unknown>;
  createdAt: number;
  iceServers: RTCIceServer[];
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
}

// ============ Security Types ============

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt?: number;
  retryAfterMs?: number;
}

export interface IPBlockResult {
  blocked: boolean;
  reason?: string;
  expiresAt?: string;
}

export interface APIKeyData {
  keyId: string;
  userId?: string;
  permissions: string[];
  createdAt: string;
  lastUsedAt?: string;
  enabled: boolean;
}

// ============ Monitoring Types ============

export interface MetricsSnapshot {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, {
    count: number;
    avg: number;
    min: number;
    max: number;
  }>;
  timestamp: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'critical' | 'unhealthy';
  checks: Array<{
    name: string;
    status: string;
    message: string;
    duration: number;
  }>;
  timestamp: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: string;
}

// ============ Routing Types ============

export type RoutingStrategy = 
  | 'priority'
  | 'weighted'
  | 'round-robin'
  | 'random'
  | 'fill-first'
  | 'least-used'
  | 'cost-optimized'
  | 'p2c'
  | 'reset-aware'
  | 'reset-window'
  | 'headroom'
  | 'strict-random'
  | 'auto'
  | 'lkgp'
  | 'context-optimized'
  | 'cache-optimized'
  | 'context-relay'
  | 'fusion'
  | 'pipeline';

export interface RoutingTarget {
  provider: string;
  model: string;
  priority?: number;
  weight?: number;
  costPerToken?: number;
  maxConcurrency?: number;
  maxContextLength?: number;
  supportsCaching?: boolean;
  capabilities?: string[];
}

export interface RoutingContext {
  loadMap?: Record<string, { load: number }>;
  healthMap?: Record<string, { score: number }>;
  latencyMap?: Record<string, { p50: number }>;
  headroom?: Record<string, number>;
  rateLimitState?: Record<string, { remainingRequests: number; resetAt: number }>;
  lastSuccessMap?: Record<string, number>;
  contextLength?: number;
  lastProvider?: string;
  requiredCapabilities?: string[];
  random?: () => number;
}

// ============ Gamification Types ============

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  xp: number;
  category: string;
}

export interface UserBadge extends Badge {
  userId: string;
  awardedAt: string;
}

export interface UserXP {
  userId: string;
  total: number;
}

export interface UserStreak {
  current: number;
  longest: number;
  lastDate: string | null;
  totalDays: number;
}

export interface LeaderboardEntry {
  userId: string;
  score: number;
  rank: number;
}

// ============ Compliance Types ============

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  userId?: string;
  provider?: string;
  severity?: string;
  details?: Record<string, unknown>;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  effect: 'allow' | 'deny';
  conditions: PolicyCondition[];
  priority: number;
  enabled: boolean;
  createdAt: string;
}

export interface PolicyCondition {
  path: string;
  operator: string;
  value: unknown;
}

// ============ Channel Types ============

export type ChannelType = 'whatsapp' | 'telegram' | 'slack' | 'discord' | 'signal' | 'matrix';

export interface ChannelConfig {
  type: ChannelType;
  enabled: boolean;
  credentials: Record<string, string>;
  webhookUrl?: string;
}

export interface ChannelMessage {
  id: string;
  channel: ChannelType;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============ Plugin Types ============

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  hooks: PluginHook[];
  config: Record<string, unknown>;
}

export interface PluginHook {
  name: string;
  handler: (...args: unknown[]) => unknown;
  priority?: number;
}
