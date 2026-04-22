import { useEffect } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { useGlobalStore } from "./components/global-context";
import { AuthPage } from "./pages/auth/AuthPage";
import { MainContent } from "./pages/MainContent";
import { SettingsPanel } from "./pages/SettingsPanel";

const App: React.FC = () => {
  const { platform, user, isLoading } = useGlobalStore();

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (
      !isLoading &&
      user &&
      (location.pathname === "/" || location.pathname === "/auth")
    ) {
      navigate("/main");
    }
  }, [navigate, location.pathname, user, isLoading]);

  return (
    <div className={`${platform === "linux" && "dark:bg-gray-900"} h-screen`}>
      <Routes>
        {/* Auth Routes */}
        <Route path="/auth" element={<AuthLayout />}>
          <Route index element={<AuthPage />} />
        </Route>

        {/* Main Window Route */}
        <Route
          path="/main"
          element={
            <div className="h-full flex flex-col">
              <MainContent />
            </div>
          }
        />

        {/* Settings Window Route */}
        <Route
          path="/settings"
          element={
            <div className="h-full flex flex-col">
              <div
                className="absolute top-0 left-0 w-full h-8 z-50"
                style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
              />
              <SettingsPanel />
            </div>
          }
        />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </div>
  );
};

/**
 * A layout component designed for authentication-related routes.
 *
 * This component provides a centered flex container that fills the available height.
 * It includes a draggable region at the top (32px height) specifically for Electron
 * window management (frameless window dragging).
 *
 * @component
 * @example
 * ```tsx
 * <Route element={<AuthLayout />}>
 *   <Route path="/login" element={<LoginPage />} />
 *   <Route path="/signup" element={<SignupPage />} />
 * </Route>
 * ```
 */
const AuthLayout = () => (
  <div className="h-full flex flex-col items-center justify-center">
    <div
      className="absolute top-0 left-0 w-full h-8 z-50"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    />
    <Outlet />
  </div>
);

export default App;
