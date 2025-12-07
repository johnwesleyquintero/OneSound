import React from 'react';
import { AppView } from '../types';
import { Disc, Mic2, LayoutDashboard, Library, Settings, LogOut } from 'lucide-react';
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
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
          isActive 
            ? 'bg-wes-800 text-white border border-wes-700 shadow-lg shadow-black/40' 
            : 'text-gray-400 hover:text-white hover:bg-wes-800/50'
        }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'text-wes-purple' : 'group-hover:text-wes-purple'}`} />
        <span className="font-medium text-sm tracking-wide">{label}</span>
      </button>
    );
  };

  return (
    <div className="w-64 h-screen bg-wes-900 border-r border-wes-800 flex flex-col p-4 fixed left-0 top-0 z-20">
      <div className="flex items-center space-x-3 px-4 py-6 mb-4">
        <div className="shadow-lg shadow-purple-900/20 rounded-xl transition-transform hover:scale-105">
            <Logo className="w-10 h-10" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">OneSound</h1>
          <p className="text-xs text-gray-500 font-mono">v2.2 AI Studio</p>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <p className="px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 mt-4">Studio</p>
        <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
        <NavItem view={AppView.CREATE} icon={Disc} label="New Track" />
        <NavItem view={AppView.REMASTER} icon={Mic2} label="Remaster" />
        
        <p className="px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 mt-8">Collection</p>
        <NavItem view={AppView.LIBRARY} icon={Library} label="My Library" />
        <NavItem view={AppView.SETTINGS} icon={Settings} label="Settings" />
      </div>

      <div className="mt-auto space-y-4">
        <button 
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 text-gray-500 hover:text-red-400 hover:bg-red-900/10 rounded-xl transition-all duration-200"
        >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Sign Out</span>
        </button>

        <div className="p-4 bg-wes-800/40 rounded-xl border border-wes-800">
            <div className="flex items-center space-x-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs text-gray-400">System Operational</span>
            </div>
            <p className="text-xs text-gray-500">"Let's build, brother."</p>
        </div>
      </div>
    </div>
  );
};