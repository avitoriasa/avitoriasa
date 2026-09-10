import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Central de comando", end: true },
  { to: "/products", label: "Produtos" },
  { to: "/sourcing", label: "Fornecedores" },
  { to: "/inventory", label: "Estoque" },
  { to: "/marketplaces", label: "Marketplaces" },
  { to: "/settings", label: "Configurações" },
];

export function Layout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-100 p-5 flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold">Marketplace CRM</h1>
          <p className="text-xs text-slate-400 mt-1">IA para escolher e otimizar seus anúncios</p>
        </div>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 max-w-6xl">
        <Outlet />
      </main>
    </div>
  );
}
