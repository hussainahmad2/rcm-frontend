import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth';
import HomePage from '@/pages/home/HomePage';
import DemoPage from '@/pages/demo/DemoPage';
import LoginPage from '@/pages/login/LoginPage';
import ForgotPasswordPage from '@/pages/login/ForgotPasswordPage';
import SignUpPage from '@/pages/login/SignUpPage';
import ContactAdminPage from '@/pages/login/ContactAdminPage';
import WorkspacePage from '@/pages/workspace/WorkspacePage';
import NotFoundPage from '@/pages/not-found/NotFoundPage';
import './App.css';

const queryClient = new QueryClient();

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/demo" component={DemoPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/signup" component={SignUpPage} />
        <Route path="/contact-admin" component={ContactAdminPage} />
        <Route path="/workspace" component={WorkspacePage} />
        <Route component={NotFoundPage} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
