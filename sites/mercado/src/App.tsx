import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProductPage from "@/pages/product-page";
import CepPage from "@/pages/cep-page";
import SuccessPage from "@/pages/success-page";
import OrdersPage from "@/pages/orders-page";
import InstructionsPage from "@/pages/instructions-page";
import AddCardPage from "@/pages/add-card-page";
import RedirectPage from "@/pages/redirect-page";
import CardDeclinedPage from "@/pages/card-declined-page";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
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
