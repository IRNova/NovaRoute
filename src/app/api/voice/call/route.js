/**
 * Voice Call API — /api/voice/call
 * 
 * REST endpoints for managing voice calls.
 * WebSocket signaling is handled separately by the signaling server.
 */

const { getSignalingServer, CallState } = require('@/lib/voice/webrtcSignaling');

// GET — List active calls
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  
  const signaling = getSignalingServer();
  
  if (userId) {
    const calls = signaling.getUserCalls(userId);
    return Response.json({ calls, stats: signaling.stats() });
  }
  
  return Response.json({ stats: signaling.stats() });
}

// POST — Initiate a call (alternative to WebSocket)
export async function POST(req) {
  try {
    const body = await req.json();
    const { callerId, calleeId, mediaType = 'audio' } = body;
    
    if (!callerId || !calleeId) {
      return Response.json(
        { error: 'callerId and calleeId required' },
        { status: 400 }
      );
    }
    
    const signaling = getSignalingServer();
    const callId = require('crypto').randomUUID();
    
    // Create call session
    const session = {
      id: callId,
      callerId,
      calleeId,
      state: CallState.RINGING,
      mediaType,
      createdAt: Date.now(),
    };
    
    signaling.calls.set(callId, session);
    
    return Response.json({
      callId,
      state: CallState.RINGING,
      iceServers: signaling.iceServers,
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}

// DELETE — End a call
export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const callId = searchParams.get('callId');
  
  if (!callId) {
    return Response.json({ error: 'callId required' }, { status: 400 });
  }
  
  const signaling = getSignalingServer();
  const call = signaling.calls.get(callId);
  
  if (!call) {
    return Response.json({ error: 'Call not found' }, { status: 404 });
  }
  
  signaling._endCall(callId, CallState.ENDED, 'Ended via API');
  
  return Response.json({ success: true, callId });
}
