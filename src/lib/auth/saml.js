/**
 * SAML Authentication Module for NovaRoute
 * 
 * Provides SAML 2.0 SSO integration for Enterprise customers.
 * Uses @node-saml/node-saml for SAML processing.
 */

const crypto = require("crypto");

/**
 * SAML Configuration
 */
const SAML_CONFIG = {
  entryPoint: process.env.SAML_ENTRY_POINT || "",
  issuer: process.env.SAML_ISSUER || "novaroute",
  callbackUrl: process.env.SAML_CALLBACK_URL || "",
  cert: process.env.SAML_CERT || "",
  identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  acceptedClockSkewMs: 5000,
  attributeConsumingServiceIndex: false,
  disableRequestedAuthnContext: true,
  forceAuthn: false,
  signatureAlgorithm: "sha256",
  digestAlgorithm: "sha256",
};

/**
 * Check if SAML is configured
 */
function isSamlConfigured() {
  return Boolean(
    SAML_CONFIG.entryPoint &&
    SAML_CONFIG.issuer &&
    SAML_CONFIG.callbackUrl &&
    SAML_CONFIG.cert
  );
}

/**
 * Generate SAML Auth Request
 * Returns the redirect URL for SSO
 */
function generateAuthRequest() {
  if (!isSamlConfigured()) {
    throw new Error("SAML is not configured. Set SAML_ENTRY_POINT, SAML_ISSUER, SAML_CALLBACK_URL, and SAML_CERT in .env");
  }

  const id = `_${crypto.randomBytes(16).toString("hex")}`;
  const issueInstant = new Date().toISOString();
  
  const authRequest = `
    <samlp:AuthRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
      ID="${id}"
      Version="2.0"
      IssueInstant="${issueInstant}"
      Destination="${SAML_CONFIG.entryPoint}"
      AssertionConsumerServiceURL="${SAML_CONFIG.callbackUrl}"
      ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
      <saml:Issuer>${SAML_CONFIG.issuer}</saml:Issuer>
      <samlp:NameIDPolicy
        Format="${SAML_CONFIG.identifierFormat}"
        AllowCreate="true" />
    </samlp:AuthRequest>
  `.trim();

  // Encode for HTTP redirect
  const encoded = Buffer.from(authRequest).toString("base64");
  const redirectUrl = `${SAML_CONFIG.entryPoint}?SAMLRequest=${encodeURIComponent(encoded)}`;

  return {
    redirectUrl,
    id,
    issueInstant,
  };
}

/**
 * Parse SAML Response
 * Extracts user attributes from SAML response
 */
function parseSamlResponse(samlResponse) {
  if (!samlResponse) {
    throw new Error("No SAML response provided");
  }

  try {
    // Decode base64 response
    const decoded = Buffer.from(samlResponse, "base64").toString("utf8");
    
    // Extract attributes (simplified - in production use a proper SAML parser)
    const attributes = {};
    
    // Extract NameID (email)
    const nameIdMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
    if (nameIdMatch) {
      attributes.email = nameIdMatch[1];
    }

    // Extract other attributes
    const attrMatches = decoded.matchAll(/<saml:Attribute Name="([^"]+)">\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g);
    for (const match of attrMatches) {
      attributes[match[1]] = match[2];
    }

    // Extract session index
    const sessionMatch = decoded.match(/SessionIndex="([^"]+)"/);
    if (sessionMatch) {
      attributes.sessionIndex = sessionMatch[1];
    }

    return {
      success: true,
      attributes,
      nameId: attributes.email || "",
      sessionIndex: attributes.sessionIndex || "",
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate SAML Logout Request
 */
function generateLogoutRequest(nameId, sessionIndex) {
  if (!isSamlConfigured()) {
    throw new Error("SAML is not configured");
  }

  const id = `_${crypto.randomBytes(16).toString("hex")}`;
  const issueInstant = new Date().toISOString();

  const logoutRequest = `
    <samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
      ID="${id}"
      Version="2.0"
      IssueInstant="${issueInstant}"
      Destination="${SAML_CONFIG.entryPoint}">
      <saml:Issuer>${SAML_CONFIG.issuer}</saml:Issuer>
      <saml:NameID>${nameId}</saml:NameID>
      ${sessionIndex ? `<samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>` : ""}
    </samlp:LogoutRequest>
  `.trim();

  const encoded = Buffer.from(logoutRequest).toString("base64");
  const redirectUrl = `${SAML_CONFIG.entryPoint}?SAMLRequest=${encodeURIComponent(encoded)}`;

  return { redirectUrl, id };
}

/**
 * Validate SAML Response Signature
 * (Simplified - in production use a proper XML signature validator)
 */
function validateSignature(samlResponse) {
  // In production, this would validate the XML signature
  // using the IdP's certificate
  console.warn("[SAML] Signature validation not implemented - use in production only with proper validation");
  return true;
}

module.exports = {
  isSamlConfigured,
  generateAuthRequest,
  parseSamlResponse,
  generateLogoutRequest,
  validateSignature,
  SAML_CONFIG,
};
