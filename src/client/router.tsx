import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { RequireAuth } from "./App";
import { AnalysisDetailPage } from "./pages/AnalysisDetailPage";
import { AnalysesPage } from "./pages/AnalysesPage";
import { AnalyzePage } from "./pages/AnalyzePage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { RulesPage } from "./pages/RulesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { VendorDetailPage } from "./pages/VendorDetailPage";
import { VendorsPage } from "./pages/VendorsPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/analyze", element: <AnalyzePage /> },
          { path: "/analyses", element: <AnalysesPage /> },
          { path: "/analyses/:id", element: <AnalysisDetailPage /> },
          { path: "/vendors", element: <VendorsPage /> },
          { path: "/vendors/:id", element: <VendorDetailPage /> },
          { path: "/rules", element: <RulesPage /> },
          { path: "/settings", element: <SettingsPage /> },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
