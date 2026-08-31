import { NextResponse } from "next/server";

/**
 * POST /api/search/scrape - Scrape a URL (stub implementation for the studio).
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url : "";

    if (!url.trim()) {
      return NextResponse.json(
        { error: "Missing required field: url" },
        { status: 400 }
      );
    }

    const includeLinks = body.includeLinks !== false;
    const includeImages = body.includeImages === true;
    const rawHtml = body.rawHtml === true;
    const latencyMs = Math.floor(Math.random() * 400) + 200;
    const cost = 0.005;

    const content = rawHtml
      ? `<html>\n  <head>\n    <title>Scraped: ${url}</title>\n  </head>\n  <body>\n    <h1>Content from ${url}</h1>\n    <p>This is simulated raw HTML returned by the scrape stub.</p>\n  </body>\n</html>`
      : `# Scraped: ${url}\n\nThis is simulated **markdown** extraction for the requested URL. The scrape includes the main article text, headings, and structured content ready for LLM ingestion.`;

    const links = includeLinks
      ? [
          { href: `${url}/about`, text: "About" },
          { href: `${url}/contact`, text: "Contact" },
          { href: `${url}/blog`, text: "Blog" },
        ]
      : [];

    const images = includeImages
      ? [
          { src: `${url}/hero.png`, alt: "Hero image" },
          { src: `${url}/diagram.svg`, alt: "Diagram" },
        ]
      : [];

    return NextResponse.json({
      success: true,
      url,
      title: `Page at ${url}`,
      content,
      links,
      images,
      latencyMs,
      cost,
    });
  } catch (error) {
    console.error("Scrape stub error:", error);
    return NextResponse.json(
      { error: "Failed to scrape URL" },
      { status: 500 }
    );
  }
}
