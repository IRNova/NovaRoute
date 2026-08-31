/**
 * WebRTC Signaling Server for Voice Calls
 * 
 * Handles SDP offers/answers and ICE candidates for peer-to-peer voice calls.
 * Uses WebSocket for signaling transport.
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

// ============ Call States ============

const CallState = {
  IDLE: 'idle',
  RINGING: 'ringing',
  CONNECTING: 'connecting',
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  ENDED: 'ended',
  FAILED: 'failed',
};

// ============ Signaling Server ============

class WebRTCSignaling extends EventEmitter {
  constructor(options = {}) {
    super();
    
    /** @type {Map<string, CallSession>} */
    this.calls = new Map();
    
    /** @type {Map<string, WebSocket>} */
    this.clients = new Map();
    
    /** @type {Map<string, Set<string>>} */
    this.userCalls = new Map(); // userId → Set<callId>
    
    this.iceServers = options.iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    
    this.maxCallDuration = options.maxCallDurationMs || 30 * 60 * 1000; // 30 min
    this.callTimeout = options.callTimeoutMs || 30000; // 30s ring timeout
  }

  /**
   * Register a client WebSocket connection
   * @param {string} userId
   * @param {WebSocket} ws
   */
  registerClient(userId, ws) {
    this.clients.set(userId, ws);
    this.userCalls.set(userId, new Set());
    
    ws.on('close', () => {
      this.clients.delete(userId);
      this.userCalls.delete(userId);
      this._handleClientDisconnect(userId);
    });
    
    this.emit('client:connected', userId);
  }

  /**
   * Handle incoming signaling message
   * @param {string} userId
   * @param {object} message
   */
  async handleMessage(userId, message) {
    const { type, payload } = message;
    
    switch (type) {
      case 'call:initiate':
        return this._handleInitiate(userId, payload);
      case 'call:accept':
        return this._handleAccept(userId, payload);
      case 'call:reject':
        return this._handleReject(userId, payload);
      case 'call:end':
        return this._handleEnd(userId, payload);
      case 'call:ice-candidate':
        return this._handleICECandidate(userId, payload);
      case 'call:sdp-offer':
        return this._handleSDPOffer(userId, payload);
      case 'call:sdp-answer':
        return this._handleSDPAnswer(userId, payload);
      case 'call:hold':
        return this._handleHold(userId, payload);
      case 'call:unhold':
        return this._handleUnhold(userId, payload);
      case 'call:mute':
        return this._handleMute(userId, payload);
      default:
        this._sendTo(userId, { type: 'error', payload: { message: `Unknown message type: ${type}` } });
    }
  }

  /**
   * Initiate a new call
   */
  _handleInitiate(userId, payload) {
    const { targetUserId, mediaType = 'audio', metadata = {} } = payload;
    
    if (!targetUserId) {
      return this._sendTo(userId, { type: 'call:error', payload: { message: 'targetUserId required' } });
    }
    
    const callId = crypto.randomUUID();
    const session = {
      id: callId,
      callerId: userId,
      calleeId: targetUserId,
      state: CallState.RINGING,
      mediaType,
      metadata,
      createdAt: Date.now(),
      iceServers: this.iceServers,
      offer: null,
      answer: null,
      iceCandidates: { caller: [], callee: [] },
    };
    
    this.calls.set(callId, session);
    this.userCalls.get(userId)?.add(callId);
    this.userCalls.get(targetUserId)?.add(callId);
    
    // Notify callee
    this._sendTo(targetUserId, {
      type: 'call:incoming',
      payload: {
        callId,
        callerId: userId,
        mediaType,
        metadata,
      },
    });
    
    // Auto-timeout ringing
    setTimeout(() => {
      const call = this.calls.get(callId);
      if (call && call.state === CallState.RINGING) {
        this._endCall(callId, CallState.FAILED, 'Ring timeout');
      }
    }, this.callTimeout);
    
    this.emit('call:initiated', { callId, callerId: userId, calleeId: targetUserId });
    
    return this._sendTo(userId, {
      type: 'call:initiated',
      payload: { callId, calleeId: targetUserId },
    });
  }

  /**
   * Accept a call
   */
  _handleAccept(userId, payload) {
    const { callId } = payload;
    const call = this.calls.get(callId);
    
    if (!call) {
      return this._sendTo(userId, { type: 'call:error', payload: { message: 'Call not found' } });
    }
    
    if (call.calleeId !== userId) {
      return this._sendTo(userId, { type: 'call:error', payload: { message: 'Not your call' } });
    }
    
    call.state = CallState.CONNECTING;
    
    // Notify caller
    this._sendTo(call.callerId, {
      type: 'call:accepted',
      payload: { callId, iceServers: call.iceServers },
    });
    
    this.emit('call:accepted', { callId, callerId: call.callerId, calleeId: userId });
  }

  /**
   * Reject a call
   */
  _handleReject(userId, payload) {
    const { callId } = payload;
    const call = this.calls.get(callId);
    
    if (!call) return;
    
    this._endCall(callId, CallState.ENDED, 'Rejected by callee');
    this.emit('call:rejected', { callId, callerId: call.callerId, calleeId: userId });
  }

  /**
   * End an active call
   */
  _handleEnd(userId, payload) {
    const { callId } = payload;
    const call = this.calls.get(callId);
    
    if (!call) return;
    
    this._endCall(callId, CallState.ENDED, 'Ended by ' + userId);
    this.emit('call:ended', { callId, duration: Date.now() - call.createdAt });
  }

  /**
   * Handle SDP offer
   */
  _handleSDPOffer(userId, payload) {
    const { callId, sdp } = payload;
    const call = this.calls.get(callId);
    
    if (!call) return;
    
    call.offer = sdp;
    
    // Forward to the other party
    const target = call.callerId === userId ? call.calleeId : call.callerId;
    this._sendTo(target, {
      type: 'call:sdp-offer',
      payload: { callId, sdp },
    });
  }

  /**
   * Handle SDP answer
   */
  _handleSDPAnswer(userId, payload) {
    const { callId, sdp } = payload;
    const call = this.calls.get(callId);
    
    if (!call) return;
    
    call.answer = sdp;
    call.state = CallState.ACTIVE;
    
    // Forward to the other party
    const target = call.callerId === userId ? call.calleeId : call.callerId;
    this._sendTo(target, {
      type: 'call:sdp-answer',
      payload: { callId, sdp },
    });
    
    this.emit('call:active', { callId });
    
    // Auto-end after max duration
    setTimeout(() => {
      const c = this.calls.get(callId);
      if (c && c.state === CallState.ACTIVE) {
        this._endCall(callId, CallState.ENDED, 'Max duration reached');
      }
    }, this.maxCallDuration);
  }

  /**
   * Handle ICE candidate
   */
  _handleICECandidate(userId, payload) {
    const { callId, candidate } = payload;
    const call = this.calls.get(callId);
    
    if (!call) return;
    
    const target = call.callerId === userId ? call.calleeId : call.callerId;
    this._sendTo(target, {
      type: 'call:ice-candidate',
      payload: { callId, candidate },
    });
  }

  /**
   * Hold/unhold/mute
   */
  _handleHold(userId, payload) {
    const { callId } = payload;
    const call = this.calls.get(callId);
    if (!call) return;
    
    call.state = CallState.ON_HOLD;
    const target = call.callerId === userId ? call.calleeId : call.callerId;
    this._sendTo(target, { type: 'call:on-hold', payload: { callId } });
  }

  _handleUnhold(userId, payload) {
    const { callId } = payload;
    const call = this.calls.get(callId);
    if (!call) return;
    
    call.state = CallState.ACTIVE;
    const target = call.callerId === userId ? call.calleeId : call.callerId;
    this._sendTo(target, { type: 'call:unhold', payload: { callId } });
  }

  _handleMute(userId, payload) {
    const { callId, muted } = payload;
    const call = this.calls.get(callId);
    if (!call) return;
    
    const target = call.callerId === userId ? call.calleeId : call.callerId;
    this._sendTo(target, { type: 'call:muted', payload: { callId, userId, muted } });
  }

  /**
   * End a call and clean up
   */
  _endCall(callId, state, reason) {
    const call = this.calls.get(callId);
    if (!call) return;
    
    call.state = state;
    
    // Notify both parties
    this._sendTo(call.callerId, {
      type: 'call:ended',
      payload: { callId, state, reason, duration: Date.now() - call.createdAt },
    });
    this._sendTo(call.calleeId, {
      type: 'call:ended',
      payload: { callId, state, reason, duration: Date.now() - call.createdAt },
    });
    
    // Clean up
    this.userCalls.get(call.callerId)?.delete(callId);
    this.userCalls.get(call.calleeId)?.delete(callId);
    this.calls.delete(callId);
  }

  /**
   * Handle client disconnect
   */
  _handleClientDisconnect(userId) {
    const callIds = this.userCalls.get(userId) || new Set();
    for (const callId of callIds) {
      this._endCall(callId, CallState.ENDED, 'User disconnected');
    }
  }

  /**
   * Send message to a client
   */
  _sendTo(userId, message) {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get active calls for a user
   */
  getUserCalls(userId) {
    const callIds = this.userCalls.get(userId) || new Set();
    return [...callIds].map(id => this.calls.get(id)).filter(Boolean);
  }

  /**
   * Get call stats
   */
  stats() {
    return {
      activeCalls: this.calls.size,
      connectedClients: this.clients.size,
      callsByState: Object.values(CallState).reduce((acc, state) => {
        acc[state] = [...this.calls.values()].filter(c => c.state === state).length;
        return acc;
      }, {}),
    };
  }
}

// Singleton
let _instance = null;

function getSignalingServer(options) {
  if (!_instance) {
    _instance = new WebRTCSignaling(options);
  }
  return _instance;
}

module.exports = { WebRTCSignaling, CallState, getSignalingServer };
