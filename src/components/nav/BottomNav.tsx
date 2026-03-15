import { Home, BarChart3, Mic, Target, User } from 'lucide-react';

type NavTab = 'home' | 'progress' | 'voice' | 'focus' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const tabs: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'focus', label: 'Focus', icon: Target },
  { id: 'profile', label: 'Profile', icon: User },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-end justify-around max-w-lg mx-auto px-2 h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isVoice = tab.id === 'voice';
          const isActive = activeTab === tab.id;

          if (isVoice) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="flex flex-col items-center -mt-5"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-elevated transition-colors ${
                  isActive ? 'bg-primary-dark' : 'bg-primary'
                }`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-primary' : 'text-content-tertiary'}`}>
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center py-2 px-3"
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-content-tertiary'}`} />
              <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-primary' : 'text-content-tertiary'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
