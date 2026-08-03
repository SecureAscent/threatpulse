import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard,
  Activity,
  Bug,
  Rss,
  Crosshair,
  Users,
  Radio,
  Package,
  ShieldCheck,
  Ticket,
  Bell,
  Briefcase,
  CheckSquare,
  ShoppingBag,
  Settings,
  Plug,
  KeySquare,
  ListChecks,
  LogOut,
  ChevronDown,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const categories = [
  {
    label: "Overview",
    items: [
      { label: "Command Center", path: "/command-center", icon: Activity },
      { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Threat Intelligence",
    items: [
      { label: "Threat Feed", path: "/threat-feed", icon: Rss },
      { label: "CVE Database", path: "/cve-database", icon: Bug },
      { label: "Blast Radius", path: "/blast-radius", icon: Crosshair },
      { label: "Threat Actors", path: "/threat-actors", icon: Users },
    ],
  },
  {
    label: "Risk & Portfolio",
    items: [
      { label: "Product Portfolio", path: "/product-portfolio", icon: Package },
      { label: "Compliance", path: "/compliance", icon: ShieldCheck },
    ],
  },
  {
    label: "Workflow",
    items: [
      { label: "Jira Tickets", path: "/jira-tickets", icon: Ticket },
      { label: "Notifications", path: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Reports",
    items: [{ label: "Executive Brief", path: "/executive-brief", icon: Briefcase }],
  },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      { label: "Actioned Threats", path: "/actioned-threats", icon: CheckSquare },
      { label: "Admin Console", path: "/admin", icon: Settings },
      { label: "Collector Health", path: "/feeds", icon: Radio },
      { label: "API Keys", path: "/admin/api-keys", icon: KeySquare },
      { label: "Setup Checklist", path: "/admin/setup", icon: ListChecks },
      { label: "Integrations", path: "/integrations", icon: Plug },
      { label: "Create Product", path: "/admin/create-product", icon: ShoppingBag },
    ],
  },
  {
    label: "Store",
    items: [{ label: "ThreatPulse Gear", path: "/shop", icon: ShoppingBag }],
  },
  {
    label: "Settings",
    items: [
      { label: "Security", path: "/settings/security", icon: ShieldCheck },
      { label: "Notification Prefs", path: "/settings/notifications", icon: Bell },
    ],
  },
];

function isActivePath(pathname, path) {
  return pathname === path || (path !== "/admin" && pathname.startsWith(path));
}

function NavSection({ section, collapsed, pathname }) {
  const containsActive = section.items.some((i) => isActivePath(pathname, i.path));
  const [open, setOpen] = useState(containsActive);

  if (collapsed) {
    return (
      <div className="mt-3">
        {section.items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              className={cn(
                "flex items-center justify-center w-9 h-9 mx-auto rounded-lg transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-[10px] uppercase tracking-wider text-sidebar-foreground/55 px-3 py-2 mt-3 hover:text-sidebar-foreground transition-colors"
      >
        <span>{section.label}</span>
        <ChevronDown
          className={cn("w-3 h-3 transition-transform", !open && "-rotate-90")}
        />
      </button>
      {open &&
        section.items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
    </div>
  );
}

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "superadmin";
  const [collapsed, setCollapsed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const visibleCategories = categories.filter((c) => !c.adminOnly || isAdmin);

  const handleLogout = async () => {
    await logout(false);
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={cn(
          "shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-200",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center gap-2 px-4 border-b border-sidebar-border">
          <Logo size={26} />
          {!collapsed && (
            <div className="leading-none">
              <span className="block text-base font-bold tracking-tight text-sidebar-foreground">
                ThreatPulse
              </span>
              <span className="block text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/45 mt-0.5">
                Intelligence
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 overflow-y-auto scrollbar-none">
          {visibleCategories.map((section) => (
            <NavSection
              key={section.label}
              section={section}
              collapsed={collapsed}
              pathname={location.pathname}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border">
          {/* Help */}
          {!collapsed && (
            <div className="px-2">
              <button
                onClick={() => setShowHelp((s) => !s)}
                className="flex items-center justify-between w-full text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground px-3 py-2 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Help
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", !showHelp && "-rotate-90")} />
              </button>
              {showHelp && (
                <div className="pb-1">
                  <Link
                    to="/how-it-works"
                    className="block px-3 py-1.5 text-sm text-sidebar-foreground/65 hover:text-sidebar-foreground rounded-lg hover:bg-sidebar-accent/60"
                  >
                    How It Works
                  </Link>
                  <Link
                    to="/policy"
                    className="block px-3 py-1.5 text-sm text-sidebar-foreground/65 hover:text-sidebar-foreground rounded-lg hover:bg-sidebar-accent/60"
                  >
                    Policy & Procedures
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Action icons */}
          <div className="flex items-center gap-1 px-2 py-2 border-t border-sidebar-border">
            <ThemeToggle />
            <button
              onClick={() => navigate("/policy")}
              title="Settings"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              aria-label="Collapse sidebar"
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}