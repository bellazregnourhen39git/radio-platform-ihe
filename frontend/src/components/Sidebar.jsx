import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Users, FilePlus, CalendarDays, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ open, onClose, collapsed = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const links = [
    { path: '/dashboard', label: 'Tableau de bord', icon: Activity, roles: ['MEDECIN_DEMANDEUR', 'RADIOLOGUE', 'ADMIN'] },
    { path: '/ris', label: 'Console RIS', icon: CalendarDays, roles: ['RADIOLOGUE', 'ADMIN'] },
    { path: '/patients', label: 'Patients', icon: Users, roles: ['MEDECIN_DEMANDEUR', 'RADIOLOGUE', 'ADMIN'] },
    { path: '/exams/new', label: 'Nouvelle prescription', icon: FilePlus, roles: ['MEDECIN_DEMANDEUR', 'ADMIN'] },
    { path: '/audit', label: "Journal d'audit", icon: Shield, roles: ['ADMIN'] },
  ];
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Utilisateur';
  const initials = fullName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      {open && <button aria-label="Fermer le menu" onClick={onClose} className="fixed inset-0 z-40 bg-[#0F2233]/20 lg:hidden" />}
      <aside className={`app-sidebar fixed inset-y-0 left-0 z-50 flex h-screen w-[240px] shrink-0 flex-col border-r border-[#D1E0EB] text-[#456175] transition-[width,transform] duration-200 lg:sticky lg:z-auto lg:translate-x-0 ${
        collapsed ? 'lg:w-[76px]' : 'lg:w-[240px]'
      } ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
      <div className={`px-3 py-5 ${collapsed ? 'lg:px-2' : ''}`}>
        <Link to="/dashboard" onClick={onClose} className={`mb-7 flex items-center gap-3 px-2 text-[#0F2233] ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#236BB1] to-[#2C8DA8] text-white shadow-[0_8px_18px_rgba(35,94,140,0.24)]">
            <Activity className="h-[18px] w-[18px]" />
          </div>
          <div className={collapsed ? 'lg:hidden' : ''}>
            <span className="block text-[14px] font-semibold tracking-tight">RadioPlatform</span>
            <span className="mt-0.5 block text-[10px] text-[#71869A]">Imagerie clinique</span>
          </div>
        </Link>
        <p className={`mb-2 px-3 text-[10px] font-semibold text-[#71869A] ${collapsed ? 'lg:hidden' : ''}`}>Espace de travail</p>
        <nav className="space-y-1">
          {links.filter((link) => link.roles.includes(user?.role)).map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={`app-nav-link group relative flex h-10 items-center gap-3 px-3 text-[13px] ${
                collapsed ? 'lg:justify-center lg:px-0' : ''
              } ${
                isActive(path)
                  ? 'is-active font-semibold'
                  : ''
              }`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive(path) ? 'text-white' : 'text-[#71869A] group-hover:text-[#34779F]'}`} />
              <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className={`mt-auto border-t border-[#DCE6EF] p-3 ${collapsed ? 'lg:px-2' : ''}`}>
        <div className={`mb-3 flex items-center gap-2.5 rounded-xl border border-[#D4E5F0] bg-white/65 p-2 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D4E8F7] to-[#D2ECEB] text-[10px] font-semibold text-[#285F8B] ring-1 ring-white/80">
            {initials}
          </div>
          <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
            <div className="truncate text-[11px] font-medium text-[#0F2233]">{fullName}</div>
            <div className="truncate text-[10px] text-[#71869A]">{user?.role_display || user?.role}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { logout(); onClose?.(); navigate('/login'); }}
          title={collapsed ? 'Déconnexion' : undefined}
          className={`app-nav-logout flex h-9 w-full items-center gap-2.5 px-3 text-left text-[12px] text-[#54687A] ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
        >
          <LogOut className="h-4 w-4" />
          <span className={collapsed ? 'lg:hidden' : ''}>Déconnexion</span>
        </button>
      </div>
      </aside>
    </>
  );
}
