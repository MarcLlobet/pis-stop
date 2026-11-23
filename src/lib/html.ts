const ENTITIES: Readonly<Record<string, string>> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
};

/** Escapes text for safe interpolation into HTML/SVG markup strings. */
export const escapeHtml = (text: string): string =>
  text.replace(/[<>&'"]/g, (char) => ENTITIES[char] ?? char);
