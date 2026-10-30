import { NavLink, Outlet } from "react-router-dom";

const links = [
  ["/", "Dashboard"],
  ["/analyze", "Analyze"],
  ["/analyses", "Analyses"],
  ["/vendors", "Vendors"],
  ["/rules", "Rules"],
  ["/settings", "Settings"],
] as const;

export function AppLayout() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">MS</div>
          <div>
            <strong>MailSentry</strong>
            <small>Payment-mail review</small>
          </div>
        </div>
        <nav aria-label="Primary">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
