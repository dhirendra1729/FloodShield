/** Join class names, dropping falsy values. Keeps JSX readable without clsx. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
