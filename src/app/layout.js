import { cookies } from "next/headers";
import { Inter, Vazirmatn } from "next/font/google";
import "material-symbols/outlined.css";
import "./globals.css";
import { ThemeProvider } from "@/shared/components/ThemeProvider";
import "@/lib/network/initOutboundProxy"; // Auto-initialize outbound proxy env
import "@/shared/services/bootstrap"; // Auto-run initializeApp (watchdog, auto-resume tunnel)
import { initConsoleLogCapture } from "@/lib/consoleLogBuffer";
import { RuntimeI18nProvider } from "@/i18n/RuntimeI18nProvider";
import { THEME_CONFIG } from "@/shared/constants/config";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isRtlLocale,
  normalizeLocale,
} from "@/i18n/config";

// Hook console immediately at module load time (server-side only, runs once)
initConsoleLogCapture();

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Vazirmatn — default UI font (Persian-first). Kept alongside Inter as latin fallback.
const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazir",
  display: "swap",
});

export const metadata = {
  title: "NovaRoute - AI Infrastructure Management",
  description: "One endpoint for all your AI providers. Manage keys, monitor usage, and scale effortlessly.",
  icons: {
    icon: "/favicon.svg",
    apple: "/logo.png",
  },
};

// Match the painted surface in each theme so the mobile browser chrome does not
// fight the page. Values track --bg in src/app/globals.css.
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#05060a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

// Runs before first paint, so the page never flashes the wrong theme.
// Reads the same zustand-persist record the store writes:
//   localStorage["theme"] = {"state":{"theme":"dark"},"version":0}
// Kept dependency-free and wrapped in try/catch: if anything here throws the
// page must still render, just with the default theme.
const THEME_BOOTSTRAP = `(function(){try{
var d=${JSON.stringify(THEME_CONFIG.defaultTheme)};
var t=d,raw=localStorage.getItem(${JSON.stringify(THEME_CONFIG.storageKey)});
if(raw){var p=JSON.parse(raw);var s=(p&&p.state&&p.state.theme)||(typeof p==="string"?p:null);if(s)t=s;}
var dark=t==="system"?matchMedia("(prefers-color-scheme: dark)").matches:t!=="light";
document.documentElement.classList.toggle("dark",dark);
}catch(e){document.documentElement.classList.add("dark");}})();`;

const FONTS_READY = `if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){document.documentElement.classList.add('fonts-loaded')})}else{document.documentElement.classList.add('fonts-loaded')}`;

export default async function RootLayout({ children }) {
  // Follow the persisted locale instead of hardcoding Farsi. The runtime i18n
  // layer re-applies dir/lang on the client when the locale changes; this makes
  // the server render agree with it on first paint.
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value || DEFAULT_LOCALE);
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${inter.variable} ${vazirmatn.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <script dangerouslySetInnerHTML={{ __html: FONTS_READY }} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <script dangerouslySetInnerHTML={{ __html: `if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})}` }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <RuntimeI18nProvider>
            {children}
          </RuntimeI18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
