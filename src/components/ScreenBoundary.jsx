import React from "react";
import LoadingScreen from "./LoadingScreen";

// A failed optional download after a deployment must leave a usable recovery
// screen. Reload remains an explicit action, including during PWA updates.
export default class ScreenBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { console.warn("[jishoo-screen] Screen could not be opened"); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="screen-recovery" role="alert"><LoadingScreen message="این صفحه کامل باز نشد. اتصال اینترنتت رو بررسی کن و دوباره بازش کن.">
      <button className="loading-retry" onClick={() => location.reload()}>دوباره باز کن</button>
    </LoadingScreen></div>;
  }
}
