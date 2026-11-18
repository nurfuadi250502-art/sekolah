import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePortalData } from '../contexts/PortalDataContext';
import {
  EmptyState,
  PaginationBar,
  TableToolbar,
} from '../components/ui/DataTableControls';
import { exportActivityLogsPdf, exportToExcel } from '../services/exportService';

const PAGE_SIZE = 15;

export function ActivityLogsModule() {
  const { schoolSettings } = useAuth();
  const { activityLogs } = usePortalData();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activityLogs.filter((l) => {
      if (roleFilter !== 'all' && l.userRole !== roleFilter) return false;
      if (!q) return true;
      return (
        l.userName.toLowerCase().includes(q) ||
        l.actionType.toLowerCase().includes(q) ||
        l.targetObject.toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q)
      );
    });
  }, [activityLogs, roleFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2 text-xs text-sky-700 dark:text-cyan-400 font-medium">
        <ShieldCheck className="w-4 h-4" />
        <span>
          Log audit bersifat permanen (append-only) dan hanya dapat dibaca oleh Administrator berwenang.
        </span>
      </div>

      <TableToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Cari nama pengguna, aktivitas, atau objek data..."
        filters={
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
          >
            <option value="all">Semua Peran</option>
            <option value="admin">Admin</option>
            <option value="teacher">Guru</option>
            <option value="student">Siswa</option>
          </select>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exportToExcel(
                  `Log_Aktivitas_${new Date().toISOString().slice(0, 10)}`,
                  'LogAktivitas',
                  filtered.map((l) => ({
                    Waktu: l.createdAt?.toDate ? l.createdAt.toDate().toLocaleString('id-ID') : '-',
                    'ID Pengguna': l.userId,
                    Nama: l.userName,
                    Peran: l.userRole,
                    Aktivitas: l.actionType,
                    Objek: l.targetObject,
                    Detail: l.details || '',
                  }))
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => exportActivityLogsPdf(filtered, schoolSettings)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="Belum ada aktivitas yang cocok"
          description="Seluruh aktivitas login, CRUD data, absensi, nilai, dan unduh laporan akan tercatat otomatis di sini."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Pengguna</th>
                  <th className="py-2.5 px-3">Peran</th>
                  <th className="py-2.5 px-3">Jenis Aktivitas</th>
                  <th className="py-2.5 px-3">Objek & Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {paginated.map((l) => (
                  <tr key={l.id}>
                    <td className="py-3 px-3 font-mono-tabular whitespace-nowrap text-slate-500">
                      {l.createdAt?.toDate ? l.createdAt.toDate().toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="py-3 px-3 font-semibold">{l.userName}</td>
                    <td className="py-3 px-3 uppercase font-mono-tabular">{l.userRole}</td>
                    <td className="py-3 px-3 font-mono-tabular font-semibold text-sky-700 dark:text-cyan-400">
                      {l.actionType}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {l.targetObject}
                      </p>
                      {l.details && (
                        <p className="text-slate-500 dark:text-slate-400">{l.details}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
