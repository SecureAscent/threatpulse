import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X as XIcon } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard,
  Activity,
  Bug,
  Rss,
  Crosshair,
  Users,
  Radio,
  BarChart3,
  Network,
  Package,
  ShieldCheck,
  Ticket,
  Bell,
  Briefcase,
  Eye,
  Target,
  CheckSquare,
  Settings,
  Plug,
  KeySquare,
  Building2,
  Clock,
  ListChecks,
  LogOut,
  ChevronDown,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  ClipboardList,
  ClipboardCheck,
  FileCode,
  CalendarRange,
  ShieldAlert,
  Smartphone,
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
      { label: "Advanced Analytics", path: "/analytics", icon: BarChart3 },
      { label: "Correlation Engine", path: "/correlation", icon: Network },
    ],
  },
  {
    label: "Exposure Monitoring",
    items: [
      { label: "Findings", path: "/exposure", icon: Eye },
      { label: "Watchlists", path: "/exposure/watchlists", icon: Target },
    ],
  },
  {
    label: "Risk & Portfolio",
    items: [
      { label: "Product Portfolio", path: "/product-portfolio", icon: Package },
      { label: "Product Vulnerabilities", path: "/product-vulnerabilities", icon: ShieldAlert },
      { label: "SBOM / CMDB", path: "/sbom-cmdb", icon: FileCode },
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
    items: [
      { label: "Daily Review Audit", path: "/daily-review-audit", icon: ClipboardCheck },
      { label: "Mobile Review", path: "/mobile-review", icon: Smartphone },
      { label: "Monthly Report", path: "/monthly-report", icon: CalendarRange },
      { label: "Weekly Briefing", path: "/weekly-briefing", icon: ClipboardList },
      { label: "Executive Dashboard", path: "/executive-dashboard", icon: Presentation },
      { label: "Executive Brief", path: "/executive-brief", icon: Briefcase },
    ],
  },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      { label: "Actioned Threats", path: "/actioned-threats", icon: CheckSquare },
      { label: "Admin Console", path: "/admin", icon: Settings },
      { label: "Collector Health", path: "/feeds", icon: Radio },
      { label: "Platform Secrets", path: "/admin/api-keys", icon: KeySquare },
      { label: "Organizations", path: "/organizations", icon: Building2 },
      { label: "SLA Policies", path: "/sla-policies", icon: Clock },
      { label: "Setup Checklist", path: "/admin/setup", icon: ListChecks },
      { label: "Integrations", path: "/integrations", icon: Plug },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Security", path: "/settings/security", icon: ShieldCheck },
      { label: "API Keys", path: "/api-keys", icon: KeySquare },
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

function SidebarInner({ collapsed, pathname, onCollapse, onNavigate, onLogout, isAdmin }) {
  const [showHelp, setShowHelp] = useState(false);
  const visibleCategories = categories.filter((c) => !c.adminOnly || isAdmin);
  const navigate = useNavigate();

  return (
    <aside
      className={cn(
        "shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-200 h-full",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center gap-2 px-4 border-b border-sidebar-border">
        <Link to="/" onClick={onNavigate} className="flex items-center gap-2 min-w-0">
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
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 overflow-y-auto scrollbar-none">
        {visibleCategories.map((section) => (
          <NavSection
            key={section.label}
            section={section}
            collapsed={collapsed}
            pathname={pathname}
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
                  onClick={onNavigate}
                  className="block px-3 py-1.5 text-sm text-sidebar-foreground/65 hover:text-sidebar-foreground rounded-lg hover:bg-sidebar-accent/60"
                >
                  How It Works
                </Link>
                <Link
                  to="/policy"
                  onClick={onNavigate}
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
            onClick={() => { navigate("/policy"); onNavigate?.(); }}
            title="Settings"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              aria-label="Collapse sidebar"
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={onLogout}
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
  );
}

export default function DashboardLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "superadmin";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout(false);
    window.location.href = "/";
  };

  const visibleCategories = categories.filter((c) => !c.adminOnly || isAdmin);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-screen sticky top-0">
        <SidebarInner
          collapsed={collapsed}
          pathname={location.pathname}
          onCollapse={() => setCollapsed((c) => !c)}
          onLogout={handleLogout}
          isAdmin={isAdmin}
        />
      </div>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 border-b border-border bg-background/80 backdrop-blur-md">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border text-foreground hover:bg-accent transition"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <Logo size={22} />
          <span className="text-base font-bold tracking-tight">ThreatPulse</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-64 max-w-[80vw] shadow-2xl animate-in slide-in-from-left">
            <SidebarInner
              collapsed={false}
              pathname={location.pathname}
              onNavigate={() => setMobileOpen(false)}
              onLogout={handleLogout}
              isAdmin={isAdmin}
            />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 inline-flex items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              aria-label="Close menu"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}