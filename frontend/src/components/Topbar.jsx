import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole, Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Topbar({ onMenuClick, onToggleSidebar, sidebarCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entityName, setEntityName] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const patientMatch = location.pathname.match(/^\/patients\/([^/]+)$/);
  const examMatch = location.pathname === '/exams/new'
    ? null
    : location.pathname.match(/^\/exams\/([^/]+)$/);
  const pageName = {
    '/dashboard': 'Tableau de bord',
    '/patients': 'Patients',
    '/exams/new': 'Nouvelle prescription',
    '/ris': 'Console RIS',
    '/audit': "Journal d'audit",
  }[location.pathname];

  useEffect(() => {
    let active = true;
    setEntityName('');
    const match = patientMatch || examMatch;
    if (!match) return () => { active = false; };

    const isPatient = Boolean(patientMatch);
    api.get(`/${isPatient ? 'patients' : 'exams'}/${match[1]}/`)
      .then(({ data }) => {
        if (!active) return;
        setEntityName(isPatient
          ? [data.nom, data.prenom].filter(Boolean).join(' ')
          : data.accession_number || match[1]);
      })
      .catch((error) => {
        console.error('Impossible de charger le fil d’Ariane.', error);
        if (active) setEntityName(match[1]);
      });

    return () => { active = false; };
  }, [location.pathname]);

  const submitGlobalSearch = (event) => {
    event.preventDefault();
    const query = globalSearch.trim();
    navigate(query ? `/dashboard?search=${encodeURIComponent(query)}` : '/dashboard');
  };
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Utilisateur';
  const initials = fullName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#D1E0EB] bg-[#F5FAFE]/90 px-3 backdrop-blur-xl sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#54687A] hover:bg-[#F3F8FC] lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Déployer le menu latéral' : 'Replier le menu latéral'}
          title={sidebarCollapsed ? 'Déployer le menu' : 'Replier le menu'}
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#71869A] transition hover:bg-[#F3F8FC] hover:text-[#1566C0] lg:inline-flex"
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-[17px] w-[17px]" /> : <PanelLeftClose className="h-[17px] w-[17px]" />}
        </button>
        <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-center gap-2 text-[12px] sm:gap-2.5 sm:text-[13px]">
        {patientMatch ? (
          <>
            <Link to="/patients" className="text-[#71869A] hover:text-[#1566C0]">Patients</Link>
            <span className="text-[#B9C9D7]">/</span>
            <span className="max-w-[120px] truncate font-medium text-[#0F2233] sm:max-w-[220px]">{entityName || 'Chargement…'}</span>
          </>
        ) : examMatch ? (
          <>
            <Link to="/dashboard" className="text-[#71869A] hover:text-[#1566C0]">Examens</Link>
            <span className="text-[#B9C9D7]">/</span>
            <span className="max-w-[120px] truncate font-medium text-[#0F2233] sm:max-w-[220px]">{entityName || 'Chargement…'}</span>
          </>
        ) : (
          <span className="truncate font-medium text-[#0F2233]">{pageName || 'Tableau de bord'}</span>
        )}
        </nav>
      </div>
      <form onSubmit={submitGlobalSearch} role="search" className="hidden min-w-0 flex-1 justify-center md:flex">
        <label className="relative w-full max-w-[300px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#8CA0B2]" />
          <input
            type="search"
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder="Rechercher un patient ou un examen"
            aria-label="Recherche globale"
            className="h-9 w-full rounded-lg border border-[#DCE6EF] bg-[#F8FBFE] pl-9 pr-3 text-[11px] text-[#0F2233] placeholder:text-[#8CA0B2] focus:border-[#1566C0] focus:outline-none focus:ring-2 focus:ring-[#1566C0]/10"
          />
        </label>
      </form>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-1.5 text-[10px] font-medium text-[#71869A] xl:flex">
          <LockKeyhole className="h-3.5 w-3.5 text-[#1566C0]" />
          Session sécurisée
        </div>
        <div className="flex items-center gap-2 border-l border-[#DCE6EF] pl-2.5 sm:pl-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E6F0FB] text-[10px] font-semibold text-[#1566C0]">{initials}</span>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[110px] truncate text-[11px] font-medium text-[#0F2233]">{fullName}</span>
            <span className="block max-w-[110px] truncate text-[9px] text-[#71869A]">{user?.role_display || user?.role}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
