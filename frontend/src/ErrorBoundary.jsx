import React from 'react';

/**
 * Mobile ErrorBoundary to gracefully prevent blank black screens on mobile devices.
 * If any unexpected render exception occurs, it displays a high-contrast recovery view
 * with a one-tap reload button instead of an unmounted blank screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('CampusRide Mobile ErrorBoundary isolated render failure:', error, errorInfo);
  }

  handleReload = () => {
    try {
      this.setState({ hasError: false, error: null });
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch {
      this.setState({ hasError: false, error: null });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#09090B] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-lg mb-4 shadow-sm">
            CR
          </div>
          <h2 className="text-base font-bold text-white mb-2">CampusRide Dashboard Restored</h2>
          <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
            A mobile sensor or display exception was isolated. Tap below to reload your verified campus carpool dashboard.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            Reload Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
