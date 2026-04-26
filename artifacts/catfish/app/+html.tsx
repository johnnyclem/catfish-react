/**
 * Root HTML shell for the Expo Router *web* build.
 *
 * The only thing this file fixes that Expo Router's built-in default
 * does NOT is `viewport-fit=cover` on the viewport meta tag. Without
 * that flag, mobile Safari refuses to expose the iOS home-indicator
 * safe area through `env(safe-area-inset-bottom)`, which means
 * `useSafeAreaInsets()` returns 0 on web and our tab bar lands inside
 * the swipe-up gesture zone — buttons become unreliable to tap.
 *
 * `ScrollViewStyleReset` is the documented helper for getting
 * background-color to fill behind notch/home-indicator overscroll
 * areas (otherwise the body's white edges leak through).
 *
 * Native (iOS / Android) ignores this file entirely.
 */
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0a0420" />
        <ScrollViewStyleReset />
        {/* Paint the body so iOS rubber-band overscroll matches the
            in-app navy background instead of flashing white. */}
        <style dangerouslySetInnerHTML={{ __html: BODY_STYLE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BODY_STYLE = `
body { background-color: #0a0420; }
`;
