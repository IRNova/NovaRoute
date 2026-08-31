"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { getProviderIconSrc, markProviderIconMissing } from "@/shared/utils/providerIcon";

function resolveSrc(src, providerId) {
  if (providerId) return getProviderIconSrc(providerId);
  if (!src) return null;
  const m = String(src).match(/^\/providers\/([^/]+)\.png$/i);
  if (m) return getProviderIconSrc(m[1]);
  return src;
}

/** Generate a consistent HSL color from a string (provider name/id). */
function stringToColor(str) {
  if (!str) return "#6366f1";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export default function ProviderIcon({
  src,
  providerId,
  alt,
  size = 32,
  className = "",
  fallbackText = "?",
  fallbackColor,
}) {
  const effectiveSrc = resolveSrc(src, providerId);
  const [srcState, setSrcState] = useState({ current: effectiveSrc, triedSvg: false, errored: false });

  if (!srcState.current || srcState.errored) {
    const bg = fallbackColor || stringToColor(providerId || alt || fallbackText);
    return (
      <span
        className={`inline-flex items-center justify-center font-bold text-white ${className}`.replace(/rounded-lg|rounded-xl|rounded-md|rounded/g, "").trim()}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(10, Math.floor(size * 0.38)),
          borderRadius: "50%",
          backgroundColor: bg,
          flexShrink: 0,
        }}
      >
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      src={srcState.current}
      alt={alt}
      width={size}
      height={size}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        const pngMatch = srcState.current.match(/^\/providers\/([^/]+)\.png$/i);
        const svgMatch = srcState.current.match(/^\/providers\/([^/]+)\.svg$/i);
        // If PNG fails, try SVG; if SVG fails, try PNG — bidirectional fallback.
        if (pngMatch && !srcState.triedSvg) {
          setSrcState({ current: `/providers/${pngMatch[1]}.svg`, triedSvg: true, errored: false });
          return;
        }
        if (svgMatch && !srcState.triedPng) {
          setSrcState({ current: `/providers/${svgMatch[1]}.png`, triedPng: true, errored: false });
          return;
        }
        if (pngMatch) markProviderIconMissing(pngMatch[1]);
        if (svgMatch) markProviderIconMissing(svgMatch[1]);
        if (providerId) markProviderIconMissing(providerId);
        setSrcState((s) => ({ ...s, errored: true }));
      }}
    />
  );
}

ProviderIcon.propTypes = {
  src: PropTypes.string,
  providerId: PropTypes.string,
  alt: PropTypes.string,
  size: PropTypes.number,
  className: PropTypes.string,
  fallbackText: PropTypes.string,
  fallbackColor: PropTypes.string,
};
