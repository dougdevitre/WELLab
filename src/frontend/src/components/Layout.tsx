import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: "/", label: "Participant" },
  { to: "/researcher", label: "Researcher" },
  { to: "/policy", label: "Policy" },
];

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip to main content link for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-wellab-600 focus:text-white focus:rounded-md"
      >
        Skip to main content
      </a>

      <header className="bg-wellab-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-wellab-300 flex items-center justify-center font-bold text-wellab-900 text-sm">
                W
              </div>
              <span className="text-lg font-semibold tracking-tight">
                WELLab Platform
              </span>
            </div>
            <nav aria-label="Main navigation" className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-wellab-300 focus:ring-offset-2 focus:ring-offset-wellab-700 ${
                      isActive
                        ? "bg-wellab-600 text-white"
                        : "text-wellab-100 hover:bg-wellab-600/50"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main
        id="main-content"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8"
      >
        {children}
      </main>
      <footer className="bg-gray-100 border-t text-center text-xs text-gray-500 py-4">
        {/* Note: lang attribute should be set on the root <html> element in index.html */}
        WELLab AI-Enabled Research &amp; Impact Platform
      </footer>
    </div>
  );
}
