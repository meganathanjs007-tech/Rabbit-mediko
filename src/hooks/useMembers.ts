import { useFamilyContext } from '../context/FamilyContext';

export function useMembers() {
  const { members, addFamilyMember, syncEmergencyCard } = useFamilyContext();
  return { members, addFamilyMember, syncEmergencyCard };
}
