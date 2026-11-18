import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { AlertTriangle, HeartPulse, Phone, Pill, ShieldAlert } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { LoadingScreen } from '../components/LoadingScreen';
import { db } from '../services/firebase';
import type { EmergencyCard } from '../types/health';

export default function PublicEmergency() {
  const { memberId } = useParams<{ memberId: string }>();
  const [card, setCard] = useState<EmergencyCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadCard() {
      if (!memberId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'emergencyCards', memberId));
        if (snap.exists()) {
          setCard({ id: snap.id, ...(snap.data() as Omit<EmergencyCard, 'id'>) });
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    void loadCard();
  }, [memberId]);

  if (loading) {
    return <LoadingScreen message="Loading emergency medical card..." />;
  }

  if (notFound || !card) {
    return (
      <div className="min-h-screen bg-red-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-red-900/60 border border-red-700 rounded-3xl p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-300 mx-auto" />
          <h1 className="text-xl font-bold">Emergency Card Not Found</h1>
          <p className="text-sm text-red-100">
            This QR code may be outdated or removed by the family owner.
          </p>
        </div>
      </div>
    );
  }

  const hasAllergy = card.allergies.some((a) => a.toLowerCase() !== 'none');

  return (
    <div className="min-h-screen bg-red-50 py-6 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Top Emergency Banner */}
        <div className="bg-red-600 text-white rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <HeartPulse className="w-6 h-6" />
              <span className="text-sm font-bold tracking-wide uppercase">Medical Emergency Card</span>
            </div>
            <span className="text-xs font-medium text-red-100">Rabbit Mediko</span>
          </div>

          <div className="flex items-end justify-between gap-4 pt-2">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">{card.name}</h1>
              <p className="text-base text-red-100 mt-1">
                Age {card.age} · Gender {card.gender}
              </p>
            </div>
            <div className="bg-white text-red-700 rounded-2xl px-4 py-2.5 text-center shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-wide">Blood Group</p>
              <p className="text-2xl font-mono font-extrabold">{card.bloodGroup}</p>
            </div>
          </div>
        </div>

        {/* Critical Allergies */}
        <div
          className={`rounded-2xl border p-5 space-y-2 ${
            hasAllergy ? 'bg-red-100 border-red-300 text-red-950' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <span>Allergies</span>
          </div>
          <p className="text-xl font-bold">{card.allergies.join(', ')}</p>
        </div>

        {/* Medical Conditions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Medical Conditions</p>
          <p className="text-xl font-bold text-slate-900">{card.conditions.join(', ')}</p>
        </div>

        {/* Active Medications */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <Pill className="w-4 h-4 text-slate-700" />
            <span>Current Medications</span>
          </div>
          {card.activeMedicines.length === 0 ? (
            <p className="text-base text-slate-600">No active medications recorded.</p>
          ) : (
            <ul className="space-y-2 text-base font-semibold text-slate-900">
              {card.activeMedicines.map((med, i) => (
                <li key={i} className="pb-2 border-b border-slate-100 last:border-none last:pb-0">
                  {med}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Call Emergency Contact CTA */}
        {card.emergencyContact ? (
          <a
            href={`tel:${card.emergencyContact.replace(/\s+/g, '')}`}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-red-600 text-white text-lg font-bold hover:bg-red-700 transition-colors shadow-md min-h-[60px]"
          >
            <Phone className="w-6 h-6" />
            <span>Call Emergency Contact ({card.emergencyContact})</span>
          </a>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center text-sm text-slate-500">
            No emergency contact phone number saved.
          </div>
        )}

        <p className="text-center text-xs text-slate-500">
          Verified Emergency Information · No Login Required
        </p>
      </div>
    </div>
  );
}
