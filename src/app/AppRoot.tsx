import App from "@/App";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function AppRoot() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ErrorBoundary>
  );
}
