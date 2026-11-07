import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProductPage from "@/pages/product-page";
const CepPage = lazy(() => import("@/pages/cep-page"));
const SuccessPage = lazy(() => import("@/pages/success-page"));
const OrdersPage = lazy(() => import("@/pages/orders-page"));
const InstructionsPage = lazy(() => import("@/pages/instructions-page"));
const AddCardPage = lazy(() => import("@/pages/add-card-page"));
const RedirectPage = lazy(() => import("@/pages/redirect-page"));
const CardDeclinedPage = lazy(() => import("@/pages/card-declined-page"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient();

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" role="status" aria-label="Carregando" />}>
    <Switch>
      <Route path="/r" component={RedirectPage} />
      <Route path="/" component={ProductPage} />
      <Route path="/cep" component={CepPage} />
      <Route path="/success" component={SuccessPage} />
      <Route path="/orders" component={OrdersPage} />
      <Route path="/instructions" component={InstructionsPage} />
      <Route path="/add-card" component={AddCardPage} />
      <Route path="/card-declined" component={CardDeclinedPage} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
