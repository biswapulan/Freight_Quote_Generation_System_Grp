import { Component } from "react";

/**
 * Catches a crash in the screen below it and says what went wrong.
 *
 * Without one, any error thrown while rendering, or inside an effect, unmounts
 * the entire app and leaves a blank white page with nothing to click and no
 * clue as to why. With one, the rest of the app stays up and the error is on
 * screen, so it can be reported and fixed.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Screen crashed:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Moving to another screen gives it a clean start.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  reset() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          maxWidth: 560,
          margin: "48px auto",
          padding: "24px 28px",
          background: "#fff",
          border: "1px solid #fecaca",
          borderRadius: 12,
          boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#0f172a" }}>
          This screen ran into a problem
        </h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
          The rest of FreightAI is still working. Try again, or reload the page if it keeps
          happening.
        </p>
        <pre
          style={{
            margin: "0 0 18px",
            padding: "10px 12px",
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: 8,
            fontSize: 12.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {error?.message || String(error)}
        </pre>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn-orange-primary" onClick={this.reset}>
            Try again
          </button>
          <button
            type="button"
            className="btn-secondary-light"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
