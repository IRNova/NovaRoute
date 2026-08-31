/**
 * Voice System for NovaRoute
 * 
 * Provides real-time voice support, TTS/STT, and voice calls.
 * Inspired by OpenClaw's voice capabilities.
 */

const { EventEmitter } = require("events");

/**
 * Voice Status
 */
const VoiceStatus = {
  IDLE: "idle",
  LISTENING: "listening",
  PROCESSING: "processing",
  SPEAKING: "speaking",
  CALL_ACTIVE: "call_active",
  ERROR: "error",
};

/**
 * Voice System
 */
class VoiceSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.status = VoiceStatus.IDLE;
    this.ttsProvider = options.ttsProvider || null;
    this.sttProvider = options.sttProvider || null;
    this.voiceProvider = options.voiceProvider || null;
    
    this.activeCalls = new Map();
    this.voiceSessions = new Map();
    
    this.config = {
      language: options.language || "en-US",
      sampleRate: options.sampleRate || 16000,
      channels: options.channels || 1,
      ...options.config,
    };
  }

  /**
   * Initialize voice system
   */
  async init() {
    console.log("[Voice] Initializing voice system...");
    
    // Initialize providers
    if (this.ttsProvider) {
      await this.ttsProvider.init();
    }
    
    if (this.sttProvider) {
      await this.sttProvider.init();
    }
    
    if (this.voiceProvider) {
      await this.voiceProvider.init();
    }
    
    console.log("[Voice] Voice system initialized");
    return true;
  }

  /**
   * Text to Speech
   */
  async textToSpeech(text, options = {}) {
    if (!this.ttsProvider) {
      throw new Error("TTS provider not configured");
    }
    
    this.status = VoiceStatus.SPEAKING;
    this.emit("status", this.status);
    
    try {
      const result = await this.ttsProvider.synthesize(text, {
        language: options.language || this.config.language,
        voice: options.voice,
        speed: options.speed,
        pitch: options.pitch,
      });
      
      this.status = VoiceStatus.IDLE;
      this.emit("status", this.status);
      
      return result;
    } catch (error) {
      this.status = VoiceStatus.ERROR;
      this.emit("status", this.status);
      throw error;
    }
  }

  /**
   * Speech to Text
   */
  async speechToText(audioData, options = {}) {
    if (!this.sttProvider) {
      throw new Error("STT provider not configured");
    }
    
    this.status = VoiceStatus.LISTENING;
    this.emit("status", this.status);
    
    try {
      const result = await this.sttProvider.transcribe(audioData, {
        language: options.language || this.config.language,
        format: options.format || "wav",
      });
      
      this.status = VoiceStatus.IDLE;
      this.emit("status", this.status);
      
      return result;
    } catch (error) {
      this.status = VoiceStatus.ERROR;
      this.emit("status", this.status);
      throw error;
    }
  }

  /**
   * Start voice call
   */
  async startCall(participantId, options = {}) {
    if (!this.voiceProvider) {
      throw new Error("Voice provider not configured");
    }
    
    const callId = `call_${Date.now()}`;
    
    this.activeCalls.set(callId, {
      id: callId,
      participantId,
      status: "connecting",
      startedAt: Date.now(),
      options,
    });
    
    this.status = VoiceStatus.CALL_ACTIVE;
    this.emit("status", this.status);
    
    try {
      const result = await this.voiceProvider.startCall(callId, participantId, options);
      
      const call = this.activeCalls.get(callId);
      if (call) {
        call.status = "active";
        call.streamId = result.streamId;
      }
      
      this.emit("call_started", { callId, participantId });
      
      return { callId, ...result };
    } catch (error) {
      this.activeCalls.delete(callId);
      this.status = VoiceStatus.ERROR;
      this.emit("status", this.status);
      throw error;
    }
  }

  /**
   * End voice call
   */
  async endCall(callId) {
    const call = this.activeCalls.get(callId);
    if (!call) {
      throw new Error(`Call not found: ${callId}`);
    }
    
    try {
      if (this.voiceProvider) {
        await this.voiceProvider.endCall(callId);
      }
      
      this.activeCalls.delete(callId);
      
      if (this.activeCalls.size === 0) {
        this.status = VoiceStatus.IDLE;
        this.emit("status", this.status);
      }
      
      this.emit("call_ended", { callId, duration: Date.now() - call.startedAt });
      
      return { success: true, callId };
    } catch (error) {
      this.status = VoiceStatus.ERROR;
      this.emit("status", this.status);
      throw error;
    }
  }

  /**
   * Send audio in call
   */
  async sendAudio(callId, audioData) {
    const call = this.activeCalls.get(callId);
    if (!call) {
      throw new Error(`Call not found: ${callId}`);
    }
    
    if (!this.voiceProvider) {
      throw new Error("Voice provider not configured");
    }
    
    return await this.voiceProvider.sendAudio(callId, audioData);
  }

  /**
   * Receive audio from call
   */
  onAudio(callback) {
    this.on("audio_received", callback);
  }

  /**
   * Get voice status
   */
  getStatus() {
    return {
      status: this.status,
      activeCalls: this.activeCalls.size,
      calls: Array.from(this.activeCalls.values()),
      config: this.config,
    };
  }

  /**
   * Get active calls
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      status: this.status,
      ttsAvailable: !!this.ttsProvider,
      sttAvailable: !!this.sttProvider,
      voiceAvailable: !!this.voiceProvider,
      activeCalls: this.activeCalls.size,
    };
  }
}

/**
 * TTS Provider Base Class
 */
class TTSProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = options.name || "tts";
    this.config = options.config || {};
  }

  async init() {}
  async synthesize(text, options = {}) {
    throw new Error("synthesize() must be implemented");
  }
}

/**
 * STT Provider Base Class
 */
class STTProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = options.name || "stt";
    this.config = options.config || {};
  }

  async init() {}
  async transcribe(audioData, options = {}) {
    throw new Error("transcribe() must be implemented");
  }
}

/**
 * Voice Provider Base Class
 */
class VoiceProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = options.name || "voice";
    this.config = options.config || {};
  }

  async init() {}
  async startCall(callId, participantId, options = {}) {
    throw new Error("startCall() must be implemented");
  }
  async endCall(callId) {
    throw new Error("endCall() must be implemented");
  }
  async sendAudio(callId, audioData) {
    throw new Error("sendAudio() must be implemented");
  }
}

// Singleton instance
let voiceInstance = null;

/**
 * Get or create Voice System instance
 */
function getVoiceSystem(options = {}) {
  if (!voiceInstance) {
    voiceInstance = new VoiceSystem(options);
  }
  return voiceInstance;
}

module.exports = {
  VoiceSystem,
  VoiceStatus,
  TTSProvider,
  STTProvider,
  VoiceProvider,
  getVoiceSystem,
};
