import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ActivityLog,
  AttendanceRecord,
  GradeRecord,
  SchoolSettings,
  Student,
  Teacher,
} from '../types/portal';

export function exportToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[]
): void {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function parseExcelOrCsvFile(
  file: File
): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  const worksheet = workbook.Sheets[firstSheet];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
  });
}

function addPdfHeader(
  docPdf: jsPDF,
  title: string,
  subtitle: string,
  settings: SchoolSettings
): number {
  docPdf.setFillColor(15, 41, 74);
  docPdf.rect(0, 0, docPdf.internal.pageSize.getWidth(), 28, 'F');
  docPdf.setTextColor(255, 255, 255);
  docPdf.setFontSize(14);
  docPdf.text(settings.schoolName, 14, 12);
  docPdf.setFontSize(9);
  docPdf.text(settings.address, 14, 18);
  docPdf.text(`Telp: ${settings.phone} | Email: ${settings.email}`, 14, 23);

  docPdf.setTextColor(15, 23, 42);
  docPdf.setFontSize(13);
  docPdf.text(title, 14, 38);
  docPdf.setFontSize(9);
  docPdf.setTextColor(71, 85, 105);
  docPdf.text(subtitle, 14, 44);
  return 50;
}

export function exportStudentsPdf(
  students: Student[],
  settings: SchoolSettings
): void {
  const docPdf = new jsPDF({ orientation: 'landscape' });
  const startY = addPdfHeader(
    docPdf,
    'Laporan Data Induk Siswa',
    `Dicetak pada ${new Date().toLocaleDateString('id-ID')} · Total ${students.length} siswa`,
    settings
  );

  autoTable(docPdf, {
    startY,
    head: [['No', 'NIS', 'NISN', 'Nama Lengkap', 'L/P', 'Kelas', 'Email', 'Tahun Masuk', 'Status']],
    body: students.map((s, idx) => [
      idx + 1,
      s.nis,
      s.nisn,
      s.fullName,
      s.gender,
      s.className || s.classId,
      s.email,
      s.entryYear,
      s.status,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 41, 74] },
  });

  docPdf.save(`Data_Siswa_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportTeachersPdf(
  teachers: Teacher[],
  settings: SchoolSettings
): void {
  const docPdf = new jsPDF({ orientation: 'landscape' });
  const startY = addPdfHeader(
    docPdf,
    'Laporan Data Pendidik & Guru',
    `Dicetak pada ${new Date().toLocaleDateString('id-ID')} · Total ${teachers.length} guru`,
    settings
  );

  autoTable(docPdf, {
    startY,
    head: [['No', 'Kode', 'NIP/NUPTK', 'Nama Lengkap', 'L/P', 'Mata Pelajaran', 'Kelas Diajar', 'Status', 'Email']],
    body: teachers.map((t, idx) => [
      idx + 1,
      t.teacherCode,
      t.nip || '-',
      t.fullName,
      t.gender,
      (t.subjectNames || []).join(', ') || '-',
      (t.classNames || []).join(', ') || '-',
      t.employmentStatus,
      t.email,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 41, 74] },
  });

  docPdf.save(`Data_Guru_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportAttendancePdf(
  records: AttendanceRecord[],
  subtitle: string,
  settings: SchoolSettings
): void {
  const docPdf = new jsPDF({ orientation: 'landscape' });
  const startY = addPdfHeader(docPdf, 'Laporan Rekapitulasi Absensi Siswa', subtitle, settings);

  autoTable(docPdf, {
    startY,
    head: [['No', 'Tanggal', 'NIS', 'Nama Siswa', 'Kelas', 'Mata Pelajaran', 'Status', 'Guru Pengampu', 'Catatan']],
    body: records.map((r, idx) => [
      idx + 1,
      r.date,
      r.studentNis || '-',
      r.studentName || r.studentId,
      r.className || r.classId,
      r.subjectName || r.subjectId,
      r.status,
      r.teacherName || '-',
      r.notes || '-',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 41, 74] },
  });

  docPdf.save(`Laporan_Absensi_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportGradesPdf(
  records: GradeRecord[],
  subtitle: string,
  settings: SchoolSettings
): void {
  const docPdf = new jsPDF({ orientation: 'landscape' });
  const startY = addPdfHeader(docPdf, 'Laporan Nilai Akademik Siswa', subtitle, settings);

  autoTable(docPdf, {
    startY,
    head: [
      ['No', 'NIS', 'Nama Siswa', 'Kelas', 'Mata Pelajaran', 'Tugas', 'Kuis', 'UH', 'PTS', 'PAS', 'Praktik', 'Akhir', 'Predikat'],
    ],
    body: records.map((g, idx) => [
      idx + 1,
      g.studentNis || '-',
      g.studentName || g.studentId,
      g.className || g.classId,
      g.subjectName || g.subjectId,
      g.tugas,
      g.kuis,
      g.ulanganHarian,
      g.pts,
      g.pas,
      g.praktik,
      g.finalScore,
      g.letterGrade,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 41, 74] },
  });

  docPdf.save(`Laporan_Nilai_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportActivityLogsPdf(
  logs: ActivityLog[],
  settings: SchoolSettings
): void {
  const docPdf = new jsPDF({ orientation: 'landscape' });
  const startY = addPdfHeader(
    docPdf,
    'Laporan Log Aktivitas Sistem',
    `Total ${logs.length} entri aktivitas tercatat`,
    settings
  );

  autoTable(docPdf, {
    startY,
    head: [['Waktu', 'Pengguna', 'Peran', 'Aktivitas', 'Objek', 'Detail']],
    body: logs.map((l) => [
      l.createdAt?.toDate ? l.createdAt.toDate().toLocaleString('id-ID') : '-',
      l.userName,
      l.userRole,
      l.actionType,
      l.targetObject,
      l.details || '-',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 41, 74] },
  });

  docPdf.save(`Log_Aktivitas_${new Date().toISOString().slice(0, 10)}.pdf`);
}
