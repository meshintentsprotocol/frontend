import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
    /** What failed, for the message: "Addresses", "Wallet". */
    label?: string;
    /** Called by "Try again" before the children render again (e.g. go back to a safe view). */
    onReset?: () => void;
}

interface State {
    error: Error | null;
}

/**
 * Keeps a render error inside the panel it came from. Without one, React unmounts
 * the whole tree and the app goes blank.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info.componentStack);
    }

    reset = () => {
        this.props.onReset?.();
        this.setState({ error: null });
    };

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-6 text-center">
                <AlertTriangle className="h-6 w-6 text-red-300/80" />
                <p className="text-sm font-semibold text-white/85">
                    {this.props.label ? `${this.props.label} could not be shown` : 'Something went wrong'}
                </p>
                <p className="max-w-[280px] break-words text-[11px] text-white/45">{this.state.error.message}</p>
                <button
                    type="button"
                    onClick={this.reset}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/[0.1]"
                >
                    <RotateCcw className="h-3.5 w-3.5" /> Try again
                </button>
            </div>
        );
    }
}
