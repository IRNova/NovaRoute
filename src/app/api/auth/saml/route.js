/**
 * SAML Authentication API
 * 
 * Handles SAML SSO login flow:
 * - GET /api/auth/saml — Initiate SSO login
 * - POST /api/auth/saml/callback — Handle SSO callback
 * - POST /api/auth/saml/logout — Initiate SSO logout
 */

import { NextResponse } from "next/server";
import { 
  isSamlConfigured, 
  generateAuthRequest, 
  parseSamlResponse,
  generateLogoutRequest 
} from "@/lib/auth/saml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/saml
 * Initiate SAML SSO login
 */
export async function GET(request) {
  try {
    if (!isSamlConfigured()) {
      return NextResponse.json(
        { error: "SAML is not configured" },
        { status: 400 }
      );
    }

    const { redirectUrl, id } = generateAuthRequest();
    
    // Store request ID in session for validation
    // In production, use a secure session store
    
    return NextResponse.json({
      redirectUrl,
      requestId: id,
    });
  } catch (error) {
    console.error("[SAML] GET error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/saml/callback
 * Handle SAML SSO callback
 */
export async function POST(request) {
  try {
    if (!isSamlConfigured()) {
      return NextResponse.json(
        { error: "SAML is not configured" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { SAMLResponse } = body;

    if (!SAMLResponse) {
      return NextResponse.json(
        { error: "No SAML response provided" },
        { status: 400 }
      );
    }

    // Parse SAML response
    const result = parseSamlResponse(SAMLResponse);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    // Create or find user
    const { email, attributes } = result;
    
    // In production, create session and set cookie
    // For now, return user info
    
    return NextResponse.json({
      success: true,
      user: {
        email,
        name: attributes.displayName || attributes.cn || email.split("@")[0],
        attributes,
      },
      sessionIndex: result.sessionIndex,
    });
  } catch (error) {
    console.error("[SAML] POST error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/saml
 * SAML SSO logout
 */
export async function DELETE(request) {
  try {
    if (!isSamlConfigured()) {
      return NextResponse.json(
        { error: "SAML is not configured" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const nameId = searchParams.get("nameId");
    const sessionIndex = searchParams.get("sessionIndex");

    if (!nameId) {
      return NextResponse.json(
        { error: "nameId is required" },
        { status: 400 }
      );
    }

    const { redirectUrl } = generateLogoutRequest(nameId, sessionIndex);
    
    return NextResponse.json({
      redirectUrl,
    });
  } catch (error) {
    console.error("[SAML] DELETE error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
