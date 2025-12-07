import React from 'react';
import { AppView } from '../types';
import { Disc, Mic2, LayoutDashboard, Library, Settings, LogOut, Radio } from 'lucide-react';
import { Logo } from './Logo';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout }) => {
  
  const NavItem = ({ view, icon: Icon, label }: { view: AppView; icon: any; label: string }) => {
    const isActive = currentView === view;
    return (
      <button
        onClick={() => onChangeView(view)}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
          isActive 
            ? 'bg-wes-800 text-white shadow-md' 
            : 'text-gray-500 hover:text-white hover:bg-wes-800/30'
        }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'text-wes-purple' : 'group-hover:text-wes-purple'}`} />
        <span className="font-medium text-sm">{label}</span>
      </button>
    );
  };

  return (
    <div className="w-64 h-screen bg-wes-950 border-r border-wes-800 flex flex-col p-4 fixed left-0 top-0 z-20">
      <div className="flex items-center space-x-3 px-4 py-6 mb-6">
        <Logo className="w-8 h-8" />
        <h1 className="text-xl font-bold tracking-tight text-white">OneSound</h1>
      </div>

      <div className="flex-1 space-y-1">
        <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-2">Studio</p>
        <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label="Home" />
        <NavItem view={AppView.CREATE} icon={Disc} label="Create Music" />
        <NavItem view={AppView.REMASTER} icon={Radio} label="Remaster" />
        
        <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-8">Library</p>
        <NavItem view={AppView.LIBRARY} icon={Library} label="My Tracks" />
        <NavItem view={AppView.SETTINGS} icon={Settings} label="Settings" />
      </div>

      <div className="mt-auto">
        <button 
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 text-gray-600 hover:text-red-400 hover:bg-red-900/5 rounded-lg transition-all duration-200"
        >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Log Out</span>
        </button>
      </div>
    </div>
  );
};