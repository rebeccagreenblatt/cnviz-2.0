import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CNViz render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            color: "#b00020",
          }}
        >
          <h2>Something went wrong</h2>
          <pre
            style={{
              background: "#fff4f4",
              padding: "1rem",
              borderRadius: 4,
              overflow: "auto",
            }}
          >
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })}>Dismiss</button>
        </div>
      );
    }
    return this.props.children;
  }
}
