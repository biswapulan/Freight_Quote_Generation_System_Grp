/**
 * One alert as a line of text.
 *
 * The AI analysis sends alerts as sentences, but a weather alert can also
 * arrive as a record ({ alert_type, severity, title, message }). Drawn as-is,
 * a record crashes the screen (React error #31), so every alert list renders
 * through this.
 */
export function alertText(alert) {
  if (alert == null) return "";
  if (typeof alert === "string") return alert;
  if (typeof alert === "object") {
    const title = String(alert.title || "").trim();
    const message = String(alert.message || "").trim();
    if (title && message) return `${title}: ${message}`;
    return title || message || String(alert.alert_type || "");
  }
  return String(alert);
}
