import App from "@/App";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAppBootSplash } from "@/hooks/useAppBootSplash";

export function AppRoot() {
  useAppBootSplash();

  return (
    <ErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ErrorBoundary>
  );
}
