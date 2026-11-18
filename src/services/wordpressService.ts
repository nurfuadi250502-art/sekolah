import { auth } from '../lib/firebase';
import { WordPressCategory, WordPressPost } from '../types/portal';

export interface WordPressConnectionResult {
  ok: boolean;
  siteUrl?: string;
  siteName?: string;
  siteDescription?: string;
  totalPosts?: number;
  error?: string;
}

export interface WordPressPublishStatus {
  configured: boolean;
  hasEnvSiteUrl: boolean;
  maskedUsername: string;
}

export async function testWordPressConnection(
  siteUrl: string
): Promise<WordPressConnectionResult> {
  const res = await fetch(
    `/api/wordpress/test?siteUrl=${encodeURIComponent(siteUrl.trim())}`
  );
  const data = (await res.json()) as WordPressConnectionResult;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Gagal menguji koneksi ke WordPress.');
  }
  return data;
}

export async function fetchWordPressCategories(
  siteUrl: string
): Promise<WordPressCategory[]> {
  if (!siteUrl.trim()) return [];
  const res = await fetch(
    `/api/wordpress/categories?siteUrl=${encodeURIComponent(siteUrl.trim())}`
  );
  const data = (await res.json()) as { categories?: WordPressCategory[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memuat kategori WordPress.');
  }
  return data.categories || [];
}

export async function fetchWordPressPosts(
  siteUrl: string,
  options?: { categoryId?: string; perPage?: number }
): Promise<WordPressPost[]> {
  if (!siteUrl.trim()) return [];
  const params = new URLSearchParams({ siteUrl: siteUrl.trim() });
  if (options?.categoryId) params.set('categoryId', options.categoryId);
  if (options?.perPage) params.set('perPage', String(options.perPage));

  const res = await fetch(`/api/wordpress/posts?${params.toString()}`);
  const data = (await res.json()) as { posts?: WordPressPost[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memuat artikel WordPress.');
  }
  return data.posts || [];
}

export async function getWordPressPublishStatus(): Promise<WordPressPublishStatus> {
  try {
    const res = await fetch('/api/wordpress/publish-status');
    if (!res.ok) {
      return { configured: false, hasEnvSiteUrl: false, maskedUsername: '' };
    }
    return (await res.json()) as WordPressPublishStatus;
  } catch {
    return { configured: false, hasEnvSiteUrl: false, maskedUsername: '' };
  }
}

export async function publishAnnouncementToWordPress(params: {
  siteUrl: string;
  title: string;
  content: string;
  categoryId?: string;
  status?: 'publish' | 'draft';
}): Promise<{ postId: number; link: string; status: string }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Anda harus login sebagai Admin untuk mengirim ke WordPress.');
  }
  const idToken = await user.getIdToken();

  const res = await fetch('/api/wordpress/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    postId?: number;
    link?: string;
    status?: string;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Gagal menerbitkan pengumuman ke WordPress.');
  }
  return {
    postId: data.postId || 0,
    link: data.link || params.siteUrl,
    status: data.status || 'publish',
  };
}

export function buildWordPressIframeEmbed(portalOrigin: string, height = 780): string {
  const cleanOrigin = portalOrigin.replace(/\/+$/, '');
  return `<div class="school-academic-portal-embed" style="width:100%;max-width:1280px;margin:0 auto;">
  <iframe
    src="${cleanOrigin}"
    title="School Academic Portal"
    style="width:100%;height:${height}px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;"
    loading="lazy"
    allow="fullscreen"
  ></iframe>
</div>`;
}

export function buildWordPressShortcodeSnippet(portalOrigin: string): string {
  const cleanOrigin = portalOrigin.replace(/\/+$/, '');
  return `<?php
/**
 * Shortcode WordPress untuk School Academic Portal
 * Tempelkan kode ini ke functions.php tema anak (Child Theme) atau plugin Code Snippets.
 * Penggunaan di halaman/artikel:
 *   [school_academic_portal height="820"]
 *   [school_portal_announcements limit="5"]
 */
function sap_portal_embed_shortcode($atts) {
    $atts = shortcode_atts(array(
        'height' => '820',
        'url'    => '${cleanOrigin}',
    ), $atts, 'school_academic_portal');

    $url = esc_url($atts['url']);
    $height = intval($atts['height']);

    return '<div style="width:100%;margin:16px 0;"><iframe src="' . $url . '" title="School Academic Portal" style="width:100%;height:' . $height . 'px;border:1px solid #e2e8f0;border-radius:12px;" loading="lazy"></iframe></div>';
}
add_shortcode('school_academic_portal', 'sap_portal_embed_shortcode');

function sap_portal_announcements_shortcode($atts) {
    $atts = shortcode_atts(array(
        'limit' => '5',
        'api'   => '${cleanOrigin}/api/public/portal-info',
    ), $atts, 'school_portal_announcements');

    $response = wp_remote_get(esc_url_raw($atts['api']), array('timeout' => 8));
    if (is_wp_error($response)) {
        return '<p>Pengumuman portal sedang tidak tersedia.</p>';
    }

    $data = json_decode(wp_remote_retrieve_body($response), true);
    $items = isset($data['announcements']) && is_array($data['announcements']) ? array_slice($data['announcements'], 0, intval($atts['limit'])) : array();
    if (empty($items)) {
        return '<p>Belum ada pengumuman terbaru dari portal akademik.</p>';
    }

    $html = '<div class="sap-announcements" style="display:grid;gap:12px;">';
    foreach ($items as $item) {
        $title = esc_html($item['title'] ?? '');
        $date = esc_html($item['publishDate'] ?? '');
        $content = esc_html(wp_trim_words($item['content'] ?? '', 28));
        $html .= '<div style="padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;">';
        $html .= '<div style="font-size:12px;color:#64748b;">' . $date . '</div>';
        $html .= '<h4 style="margin:4px 0 6px;font-size:16px;">' . $title . '</h4>';
        $html .= '<p style="margin:0;font-size:14px;color:#334155;">' . $content . '</p>';
        $html .= '</div>';
    }
    $html .= '</div>';
    return $html;
}
add_shortcode('school_portal_announcements', 'sap_portal_announcements_shortcode');`;
}
