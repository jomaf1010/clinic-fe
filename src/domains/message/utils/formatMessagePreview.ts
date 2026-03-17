/**
 * Strips [@patient:UUID:Name] mention markers to just the patient name
 * for use in previews, notifications, and other plain-text contexts.
 */
export function formatMessagePreview(body: string): string {
  return body.replace(/\[@patient:[^:]+:([^\]]+)\]/g, '$1')
}
