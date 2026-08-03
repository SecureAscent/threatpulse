import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import Home from '@/pages/Home';
import Shop from '@/pages/Shop';
import Pricing from '@/pages/Pricing';
import CreateProduct from '@/pages/CreateProduct';
import FreePreview from '@/pages/FreePreview';
import Dashboard from '@/pages/Dashboard';
import ActiveIncidents from '@/pages/ActiveIncidents';
import ThreatFeed from '@/pages/ThreatFeed';
import CveDatabase from '@/pages/CveDatabase';
import Policy from '@/pages/Policy';
import Admin from '@/pages/Admin';
import Metrics from '@/pages/Metrics';
import ProductPortfolio from '@/pages/ProductPortfolio';
import ActionedThreats from '@/pages/ActionedThreats';
import HowItWorks from '@/pages/HowItWorks';
import CommandCenter from '@/pages/CommandCenter';
import Threats from '@/pages/Threats';
import ThreatActors from '@/pages/ThreatActors';
import ThreatDetail from '@/pages/ThreatDetail';
import Upload from '@/pages/Upload';
import Feeds from '@/pages/Feeds';
import BlastRadius from '@/pages/BlastRadius';
import Compliance from '@/pages/Compliance';
import JiraTickets from '@/pages/JiraTickets';
import Notifications from '@/pages/Notifications';
import Integrations from '@/pages/Integrations';
import AdminApiKeys from '@/pages/AdminApiKeys';
import AdminSetup from '@/pages/AdminSetup';
import SettingsSecurity from '@/pages/SettingsSecurity';
import SettingsNotifications from '@/pages/SettingsNotifications';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import ContactSales from '@/pages/ContactSales';

const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];
const PUBLIC_ROUTES = ["/", "/shop", "/pricing", "/free", "/contact-sales"];

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (
      authError?.type === "auth_required" &&
      !redirectedRef.current &&
      !AUTH_ROUTES.includes(location.pathname) &&
      !PUBLIC_ROUTES.includes(location.pathname)
    ) {
      redirectedRef.current = true;
      navigateToLogin();
    }
  }, [authError, location.pathname, navigateToLogin]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === "user_not_registered") return <UserNotRegisteredError />;
    if (authError.type === "auth_required") {
      if (!AUTH_ROUTES.includes(location.pathname) && !PUBLIC_ROUTES.includes(location.pathname)) return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/free" element={<FreePreview />} />
      <Route path="/contact-sales" element={<ContactSales />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/command-center" element={<CommandCenter />} />
          <Route path="/active-incidents" element={<ActiveIncidents />} />
          <Route path="/threat-feed" element={<ThreatFeed />} />
          <Route path="/threats" element={<Threats />} />
          <Route path="/threat-actors" element={<ThreatActors />} />
          <Route path="/threats/:id" element={<ThreatDetail />} />
          <Route path="/cve-database" element={<CveDatabase />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/feeds" element={<Feeds />} />
          <Route path="/blast-radius" element={<BlastRadius />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/jira-tickets" element={<JiraTickets />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/executive-brief" element={<Metrics />} />
          <Route path="/product-portfolio" element={<ProductPortfolio />} />
          <Route path="/actioned-threats" element={<ActionedThreats />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/api-keys" element={<AdminApiKeys />} />
          <Route path="/admin/setup" element={<AdminSetup />} />
          <Route path="/admin/create-product" element={<CreateProduct />} />
          <Route path="/settings/security" element={<SettingsSecurity />} />
          <Route path="/settings/notifications" element={<SettingsNotifications />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
