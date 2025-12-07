import React from 'react';
import { User, Shield, CreditCard, Bell } from 'lucide-react';

export const Settings: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-3xl font-bold text-white mb-2">Settings</h2>
      <p className="text-gray-400 mb-8">Manage your account and studio preferences.</p>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-wes-purple rounded-full flex items-center justify-center text-2xl font-bold text-white">
              W
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">John Wesley Quintero</h3>
              <p className="text-gray-400">Pro Plan Member</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="p-4 bg-wes-800 rounded-xl border border-wes-700">
                <p className="text-xs text-gray-500 uppercase">Email</p>
                <p className="text-white">wesley@onesound.ai</p>
             </div>
             <div className="p-4 bg-wes-800 rounded-xl border border-wes-700">
                <p className="text-xs text-gray-500 uppercase">Role</p>
                <p className="text-white">Administrator</p>
             </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-wes-purple" />
                Studio Preferences
            </h3>
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-wes-800/50 rounded-xl">
                    <div>
                        <p className="text-white font-medium">High Fidelity Audio</p>
                        <p className="text-sm text-gray-500">Generate uncompressed WAV instead of MP3</p>
                    </div>
                    <div className="w-12 h-6 bg-wes-purple rounded-full relative cursor-pointer">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                    </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-wes-800/50 rounded-xl">
                    <div>
                        <p className="text-white font-medium">Auto-Save Projects</p>
                        <p className="text-sm text-gray-500">Save drafts every 30 seconds</p>
                    </div>
                    <div className="w-12 h-6 bg-wes-purple rounded-full relative cursor-pointer">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
