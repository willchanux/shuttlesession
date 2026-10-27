
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { PointerEventsGuard } from "./components/PointerEventsGuard";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import SplashScreen from "./pages/SplashScreen";
import LandingPage from "./pages/LandingPage";
import Tournament from "./pages/Tournament";
import { TournamentSetup } from "./pages/TournamentSetup";
import { TournamentPairSetup } from "./pages/TournamentPairSetup";
import TournamentGroups from "./pages/TournamentGroups";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PointerEventsGuard />
        <Routes>
          {/* Landing page as the root */}
          <Route path="/" element={<LandingPage />} />

          {/* Group all main app routes under /app */}
          <Route path="/app">
            {/* Splash screen as /app route by default */}
            <Route index element={<SplashScreen />} />
            {/* Main app session routes */}
            <Route path="session" element={<AppLayout><Dashboard /></AppLayout>} />
            <Route path="members" element={<AppLayout><Members /></AppLayout>} />
            <Route path="settings" element={<AppLayout><Settings /></AppLayout>} />
            {/* Tournament routes - independent of AppLayout */}
            <Route path="tournament" element={<Tournament />} />
            <Route path="tournament/setup" element={<TournamentSetup />} />
            <Route path="tournament/setup/pairs" element={<TournamentPairSetup />} />
            <Route path="tournament/groups" element={<TournamentGroups />} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
