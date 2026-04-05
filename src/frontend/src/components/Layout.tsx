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
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-gray-100 border-t text-center text-xs text-gray-500 py-4">
        WELLab AI-Enabled Research &amp; Impact Platform
      </footer>
    </div>
  );
}
