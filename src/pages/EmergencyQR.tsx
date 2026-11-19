import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, ExternalLink, Phone, QrCode, Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/BottomNav';
import { BrandLogo } from '../components/BrandLogo';
import { EmptyState } from '../components/EmptyState';
import { MemberSelector } from '../components/MemberSelector';
import { useFamily } from '../hooks/useFamily';
import { getT } from '../utils/i18n';

export default function EmergencyQR() {
  const { family, members, medicines, language } = useFamily();
  const t = getT(language);
  const [selectedId, setSelectedId] = useState('');
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedId && members.length > 0) {
      setSelectedId(members[0].id);
    }
  }, [members, selectedId]);

  const activeMember = members.find((m) => m.id === selectedId) ?? members[0];
  const memberMeds = activeMember
    ? medicines.filter((m) => m.memberId === activeMember.id && m.active)
    : [];

  const emergencyUrl = activeMember
    ? `${window.location.origin}/emergency/${activeMember.cardId}`
    : '';

  const contactPhone = activeMember?.emergencyContact || family?.emergencyContact || '';

  const handleDownloadPdf = async () => {
    if (!cardRef.current || !activeMember) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#FFFFFF',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5',
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 8, pdfWidth, pdfHeight);
      pdf.save(`${activeMember.name.replace(/\s+/g, '_')}_Emergency_QR.pdf`);
      toast.success('Emergency QR PDF downloaded!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'PDF download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!activeMember) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${activeMember.name} — Emergency Health Card`,
          text: `Emergency medical summary for ${activeMember.name} (Blood Group: ${activeMember.bloodGroup})`,
          url: emergencyUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(emergencyUrl);
      toast.success('Emergency link copied to clipboard!');
    } catch {
      toast.error('Could not copy link');
    }
  };

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full min-w-0 space-y-6"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">{t.emergency.title}</h1>
          <p className="text-sm text-slate-600">{t.emergency.subtitle}</p>
        </div>

        <MemberSelector
          members={members}
          selectedId={activeMember?.id ?? ''}
          onSelect={setSelectedId}
        />

        {!activeMember ? (
          <EmptyState
            icon={<QrCode className="w-6 h-6" />}
            title="No family members"
            description="Add a family member to generate their Emergency QR card."
          />
        ) : (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* Printable Card Preview */}
            <div className="lg:col-span-6 min-w-0 space-y-4">
              <div
                ref={cardRef}
                className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="bg-red-600 text-white px-5 sm:px-6 py-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BrandLogo size="sm" className="ring-white/30" />
                    <span className="text-xs sm:text-sm font-bold tracking-wide truncate">
                      RABBIT MEDIKO · EMERGENCY
                    </span>
                  </div>
                  <span className="font-mono text-base font-bold shrink-0">{activeMember.bloodGroup}</span>
                </div>

                <div className="p-6 flex flex-col items-center text-center space-y-5">
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl">
                    <QRCode value={emergencyUrl} size={184} level="M" />
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-slate-900">{activeMember.name}</h2>
                    <p className="text-sm text-slate-600">
                      {activeMember.age} yrs · {activeMember.gender} · Blood Group{' '}
                      <span className="font-mono font-bold text-red-700">{activeMember.bloodGroup}</span>
                    </p>
                  </div>

                  <div className="w-full text-left border-t border-slate-100 pt-4 space-y-2 text-xs text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">{t.emergency.allergies}:</span>{' '}
                      {activeMember.allergies.join(', ')}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">{t.emergency.conditions}:</span>{' '}
                      {activeMember.conditions.join(', ')}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">{t.emergency.emergencyContact}:</span>{' '}
                      <span className="font-mono">{contactPhone || 'Not set'}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void handleDownloadPdf()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 min-h-[48px] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{downloading ? 'Preparing...' : t.emergency.downloadPdf}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 min-h-[48px] cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{t.emergency.shareCard}</span>
                </button>
              </div>
            </div>

            {/* Readable Emergency Summary */}
            <div className="lg:col-span-6 min-w-0 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Emergency Responder Summary</h3>
                <Link
                  to={`/emergency/${activeMember.cardId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline"
                >
                  <span>{t.emergency.publicPreview}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">{t.emergency.bloodGroup}</p>
                  <p className="text-lg font-mono font-bold text-red-600">{activeMember.bloodGroup}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t.emergency.emergencyContact}</p>
                  <p className="text-sm font-mono font-semibold text-slate-900">{contactPhone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t.emergency.allergies}</p>
                  <p className="text-sm font-semibold text-slate-900">{activeMember.allergies.join(', ')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t.emergency.conditions}</p>
                  <p className="text-sm font-semibold text-slate-900">{activeMember.conditions.join(', ')}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {t.emergency.activeMedicines}
                </p>
                {memberMeds.length === 0 ? (
                  <p className="text-sm text-slate-500">No active medications logged.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm text-slate-800">
                    {memberMeds.map((med) => (
                      <li key={med.id}>
                        <span className="font-semibold">{med.name}</span> · {med.dosage} ({med.frequency})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {contactPhone && (
                <a
                  href={`tel:${contactPhone.replace(/\s+/g, '')}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors min-h-[48px]"
                >
                  <Phone className="w-4 h-4" />
                  <span>{t.emergency.callNow}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
