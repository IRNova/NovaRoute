/**
 * Voice API
 * 
 * GET /api/voice — Get voice status
 * POST /api/voice/tts — Text to speech
 * POST /api/voice/stt — Speech to text
 * POST /api/voice/call — Start a call
 * DELETE /api/voice/call/:id — End a call
 */

import { NextResponse } from "next/server";
import { getVoiceSystem } from "@/lib/voice/voiceSystem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/voice
 * Get voice status
 */
export async function GET(request) {
  try {
    const voice = getVoiceSystem();
    const status = voice.getStatus();
    
    return NextResponse.json(status);
  } catch (error) {
    console.error("[Voice API] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/voice
 * Text to speech or Speech to text
 */
export async function POST(request) {
  try {
    const voice = getVoiceSystem();
    const body = await request.json();
    
    const { action, text, audioData, options } = body;
    
    if (action === "tts") {
      if (!text) {
        return NextResponse.json({ error: "text is required for TTS" }, { status: 400 });
      }
      
      const result = await voice.textToSpeech(text, options);
      return NextResponse.json({ result });
    }
    
    if (action === "stt") {
      if (!audioData) {
        return NextResponse.json({ error: "audioData is required for STT" }, { status: 400 });
      }
      
      const result = await voice.speechToText(audioData, options);
      return NextResponse.json({ result });
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Voice API] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
