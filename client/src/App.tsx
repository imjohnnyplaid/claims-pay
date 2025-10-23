import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Onboarding from "@/pages/onboarding";
import ProviderDashboard from "@/pages/provider/dashboard";
import NewClaim from "@/pages/provider/new-claim";
import ClaimsList from "@/pages/provider/claims-list";
import ProviderSettings from "@/pages/provider/settings";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminHome from "@/pages/admin/home";
import AdminCoding from "@/pages/admin/coding";
import AdminTransactions from "@/pages/admin/transactions";
import AdminSystemStatus from "@/pages/admin/system-status";
import AdminReports from "@/pages/admin/reports";
import AdminTesting from "@/pages/admin/testing";
import AdminUsers from "@/pages/admin/users";
import AdminCustomers from "@/pages/admin/customers";
import AdminFundingSources from "@/pages/admin/funding-sources";
import BankDashboard from "@/pages/bank/dashboard";
import BankUsers from "@/pages/bank/users";
import BankProviders from "@/pages/bank/providers";
import BankOnboarding from "@/pages/bank/onboarding";
import InvitationAccept from "@/pages/invitation-accept";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/invitation/accept" component={InvitationAccept} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/bank/onboarding" component={BankOnboarding} />
      <Route path="/provider/dashboard" component={ProviderDashboard} />
      <Route path="/provider/claims/new" component={NewClaim} />
      <Route path="/provider/claims" component={ClaimsList} />
      <Route path="/claims">
        <Redirect to="/provider/claims" />
      </Route>
      <Route path="/provider/settings" component={ProviderSettings} />
      <Route path="/admin/dashboard">
        <Redirect to="/admin/home" />
      </Route>
      <Route path="/admin/home" component={AdminHome} />
      <Route path="/admin/coding" component={AdminCoding} />
      <Route path="/admin/transactions" component={AdminTransactions} />
      <Route path="/admin/providers" component={AdminCustomers} />
      <Route path="/admin/banks" component={AdminFundingSources} />
      <Route path="/admin/system-status" component={AdminSystemStatus} />
      <Route path="/admin/reports" component={AdminReports} />
      <Route path="/admin/testing" component={AdminTesting} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/customers">
        <Redirect to="/admin/providers" />
      </Route>
      <Route path="/admin/funding-sources">
        <Redirect to="/admin/banks" />
      </Route>
      <Route path="/bank/dashboard" component={BankDashboard} />
      <Route path="/bank/providers" component={BankProviders} />
      <Route path="/bank/users" component={BankUsers} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
