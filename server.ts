import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebaseClientConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseConfig(): FirebaseClientConfig | null {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as FirebaseClientConfig;
  } catch {
    return null;
  }
}

const firebaseConfig = loadFirebaseConfig();

function isPrivateOrBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === 'metadata.google.internal'
  ) {
    return true;
  }

  if (net.isIPv4(lower)) {
    const parts = lower.split('.').map(Number);
    const [a, b] = parts;
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  if (net.isIPv6(lower)) {
    if (lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
      return true;
    }
  }

  return false;
}

function normalizeAndValidateWpUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    throw new Error('URL situs WordPress belum diisi.');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Format URL situs WordPress tidak valid.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL WordPress harus menggunakan protokol http atau https.');
  }

  if (isPrivateOrBlockedHost(parsed.hostname)) {
    throw new Error('Host tujuan tidak diizinkan demi keamanan jaringan.');
  }

  let pathname = parsed.pathname.replace(/\/+$/, '');
  pathname = pathname.replace(/\/wp-json(?:\/.*)?$/i, '');
  return `${parsed.origin}${pathname}`;
}

function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&#8217;': '’',
    '&#8216;': '‘',
    '&#8220;': '“',
    '&#8221;': '”',
    '&#8211;': '–',
    '&#8212;': '—',
    '&hellip;': '…',
    '&nbsp;': ' ',
  };

  return input
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&[a-zA-Z0-9#]+;/g, (entity) => named[entity] ?? entity);
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    (html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<\/(p|div|li|br|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<globalThis.Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(12000),
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SchoolAcademicPortal/1.0',
      ...(init?.headers || {}),
    },
  });
}

