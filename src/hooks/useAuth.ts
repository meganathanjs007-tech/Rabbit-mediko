import { useFamilyContext } from '../context/FamilyContext';

export function useAuth() {
  const { user, authReady, userProfile, logout } = useFamilyContext();
  return { user, authReady, userProfile, logout };
}
