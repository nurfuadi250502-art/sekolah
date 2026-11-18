import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import { Download, Printer, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePortalData } from '../contexts/PortalDataContext';
import { EmptyState } from '../components/ui/DataTableControls';
import { logActivity } from '../services/firestoreService';

type CardTargetType = 'student' | 'teacher';
type CardSize = 'cr80' | 'pocket' | 'a6';

interface CardEntry {
  id: string;
  name: string;
  codeLabel: string;
  codeValue: string;
  roleOrClass: string;
  email: string;
  photoUrl?: string;
  identityType: 'SISWA' | 'GURU';
}

export function AccountCardsModule() {
  const { userProfile, schoolSettings } = useAuth();
  const { students, teachers, classes } = usePortalData();

  const [targetType, setTargetType] = useState<CardTargetType>('student');
  const [classFilter, setClassFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('all');
  const [cardSize, setCardSize] = useState<CardSize>('cr80');

  const cardEntries: CardEntry[] = useMemo(() => {
    if (targetType === 'student') {
      return students
        .filter((s) => (classFilter === 'all' ? true : s.classId === classFilter))
        .filter((s) => (selectedId === 'all' ? true : s.id === selectedId))
        .map((s) => ({
          id: s.id,
          name: s.fullName,
          codeLabel: 'NIS / NISN',
          codeValue: `${s.nis} / ${s.nisn}`,
          roleOrClass: `Kelas ${s.className || s.classId}`,
          email: s.email,
          photoUrl: s.photoUrl,
          identityType: 'SISWA',
        }));
    }
    return teachers
      .filter((t) => (selectedId === 'all' ? true : t.id === selectedId))
      .map((t) => ({
        id: t.id,
        name: t.fullName,
        codeLabel: 'NIP / Kode',
        codeValue: `${t.nip || '-'} / ${t.teacherCode}`,
        roleOrClass: (t.subjectNames || []).join(', ') || 'Guru Pengajar',
        email: t.email,
        photoUrl: t.photoUrl,
        identityType: 'GURU',
      }));
  }, [targetType, students, teachers, classFilter, selectedId]);

  const sizeClass =
    cardSize === 'cr80'
      ? 'w-[340px] min-h-[214px]'
      : cardSize === 'pocket'
        ? 'w-[360px] min-h-[240px]'
        : 'w-[400px] min-h-[270px]';

  const handlePrint = () => {
    if (userProfile) {
      void logActivity({
        userId: userProfile.uid,
        userName: userProfile.displayName,
        userRole: userProfile.role,
        actionType: 'PRINT_ACCOUNT_CARDS',
        targetObject: `${cardEntries.length} Kartu ${targetType === 'student' ? 'Siswa' : 'Guru'}`,
      });
    }
    window.print();
  };

  const handleDownloadPdf = () => {
    const docPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cardW = cardSize === 'cr80' ? 85.6 : cardSize === 'pocket' ? 90 : 105;
    const cardH = cardSize === 'cr80' ? 54 : cardSize === 'pocket' ? 60 : 74;
    const cols = cardSize === 'a6' ? 1 : 2;
    const marginX = 12;
    const marginY = 14;
    const gap = 8;

    cardEntries.forEach((entry, idx) => {
      const perPage = cols * 4;
      if (idx > 0 && idx % perPage === 0) docPdf.addPage();
      const pos = idx % perPage;
      const col = pos % cols;
      const row = Math.floor(pos / cols);
      const x = marginX + col * (cardW + gap);
      const y = marginY + row * (cardH + gap);

      // Card outline and navy header bar
      docPdf.setDrawColor(203, 213, 225);
      docPdf.setFillColor(255, 255, 255);
      docPdf.roundedRect(x, y, cardW, cardH, 3, 3, 'FD');

      docPdf.setFillColor(15, 41, 74);
      docPdf.rect(x, y, cardW, 13, 'F');
      docPdf.setTextColor(255, 255, 255);
      docPdf.setFontSize(8.5);
      docPdf.text(schoolSettings.schoolName.slice(0, 34), x + 4, y + 6);
      docPdf.setFontSize(6.5);
      docPdf.setTextColor(103, 232, 249);
      docPdf.text(`KARTU AKUN PORTAL · ${entry.identityType}`, x + 4, y + 10.5);

      docPdf.setTextColor(15, 23, 42);
      docPdf.setFontSize(9.5);
      docPdf.text(entry.name.slice(0, 28), x + 4, y + 20);
      docPdf.setFontSize(7.5);
      docPdf.setTextColor(71, 85, 105);
      docPdf.text(`${entry.codeLabel}: ${entry.codeValue}`, x + 4, y + 26);
      docPdf.text(entry.roleOrClass.slice(0, 36), x + 4, y + 31);
      docPdf.text(`Email: ${entry.email}`, x + 4, y + 37);
      docPdf.text(`ID: ${entry.id}`, x + 4, y + 42);

      docPdf.setFontSize(6);
      docPdf.setTextColor(100, 116, 139);
      docPdf.text('Aktivasi kata sandi melalui menu Aktivasi Akun / Google Login.', x + 4, y + cardH - 4);
    });

    docPdf.save(`Kartu_Akun_${targetType}_${new Date().toISOString().slice(0, 10)}.pdf`);
    if (userProfile) {
      void logActivity({
        userId: userProfile.uid,
        userName: userProfile.displayName,
        userRole: userProfile.role,
        actionType: 'DOWNLOAD_CARDS_PDF',
        targetObject: `${cardEntries.length} Kartu`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls (Hidden when printing) */}
      <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTargetType('student');
                  setSelectedId('all');
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  targetType === 'student'
                    ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Kartu Siswa
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetType('teacher');
                  setSelectedId('all');
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  targetType === 'teacher'
                    ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Kartu Guru
              </button>
            </div>

            {targetType === 'student' && (
              <select
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  setSelectedId('all');
                }}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                <option value="all">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            >
              <option value="all">
                Cetak Massal ({targetType === 'student' ? 'Semua Siswa Terfilter' : 'Semua Guru'})
              </option>
              {(targetType === 'student' ? students : teachers).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                </option>
              ))}
            </select>

            <select
              value={cardSize}
              onChange={(e) => setCardSize(e.target.value as CardSize)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            >
              <option value="cr80">Ukuran CR80 (85.6 × 54 mm)</option>
              <option value="pocket">Ukuran Saku (90 × 60 mm)</option>
              <option value="a6">Ukuran A6 (105 × 148 mm)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={cardEntries.length === 0}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh PDF
            </button>
            <button
              type="button"
              disabled={cardEntries.length === 0}
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold disabled:opacity-40"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Kartu ({cardEntries.length})
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 text-xs text-sky-900 dark:text-cyan-200">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Sesuai standar keamanan siber, kartu akun tidak pernah mencetak kata sandi asli. Pengguna mengaktifkan atau mengatur ulang kata sandi secara mandiri melalui verifikasi email atau Google Sign-In.
          </p>
        </div>
      </div>

      {/* Cards Preview / Print Area */}
      {cardEntries.length === 0 ? (
        <EmptyState
          title="Belum ada data kartu untuk dicetak"
          description="Tambahkan data siswa atau guru terlebih dahulu untuk membuat kartu identitas portal."
        />
      ) : (
        <div className="print-area flex flex-wrap gap-6">
          {cardEntries.map((entry) => {
            const qrPayload = JSON.stringify({
              portal: 'SCHOOL_ACADEMIC_PORTAL',
              id: entry.id,
              type: entry.identityType,
              email: entry.email,
              school: schoolSettings.npsn || schoolSettings.schoolName,
            });
            return (
              <div
                key={entry.id}
                className={`print-card ${sizeClass} bg-white text-slate-900 border border-slate-300 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between`}
              >
                {/* Front Header */}
                <div className="bg-[#0F294A] text-white px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={
                        schoolSettings.logoUrl ||
                        '/src/assets/images/school_crest_logo_1795012759504.jpg'
                      }
                      alt={schoolSettings.schoolName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded bg-white object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-display font-bold text-xs truncate">
                        {schoolSettings.schoolName}
                      </p>
                      <p className="text-[10px] text-cyan-300">KARTU AKUN {entry.identityType}</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 flex items-center justify-between gap-3 flex-1">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-14 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {entry.photoUrl ? (
                        <img
                          src={entry.photoUrl}
                          alt={entry.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-display font-bold text-sm text-[#0F294A]">
                          {entry.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-bold text-xs text-slate-900 truncate">{entry.name}</p>
                      <p className="text-[11px] font-mono-tabular text-slate-600 truncate">
                        {entry.codeLabel}: {entry.codeValue}
                      </p>
                      <p className="text-[11px] text-sky-700 font-semibold truncate">
                        {entry.roleOrClass}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{entry.email}</p>
                      <p className="text-[10px] font-mono-tabular text-slate-400 truncate">
                        Kode ID: {entry.id}
                      </p>
                    </div>
                  </div>

                  <div className="p-1.5 bg-white border border-slate-200 rounded-lg shrink-0">
                    <QRCodeSVG value={qrPayload} size={58} level="M" />
                  </div>
                </div>

                {/* Footer Strip */}
                <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
                  <span>Aktivasi mandiri via portal login</span>
                  <span className="font-mono-tabular">NPSN {schoolSettings.npsn || '-'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
