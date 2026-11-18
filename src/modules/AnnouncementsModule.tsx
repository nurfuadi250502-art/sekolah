import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  Edit2,
  ExternalLink,
  Globe,
  Megaphone,
  Pin,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePortalData } from '../contexts/PortalDataContext';
import { useToast } from '../components/ui/ToastProvider';
import { EmptyState, ModalShell } from '../components/ui/DataTableControls';
import {
  deleteCollectionDoc,
  makeId,
  saveAnnouncement,
  saveSchoolSettings,
} from '../services/firestoreService';
import {
  fetchWordPressPosts,
  publishAnnouncementToWordPress,
} from '../services/wordpressService';
import {
  AcademicCalendarEvent,
  Announcement,
  AnnouncementTarget,
  WordPressPost,
} from '../types/portal';

export function AnnouncementsModule() {
  const { userProfile, effectiveRole, schoolSettings } = useAuth();
  const { announcements, classes, currentTeacher, currentStudent } = usePortalData();
  const { showToast } = useToast();

  const role = effectiveRole || 'student';
  const isAdmin = role === 'admin';
  const canCreate = role === 'admin' || role === 'teacher';

  const [subTab, setSubTab] = useState<'announcements' | 'calendar' | 'wordpress'>('announcements');
  const [wpPosts, setWpPosts] = useState<WordPressPost[]>([]);
  const [wpLoading, setWpLoading] = useState(false);
  const [wpError, setWpError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetRole, setTargetRole] = useState<AnnouncementTarget>(
    role === 'teacher' ? 'class' : 'all'
  );
  const [targetClassId, setTargetClassId] = useState('');
  const [publishDate, setPublishDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calendar event form (Admin)
  const [evTitle, setEvTitle] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evEndDate, setEvEndDate] = useState('');
  const [evCategory, setEvCategory] = useState<AcademicCalendarEvent['category']>('Akademik');
  const [evDesc, setEvDesc] = useState('');

  const availableClasses = useMemo(() => {
    if (role === 'teacher' && currentTeacher) {
      return classes.filter((c) => (currentTeacher.classIds || []).includes(c.id));
    }
    return classes;
  }, [classes, role, currentTeacher]);

  const visibleAnnouncements = useMemo(() => {
    return announcements
      .filter((a) => {
        if (role === 'admin') return true;
        if (a.targetRole === 'all') return true;
        if (role === 'teacher' && (a.targetRole === 'teacher' || a.targetRole === 'class')) {
          return true;
        }
        if (role === 'student') {
          if (a.targetRole === 'student') return true;
          if (a.targetRole === 'class') {
            return !currentStudent || a.targetClassId === currentStudent.classId;
          }
        }
        return false;
      })
      .sort((a, b) => {
        if (Boolean(b.isPinned) !== Boolean(a.isPinned)) return b.isPinned ? 1 : -1;
        return (b.publishDate || '').localeCompare(a.publishDate || '');
      });
  }, [announcements, role, currentStudent]);

  const loadWpPosts = async () => {
    if (!schoolSettings.wpSyncEnabled || !schoolSettings.wpSiteUrl) return;
    setWpLoading(true);
    setWpError(null);
    try {
      const posts = await fetchWordPressPosts(schoolSettings.wpSiteUrl, {
        categoryId: schoolSettings.wpCategoryId,
        perPage: 9,
      });
      setWpPosts(posts);
    } catch (err) {
      setWpError(err instanceof Error ? err.message : 'Gagal memuat artikel WordPress.');
    } finally {
      setWpLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'wordpress' && schoolSettings.wpSyncEnabled && schoolSettings.wpSiteUrl) {
      void loadWpPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, schoolSettings.wpSyncEnabled, schoolSettings.wpSiteUrl, schoolSettings.wpCategoryId]);

  const openFromWordPress = (post: WordPressPost) => {
    setEditing(null);
    setTitle(post.title.slice(0, 160));
    setContent((post.contentText || post.excerpt).slice(0, 3900));
    setTargetRole(role === 'teacher' ? 'class' : 'all');
    setTargetClassId(availableClasses[0]?.id || '');
    setPublishDate(post.date || new Date().toISOString().slice(0, 10));
    setExpiryDate('');
    setAttachmentName('Baca Artikel Asli di WordPress');
    setAttachmentUrl(post.link);
    setIsPinned(false);
    setModalOpen(true);
  };

  const handlePublishToWordPress = async (ann: Announcement) => {
    if (!schoolSettings.wpSiteUrl) {
      showToast(
        'error',
        'URL WordPress Belum Diatur',
        'Isi URL situs WordPress di menu Pengaturan Sekolah → Integrasi WordPress.'
      );
      return;
    }
    setPublishingId(ann.id);
    try {
      const res = await publishAnnouncementToWordPress({
        siteUrl: schoolSettings.wpSiteUrl,
        title: ann.title,
        content: ann.content,
        categoryId: schoolSettings.wpCategoryId,
        status: 'publish',
      });
      showToast(
        'success',
        'Berhasil Dikirim ke WordPress',
        `Artikel #${res.postId} telah terbit di situs WordPress sekolah.`
      );
    } catch (err) {
      showToast(
        'error',
        'Gagal Kirim ke WordPress',
        err instanceof Error ? err.message : ''
      );
    } finally {
      setPublishingId(null);
    }
  };

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setContent('');
    setTargetRole(role === 'teacher' ? 'class' : 'all');
    setTargetClassId(availableClasses[0]?.id || '');
    setPublishDate(new Date().toISOString().slice(0, 10));
    setExpiryDate('');
    setAttachmentName('');
    setAttachmentUrl('');
    setIsPinned(false);
    setModalOpen(true);
  };

  const openEdit = (ann: Announcement) => {
    setEditing(ann);
    setTitle(ann.title);
    setContent(ann.content);
    setTargetRole(ann.targetRole);
    setTargetClassId(ann.targetClassId || '');
    setPublishDate(ann.publishDate);
    setExpiryDate(ann.expiryDate || '');
    setAttachmentName(ann.attachmentName || '');
    setAttachmentUrl(ann.attachmentUrl || '');
    setIsPinned(Boolean(ann.isPinned));
    setModalOpen(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !title.trim() || !content.trim()) return;
    if (targetRole === 'class' && !targetClassId) {
      showToast('error', 'Pilih kelas tujuan pengumuman');
      return;
    }

    const cls = classes.find((c) => c.id === targetClassId);
    setSaving(true);
    try {
      await saveAnnouncement(
        {
          id: editing?.id || '',
          title,
          content,
          targetRole: role === 'teacher' ? 'class' : targetRole,
          targetClassId: targetRole === 'class' ? targetClassId : '',
          targetClassName: targetRole === 'class' ? cls?.name || '' : '',
          publishDate,
          expiryDate,
          attachmentName,
          attachmentUrl,
          authorId: userProfile.uid,
          authorName: userProfile.displayName,
          authorRole: role === 'teacher' ? 'teacher' : 'admin',
          isPinned,
          isNew: !editing,
        },
        {
          uid: userProfile.uid,
          name: userProfile.displayName,
          role: role === 'teacher' ? 'teacher' : 'admin',
        }
      );
      showToast(
        'success',
        editing ? 'Pengumuman Diperbarui' : 'Pengumuman Diterbitkan',
        'Notifikasi pengumuman telah dikirimkan ke target pengguna.'
      );
      setModalOpen(false);
    } catch (err) {
      showToast('error', 'Gagal Menyimpan Pengumuman', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !evTitle.trim() || !evDate) return;
    const nextEvents: AcademicCalendarEvent[] = [
      ...(schoolSettings.calendarEvents || []),
      {
        id: makeId('cal'),
        title: evTitle.trim(),
        date: evDate,
        endDate: evEndDate || undefined,
        category: evCategory,
        description: evDesc.trim() || undefined,
      },
    ].sort((a, b) => a.date.localeCompare(b.date));

    try {
      await saveSchoolSettings(
        { ...schoolSettings, calendarEvents: nextEvents },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      setEvTitle('');
      setEvDate('');
      setEvEndDate('');
      setEvDesc('');
      showToast('success', 'Agenda Kalender Ditambahkan');
    } catch (err) {
      showToast('error', 'Gagal Menyimpan Agenda', err instanceof Error ? err.message : '');
    }
  };

  const handleRemoveCalendarEvent = async (evId: string) => {
    if (!userProfile) return;
    const nextEvents = (schoolSettings.calendarEvents || []).filter((e) => e.id !== evId);
    try {
      await saveSchoolSettings(
        { ...schoolSettings, calendarEvents: nextEvents },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast('success', 'Agenda Kalender Dihapus');
    } catch (err) {
      showToast('error', 'Gagal Menghapus', err instanceof Error ? err.message : '');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab('announcements')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold ${
              subTab === 'announcements'
                ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Pengumuman Sekolah & Kelas
          </button>
          <button
            type="button"
            onClick={() => setSubTab('calendar')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold ${
              subTab === 'calendar'
                ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Kalender Akademik
          </button>
          <button
            type="button"
            onClick={() => setSubTab('wordpress')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold ${
              subTab === 'wordpress'
                ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Berita WordPress
          </button>
        </div>

        {subTab === 'announcements' && canCreate && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Buat Pengumuman
          </button>
        )}

        {subTab === 'wordpress' && schoolSettings.wpSyncEnabled && schoolSettings.wpSiteUrl && (
          <button
            type="button"
            onClick={() => void loadWpPosts()}
            disabled={wpLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${wpLoading ? 'animate-spin' : ''}`} />
            Segarkan Berita
          </button>
        )}
      </div>

      {subTab === 'announcements' && (
        <div className="space-y-4">
          {visibleAnnouncements.length === 0 ? (
            <EmptyState
              title="Belum ada pengumuman"
              description="Pengumuman sekolah dan pengumuman kelas akan tampil di halaman ini."
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {visibleAnnouncements.map((ann) => {
                const canModify = isAdmin || (role === 'teacher' && ann.authorId === userProfile?.uid);
                return (
                  <article
                    key={ann.id}
                    className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-tabular">{ann.publishDate}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Target:{' '}
                            {ann.targetRole === 'all'
                              ? 'Semua Pengguna'
                              : ann.targetRole === 'teacher'
                                ? 'Guru'
                                : ann.targetRole === 'student'
                                  ? 'Siswa'
                                  : `Kelas ${ann.targetClassName || ann.targetClassId}`}
                          </span>
                          {ann.isPinned && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 text-sky-700 dark:text-cyan-400 font-semibold">
                                <Pin className="w-3 h-3" />
                                Disematkan
                              </span>
                            </>
                          )}
                        </div>
                        {canModify && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(ann)}
                              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                userProfile &&
                                void deleteCollectionDoc('announcements', ann.id, ann.title, {
                                  uid: userProfile.uid,
                                  name: userProfile.displayName,
                                  role: userProfile.role,
                                })
                              }
                              className="p-1 text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />
                        {ann.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-line leading-relaxed">
                        {ann.content}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>Oleh {ann.authorName}</span>
                      <div className="flex items-center gap-3">
                        {isAdmin && schoolSettings.wpSiteUrl && (
                          <button
                            type="button"
                            disabled={publishingId === ann.id}
                            onClick={() => void handlePublishToWordPress(ann)}
                            className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-200 font-semibold hover:text-sky-700 dark:hover:text-cyan-400"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {publishingId === ann.id ? 'Mengirim...' : 'Kirim ke WordPress'}
                          </button>
                        )}
                        {ann.attachmentUrl && (
                          <a
                            href={ann.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sky-700 dark:text-cyan-400 font-semibold hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {ann.attachmentName || 'Lampiran'}
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'wordpress' && (
        <div className="space-y-4">
          {!schoolSettings.wpSyncEnabled || !schoolSettings.wpSiteUrl ? (
            <EmptyState
              title="Integrasi WordPress belum diaktifkan"
              description="Administrator dapat menghubungkan URL situs WordPress sekolah pada menu Pengaturan Sekolah → Integrasi WordPress."
            />
          ) : wpLoading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-52 rounded-xl bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : wpError ? (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl p-5 text-sm text-rose-700 dark:text-rose-300">
              {wpError}
            </div>
          ) : wpPosts.length === 0 ? (
            <EmptyState
              title="Belum ada artikel WordPress ditemukan"
              description="Periksa filter kategori atau pastikan situs WordPress memiliki artikel berstatus Publish."
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wpPosts.map((post) => (
                <article
                  key={post.id}
                  className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {post.featuredImage && (
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-40 object-cover border-b border-slate-200 dark:border-slate-800"
                      />
                    )}
                    <div className="p-5">
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-mono-tabular">{post.date}</span>
                        <span aria-hidden="true">·</span>
                        <span>{post.authorName}</span>
                        {post.categories[0] && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-sky-700 dark:text-cyan-400 font-semibold">
                              {post.categories[0]}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug flex items-start gap-2">
                        <Globe className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0 mt-1" />
                        <span>{post.title}</span>
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-4 leading-relaxed">
                        {post.excerpt}
                      </p>
                    </div>
                  </div>
                  <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sky-700 dark:text-cyan-400 font-semibold hover:underline"
                    >
                      Baca di WordPress
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => openFromWordPress(post)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Download className="w-3 h-3" />
                        Impor ke Portal
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'calendar' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {isAdmin && (
            <form
              onSubmit={handleAddCalendarEvent}
              className="lg:col-span-4 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 h-fit"
            >
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600" />
                Tambah Agenda Kalender
              </h3>
              <input
                required
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                placeholder="Nama kegiatan akademik"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={evDate}
                    onChange={(e) => setEvDate(e.target.value)}
                    className="w-full px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={evEndDate}
                    onChange={(e) => setEvEndDate(e.target.value)}
                    className="w-full px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                  />
                </div>
              </div>
              <select
                value={evCategory}
                onChange={(e) => setEvCategory(e.target.value as AcademicCalendarEvent['category'])}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                <option value="Akademik">Akademik</option>
                <option value="Ujian">Ujian</option>
                <option value="Libur">Libur</option>
                <option value="Kegiatan">Kegiatan</option>
              </select>
              <textarea
                rows={2}
                value={evDesc}
                onChange={(e) => setEvDesc(e.target.value)}
                placeholder="Keterangan singkat (opsional)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white text-xs font-semibold"
              >
                Simpan ke Kalender Akademik
              </button>
            </form>
          )}

          <div
            className={`${
              isAdmin ? 'lg:col-span-8' : 'lg:col-span-12'
            } bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800`}
          >
            {(schoolSettings.calendarEvents || []).map((ev) => (
              <div key={ev.id} className="p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-mono-tabular text-sky-700 dark:text-cyan-400 font-semibold">
                    {ev.date}
                    {ev.endDate ? ` — ${ev.endDate}` : ''} · {ev.category}
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {ev.title}
                  </p>
                  {ev.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {ev.description}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveCalendarEvent(ev.id)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Pengumuman' : 'Terbitkan Pengumuman Baru'}
      >
        <form onSubmit={handleSaveAnnouncement} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium mb-1">Judul Pengumuman *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Target Penerima</label>
              <select
                disabled={role === 'teacher'}
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as AnnouncementTarget)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                {isAdmin && (
                  <>
                    <option value="all">Semua Pengguna (Publik & Portal)</option>
                    <option value="teacher">Khusus Guru</option>
                    <option value="student">Khusus Siswa</option>
                  </>
                )}
                <option value="class">Kelas Tertentu</option>
              </select>
            </div>
            {targetRole === 'class' && (
              <div>
                <label className="block font-medium mb-1">Kelas Tujuan</label>
                <select
                  required
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                >
                  <option value="">Pilih Kelas</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block font-medium mb-1">Isi Pengumuman *</label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Tanggal Publikasi</label>
              <input
                type="date"
                required
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Masa Berlaku (opsional)</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Nama Lampiran (opsional)</label>
              <input
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                placeholder="Misal: Surat Edaran UTS.pdf"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Tautan Lampiran URL (opsional)</label>
              <input
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
            />
            <span>Sematkan di bagian atas pengumuman</span>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white font-semibold"
            >
              {saving ? 'Menerbitkan...' : 'Simpan Pengumuman'}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
