import type { CSSProperties } from "react";

import { ufrenBrandPalette } from "@ufren/shared";

export const brandTheme = {
  appShell: {
    backgroundColor: ufrenBrandPalette.appBackground,
    color: ufrenBrandPalette.textPrimary,
    fontFamily: "Segoe UI, sans-serif",
    margin: "0 auto",
    maxWidth: 1080,
    minHeight: "100vh",
    padding: 24
  } satisfies CSSProperties,
  heroCard: {
    background:
      "linear-gradient(120deg, rgba(78,155,255,0.2) 0%, rgba(20,40,84,0.9) 55%, rgba(12,22,46,0.96) 100%)",
    border: `1px solid ${ufrenBrandPalette.panelBorder}`,
    borderRadius: 14,
    marginBottom: 18,
    padding: 20
  } satisfies CSSProperties,
  panel: {
    backgroundColor: ufrenBrandPalette.panelBackground,
    border: `1px solid ${ufrenBrandPalette.panelBorder}`,
    borderRadius: 12,
    display: "grid",
    gap: 12,
    marginBottom: 16,
    padding: 16
  } satisfies CSSProperties,
  panelTitle: {
    color: ufrenBrandPalette.accentStrong,
    fontSize: 18,
    fontWeight: 650,
    margin: 0
  } satisfies CSSProperties,
  dimText: {
    color: ufrenBrandPalette.textSecondary
  } satisfies CSSProperties,
  button: {
    backgroundColor: "#183160",
    border: `1px solid ${ufrenBrandPalette.panelBorder}`,
    borderRadius: 8,
    color: ufrenBrandPalette.textPrimary,
    cursor: "pointer",
    fontSize: 13,
    minWidth: 96,
    padding: "8px 14px"
  } satisfies CSSProperties,
  successText: {
    color: ufrenBrandPalette.success
  } satisfies CSSProperties,
  errorText: {
    color: ufrenBrandPalette.error
  } satisfies CSSProperties,
  codeBlock: {
    backgroundColor: "#0B1226",
    border: `1px solid ${ufrenBrandPalette.panelBorder}`,
    borderRadius: 8,
    color: "#BDCBF8",
    fontSize: 12,
    lineHeight: 1.45,
    margin: 0,
    maxHeight: 320,
    overflow: "auto",
    padding: 12
  } satisfies CSSProperties
};