async function verifyAdminRequest(req: Request): Promise<{ uid: string; email: string }> {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error('Autentikasi diperlukan. Silakan login kembali sebagai Admin.');
  }
  const idToken = match[1].trim();
  if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
    throw new Error('Konfigurasi Firebase server belum tersedia.');
  }

  const lookupRes = await fetchWithTimeout(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!lookupRes.ok) {
    throw new Error('Token sesi tidak valid atau telah kedaluwarsa.');
  }
  const lookupData = (await lookupRes.json()) as {
    users?: Array<{ localId: string; email?: string; emailVerified?: boolean }>;
  };
  const user = lookupData.users?.[0];
  if (!user || !user.localId || !user.emailVerified) {
    throw new Error('Akun pengguna belum terverifikasi.');
  }

  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  const adminDocUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents/admins/${encodeURIComponent(user.localId)}`;
  const adminRes = await fetchWithTimeout(adminDocUrl, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!adminRes.ok) {
    throw new Error('Hanya Administrator terverifikasi yang dapat menerbitkan pengumuman ke WordPress.');
  }

  return { uid: user.localId, email: user.email || '' };
}

function parseFirestoreString(field: unknown): string {
  if (!field || typeof field !== 'object') return '';
  const f = field as { stringValue?: string };
  return f.stringValue || '';
}

function parseFirestoreBoolean(field: unknown): boolean {
  if (!field || typeof field !== 'object') return false;
  const f = field as { booleanValue?: boolean };
  return Boolean(f.booleanValue);
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'school-academic-portal' });
  });

  // Test connection to a WordPress site REST API
  app.get('/api/wordpress/test', async (req: Request, res: Response) => {
    try {
      const baseUrl = normalizeAndValidateWpUrl(String(req.query.siteUrl || ''));
      const [rootRes, postsRes] = await Promise.all([
        fetchWithTimeout(`${baseUrl}/wp-json`),
        fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/posts?per_page=1`),
      ]);

      if (!postsRes.ok) {
        if (postsRes.status === 404) {
          res.status(400).json({
            ok: false,
            error:
              'Endpoint REST API WordPress (/wp-json/wp/v2/posts) tidak ditemukan (404). Pastikan Permalink WordPress diset ke "Post name" dan REST API tidak dinonaktifkan.',
          });
          return;
        }
        res.status(400).json({
          ok: false,
          error: `Situs WordPress merespons status HTTP ${postsRes.status}. Periksa aksesibilitas REST API.`,
        });
        return;
      }

      const rootJson = rootRes.ok
        ? ((await rootRes.json()) as { name?: string; description?: string; url?: string })
        : {};
      const totalPostsHeader = postsRes.headers.get('X-WP-Total');
      const postsPreview = (await postsRes.json()) as unknown[];

      res.json({
        ok: true,
        siteUrl: baseUrl,
        siteName: rootJson.name || baseUrl,
        siteDescription: rootJson.description || '',
        totalPosts: totalPostsHeader ? Number(totalPostsHeader) : postsPreview.length,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal terhubung ke situs WordPress.',
      });
    }
  });

  // Fetch WordPress categories
  app.get('/api/wordpress/categories', async (req: Request, res: Response) => {
    try {
      const baseUrl = normalizeAndValidateWpUrl(String(req.query.siteUrl || ''));
      const catRes = await fetchWithTimeout(
        `${baseUrl}/wp-json/wp/v2/categories?per_page=50&orderby=count&order=desc`
      );
      if (!catRes.ok) {
        res.status(400).json({ error: `Gagal memuat kategori WordPress (HTTP ${catRes.status}).` });
        return;
      }
      const raw = (await catRes.json()) as Array<{
        id: number;
        name: string;
        slug: string;
        count: number;
      }>;
      res.json({
        categories: raw.map((c) => ({
          id: c.id,
          name: decodeHtmlEntities(c.name || ''),
          slug: c.slug,
          count: c.count || 0,
        })),
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Gagal memuat kategori WordPress.',
      });
    }
  });

  // Fetch WordPress posts via REST API proxy (avoids browser CORS issues)
  app.get('/api/wordpress/posts', async (req: Request, res: Response) => {
    try {
      const baseUrl = normalizeAndValidateWpUrl(String(req.query.siteUrl || ''));
      const categoryId = String(req.query.categoryId || '').replace(/[^0-9]/g, '');
      const perPageRaw = Number(req.query.perPage || 6);
      const perPage = Math.min(20, Math.max(1, Number.isFinite(perPageRaw) ? perPageRaw : 6));

      const params = new URLSearchParams({
        _embed: '1',
        per_page: String(perPage),
      });
      if (categoryId) {
        params.set('categories', categoryId);
      }

      const postsRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/posts?${params.toString()}`);
      if (!postsRes.ok) {
        res.status(400).json({
          error: `Gagal mengambil artikel WordPress (HTTP ${postsRes.status}).`,
        });
        return;
      }

      interface RawWpPost {
        id: number;
        date: string;
        link: string;
        title?: { rendered?: string };
        excerpt?: { rendered?: string };
        content?: { rendered?: string };
        _embedded?: {
          author?: Array<{ name?: string }>;
          'wp:featuredmedia'?: Array<{ source_url?: string }>;
          'wp:term'?: Array<Array<{ taxonomy?: string; name?: string }>>;
        };
      }

      const rawPosts = (await postsRes.json()) as RawWpPost[];
      const posts = rawPosts.map((p) => {
        const categories =
          p._embedded?.['wp:term']
            ?.flat()
            .filter((t) => t.taxonomy === 'category' && t.name)
            .map((t) => decodeHtmlEntities(t.name || '')) || [];

        const rawImage = p._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
        const safeImage = /^https?:\/\//i.test(rawImage) ? rawImage : undefined;

        return {
          id: p.id,
          title: stripHtml(p.title?.rendered || 'Tanpa Judul'),
          excerpt: stripHtml(p.excerpt?.rendered || ''),
          contentText: stripHtml(p.content?.rendered || p.excerpt?.rendered || ''),
          date: (p.date || '').slice(0, 10),
          link: /^https?:\/\//i.test(p.link || '') ? p.link : baseUrl,
          authorName: decodeHtmlEntities(p._embedded?.author?.[0]?.name || 'Admin Sekolah'),
          featuredImage: safeImage,
          categories,
        };
      });

      res.json({ posts });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Gagal memuat berita dari WordPress.',
      });
    }
  });

  // Check whether server-side Application Password credentials are configured
  app.get('/api/wordpress/publish-status', (_req: Request, res: Response) => {
    const username = (process.env.WP_USERNAME || '').trim();
    const appPassword = (process.env.WP_APP_PASSWORD || '').trim();
    const envSiteUrl = (process.env.WP_SITE_URL || '').trim();
    const configured = Boolean(username && appPassword);
    const maskedUsername = username
      ? `${username.slice(0, 2)}${'*'.repeat(Math.max(2, username.length - 2))}`
      : '';

    res.json({
      configured,
      hasEnvSiteUrl: Boolean(envSiteUrl),
      maskedUsername,
    });
  });

  // Publish portal announcement to WordPress (Admin-only + Server-side Basic Auth via Application Password)
  app.post('/api/wordpress/publish', async (req: Request, res: Response) => {
    try {
      await verifyAdminRequest(req);

      const username = (process.env.WP_USERNAME || '').trim();
      const appPassword = (process.env.WP_APP_PASSWORD || '').trim();
      if (!username || !appPassword) {
        res.status(400).json({
          error:
            'Kredensial publikasi WordPress belum dikonfigurasi di server. Tambahkan WP_USERNAME dan WP_APP_PASSWORD pada menu Secrets / Environment Variables.',
        });
        return;
      }

      const rawSiteUrl = (process.env.WP_SITE_URL || '').trim() || String(req.body?.siteUrl || '');
      const baseUrl = normalizeAndValidateWpUrl(rawSiteUrl);
      const title = String(req.body?.title || '').trim();
      const content = String(req.body?.content || '').trim();
      const status = req.body?.status === 'draft' ? 'draft' : 'publish';

      if (!title || !content) {
        res.status(400).json({ error: 'Judul dan isi pengumuman wajib tersedia.' });
        return;
      }

      const htmlParagraphs = content
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />')}</p>`)
        .join('\n');

      const basicToken = Buffer.from(`${username}:${appPassword}`).toString('base64');
      const wpPayload: Record<string, unknown> = {
        title,
        content: htmlParagraphs,
        status,
      };
      const catNum = Number(req.body?.categoryId);
      if (Number.isInteger(catNum) && catNum > 0) {
        wpPayload.categories = [catNum];
      }

      const wpRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicToken}`,
        },
        body: JSON.stringify(wpPayload),
      });

      if (!wpRes.ok) {
        const errText = await wpRes.text().catch(() => '');
        res.status(400).json({
          error: `WordPress menolak publikasi (HTTP ${wpRes.status}). Periksa WP_USERNAME / Application Password atau hak akses Author/Editor. ${errText.slice(0, 160)}`,
        });
        return;
      }

      const created = (await wpRes.json()) as { id: number; link: string; status: string };
      res.json({
        ok: true,
        postId: created.id,
        link: created.link,
        status: created.status,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Gagal mengirim pengumuman ke WordPress.',
      });
    }
  });

  // Public JSON Feed endpoint for WordPress PHP shortcodes / external widgets
  app.get('/api/public/portal-info', async (req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const origin =
      process.env.APP_URL ||
      `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}`;

    let schoolName = 'School Academic Portal';
    let announcements: Array<{
      id: string;
      title: string;
      content: string;
      publishDate: string;
      authorName: string;
      isPinned: boolean;
    }> = [];

    if (firebaseConfig?.projectId) {
      const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
      try {
        const [settingsRes, annRes] = await Promise.all([
          fetchWithTimeout(
            `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents/school_settings/main`
          ),
          fetchWithTimeout(
            `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents:runQuery`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                structuredQuery: {
                  from: [{ collectionId: 'announcements' }],
                  where: {
                    fieldFilter: {
                      field: { fieldPath: 'targetRole' },
                      op: 'EQUAL',
                      value: { stringValue: 'all' },
                    },
                  },
                  limit: 10,
                },
              }),
            }
          ),
        ]);

        if (settingsRes.ok) {
          const sDoc = (await settingsRes.json()) as { fields?: Record<string, unknown> };
          if (sDoc.fields?.schoolName) {
            schoolName = parseFirestoreString(sDoc.fields.schoolName) || schoolName;
          }
        }

        if (annRes.ok) {
          const rows = (await annRes.json()) as Array<{
            document?: { fields?: Record<string, unknown> };
          }>;
          announcements = rows
            .filter((r) => Boolean(r.document?.fields))
            .map((r) => {
              const f = r.document!.fields!;
              return {
                id: parseFirestoreString(f.id),
                title: parseFirestoreString(f.title),
                content: parseFirestoreString(f.content),
                publishDate: parseFirestoreString(f.publishDate),
                authorName: parseFirestoreString(f.authorName),
                isPinned: parseFirestoreBoolean(f.isPinned),
              };
            })
            .sort((a, b) => b.publishDate.localeCompare(a.publishDate));
        }
      } catch {
        // Return fallback metadata if Firestore REST lookup is unreachable
      }
    }

    res.json({
      portalUrl: origin,
      schoolName,
      announcements,
    });
  });

  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`School Academic Portal server listening on http://0.0.0.0:${PORT}`);
  });
}

void createServer();
