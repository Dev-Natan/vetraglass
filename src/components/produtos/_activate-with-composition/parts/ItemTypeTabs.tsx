import { Circle, CircleDot, CheckCircle2 } from 'lucide-react';
import { itemTypeTabs } from '../constants';
import type { ComponentItem } from '../types';

interface ItemTypeTabsProps {
  activeTab: string;
  onChange: (value: string) => void;
  localItems: ComponentItem[];
}

export function ItemTypeTabs({ activeTab, onChange, localItems }: ItemTypeTabsProps) {
  const getCount = (value: string) => {
    const tab = itemTypeTabs.find(t => t.value === value);
    return localItems.filter(i => i.item_template?.type === tab?.dbType).length;
  };

  return (
    <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
      {itemTypeTabs.map(tab => {
        const itemCount = getCount(tab.value);
        const isActive = activeTab === tab.value;
        const hasItems = itemCount > 0;

        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all flex-1 justify-center ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : hasItems
                  ? 'bg-success/20 text-success hover:bg-success/30'
                  : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {hasItems && !isActive ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : isActive ? (
              <CircleDot className="w-4 h-4 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 shrink-0" />
            )}
            <span className="text-xs font-medium hidden sm:inline">{tab.label}</span>
            <span className="text-xs font-medium sm:hidden">{tab.label.slice(0, 3)}</span>
            {itemCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-primary-foreground/20' : 'bg-current/10'
                }`}
              >
                {itemCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
