import type { FamilyMember } from '../types/health';
import { getInitials } from '../utils/helpers';

interface MemberSelectorProps {
  members: FamilyMember[];
  selectedId: string;
  onSelect: (memberId: string) => void;
}

export function MemberSelector({ members, selectedId, onSelect }: MemberSelectorProps) {
  if (members.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Family Members">
      {members.map((member) => {
        const active = member.id === selectedId;
        return (
          <button
            key={member.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(member.id)}
            className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 min-h-[44px] cursor-pointer border ${
              active
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-lg text-xs font-semibold flex items-center justify-center ${
                active ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {getInitials(member.name)}
            </span>
            <span>{member.name}</span>
          </button>
        );
      })}
    </div>
  );
}
