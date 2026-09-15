"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Component } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** What failed, in the user's terms: "the inspector", "this conversation". */
  label: string;
  className?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Contains a render failure to one region. A broken inspector must never take the conversation
 * down with it, and nothing should ever white-screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className={cn("flex flex-col items-start gap-3 p-6 text-sm", this.props.className)}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-danger-soft text-danger">
          <TriangleAlert className="size-4" aria-hidden />
        </span>
        <div>
          <p className="font-medium text-fg">Something went wrong in {this.props.label}.</p>
          <p className="mt-1 text-fg-subtle">
            The rest of the app is still working. Your conversations are saved in this browser.
          </p>
        </div>
        <Button size="sm" onClick={this.reset}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
      </div>
    );
  }
}
