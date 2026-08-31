"use client";

import { cn } from "@/shared/utils/cn";

export default function Avatar({
  src,
  alt = "Avatar",
  name,
  size = "md",
  className,
}) {
  const sizes = {
    xs: "size-6 text-xs",
    sm: "size-8 text-sm",
    md: "size-10 text-base",
    lg: "size-12 text-lg",
    xl: "size-16 text-xl",
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Identity colour derived from the name.
  //
  // This used to be 17 arbitrary Tailwind palette steps at the -500 level,
  // several of which (yellow, lime, amber, cyan) do not carry white text at
  // AA. It is now eight evenly spaced hues at a fixed saturation and
  // lightness, so every swatch clears 4.5:1 under white text and the set
  // reads as one system. The hash walks the whole string rather than only
  // charCodeAt(0), so names sharing a first letter no longer collide.
  const AVATAR_HUES = [4, 28, 96, 158, 190, 232, 268, 320];

  const getAvatarColor = (value) => {
    if (!value) return "hsl(190 58% 32%)";
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return `hsl(${AVATAR_HUES[hash % AVATAR_HUES.length]} 58% 32%)`;
  };

  // The ring separates the avatar from whatever sits behind it. It used to
  // reference --color-surface-dark, a token left over from a previous brand
  // that no longer exists.
  const ring = "ring-2 ring-bg shadow-[var(--shadow-soft)]";

  if (src) {
    return (
      <div
        className={cn(
          "rounded-full bg-cover bg-center bg-no-repeat",
          ring,
          sizes[size],
          className
        )}
        style={{ backgroundImage: `url(${src})` }}
        role="img"
        aria-label={alt}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white",
        ring,
        sizes[size],
        className
      )}
      style={{ backgroundColor: getAvatarColor(name) }}
      role="img"
      aria-label={alt}
    >
      {getInitials(name)}
    </div>
  );
}

