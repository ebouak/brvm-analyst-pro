// frontend/lib/forum/email.ts

import type { ForumPost, ForumReply } from './types.js';

/**
 * Digest data aggregated for email delivery.
 * Contains replies to user's posts, received likes/awards, and trending posts.
 */
export interface DigestData {
  userName: string;
  replies: ForumReply[];
  likes: Array<{
    post: ForumPost;
    count: number;
  }>;
  trending: ForumPost[];
}

/**
 * Sanitize HTML string to prevent injection (server-side).
 */
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Truncate text with ellipsis.
 */
function truncateText(text: string, length: number = 150): string {
  if (text.length <= length) return text;
  return text.substring(0, length).trim() + '…';
}

/**
 * Format date in French locale.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Build HTML for replies section.
 */
function buildRepliesSection(replies: ForumReply[], appUrl: string): string {
  if (replies.length === 0) {
    return '<div class="empty-state">Aucune réponse pour le moment. Continuez à partager vos idées! 💡</div>';
  }

  const replyItems = replies.slice(0, 3).map((reply) => {
    const authorName = reply.author?.display_name || 'Anonyme';
    const likeCountHTML = reply.like_count ? `<span>❤️ ${reply.like_count}</span>` : '';

    return `
      <div class="item">
        <div class="item-author">${escapeHtml(authorName)}</div>
        <div class="item-body">${escapeHtml(truncateText(reply.body, 180))}</div>
        <div class="item-meta">
          <span>📅 ${formatDate(reply.created_at)}</span>
          ${likeCountHTML}
        </div>
        <div class="item-action">
          <a href="${appUrl}/forum/post/${reply.post_id}" class="action-link">
            Lire la suite →
          </a>
        </div>
      </div>
    `;
  }).join('');

  const viewMoreHTML = replies.length > 3
    ? `<div class="item-action" style="margin-top: 16px; text-align: center;">
        <a href="${appUrl}/forum/my-activity" class="action-link">
          Voir les ${replies.length - 3} autres réponses
        </a>
      </div>`
    : '';

  return `<div>${replyItems}${viewMoreHTML}</div>`;
}

/**
 * Build HTML for likes section.
 */
function buildLikesSection(likes: Array<{ post: ForumPost; count: number }>, appUrl: string): string {
  if (likes.length === 0) {
    return '<div class="empty-state">Pas encore de reactions. Partagez plus! 🚀</div>';
  }

  const likeItems = likes.slice(0, 3).map((item) => {
    const postPreview = escapeHtml(truncateText(item.post.body, 120));
    const authorName = item.post.author?.display_name || 'Vous';

    return `
      <div class="like-item">
        <div class="like-item-title">${postPreview}</div>
        <div class="like-item-author">${escapeHtml(authorName)} · ${formatDate(item.post.created_at)}</div>
        <div>
          <span class="like-count">❤️ ${item.count}</span>
        </div>
        <div class="item-action">
          <a href="${appUrl}/forum/post/${item.post.id}" class="action-link">
            Voir la discussion →
          </a>
        </div>
      </div>
    `;
  }).join('');

  const viewMoreHTML = likes.length > 3
    ? `<div class="item-action" style="margin-top: 16px; text-align: center;">
        <a href="${appUrl}/forum/my-posts" class="action-link">
          Voir tous vos posts populaires
        </a>
      </div>`
    : '';

  return `<div class="likes-grid">${likeItems}</div>${viewMoreHTML}`;
}

/**
 * Build HTML for trending section.
 */
function buildTrendingSection(trending: ForumPost[], appUrl: string): string {
  if (trending.length === 0) {
    return '<div class="empty-state">Aucun post populaire cette période. Soyez le premier! 🌟</div>';
  }

  const medals = ['🥇', '🥈', '🥉'];
  const trendingItems = trending.slice(0, 3).map((post, index) => {
    const medal = medals[index] || '•';
    const postPreview = escapeHtml(truncateText(post.body, 100));
    const authorName = post.author?.display_name || 'Anonyme';
    const trendingScore = Math.round((post.trending_score || 0) * 100) / 100;
    const likeCountHTML = post.like_count ? `<span style="color: #7a8494; margin-left: 8px;">❤️ ${post.like_count}</span>` : '';

    return `
      <div class="trending-item">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 20px; font-weight: 700; color: #ffb300;">${medal}</span>
          <div class="trending-item-title" style="flex: 1; margin: 0;">${postPreview}</div>
        </div>
        <div class="trending-item-author">
          ${escapeHtml(authorName)} · ${formatDate(post.created_at)}
        </div>
        <div>
          <span class="trending-score">📈 ${trendingScore}</span>
          ${likeCountHTML}
        </div>
        <div class="item-action">
          <a href="${appUrl}/forum/post/${post.id}" class="action-link">
            Rejoindre la discussion →
          </a>
        </div>
      </div>
    `;
  }).join('');

  return `<div>${trendingItems}</div>`;
}

/**
 * Generates a complete HTML email template for forum digest.
 * Styled with dark-finance colors, mobile-responsive, French text.
 *
 * @param data - Digest aggregation (userName, replies, likes, trending)
 * @returns Complete HTML email document with inline CSS
 */
export function generateDigestHTML(data: DigestData): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://westbourse.app';
  const currentYear = new Date().getFullYear();
  const userName = escapeHtml(data.userName);

  // Encode email for unsubscribe link
  const unsubscribeToken = Buffer.from(`${data.userName}|${Date.now()}`).toString('base64');
  const unsubscribeUrl = `${appUrl}/api/forum/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

  // Build sections
  const repliesSection = buildRepliesSection(data.replies, appUrl);
  const likesSection = buildLikesSection(data.likes, appUrl);
  const trendingSection = buildTrendingSection(data.trending, appUrl);

  // Total likes count
  const totalLikes = data.likes.reduce((sum, item) => sum + item.count, 0);

  return `<!DOCTYPE html>
<html lang="fr" style="margin: 0; padding: 0;">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Forum BRVM — Digest</title>
  <style type="text/css">
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0f1117;
      color: #fcfcfc;
      line-height: 1.6;
      font-size: 14px;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #161922;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .header {
      background: linear-gradient(135deg, #0f1117 0%, #161922 100%);
      padding: 32px 24px;
      text-align: center;
      border-bottom: 2px solid #56d7fd;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #56d7fd;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }

    .header p {
      color: #a0a8b8;
      font-size: 16px;
      margin: 0;
    }

    .content {
      padding: 32px 24px;
    }

    .section {
      margin-bottom: 32px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #fcfcfc;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-title .count {
      display: inline-block;
      background-color: #ffb300;
      color: #0f1117;
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 13px;
      font-weight: 700;
      min-width: 32px;
      text-align: center;
    }

    .item {
      background-color: #0f1117;
      border-left: 3px solid #56d7fd;
      padding: 16px;
      margin-bottom: 12px;
      border-radius: 6px;
    }

    .item-author {
      color: #56d7fd;
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .item-body {
      color: #e0e6ed;
      margin-bottom: 8px;
      line-height: 1.5;
      word-wrap: break-word;
    }

    .item-meta {
      color: #7a8494;
      font-size: 12px;
      display: flex;
      gap: 12px;
    }

    .item-action {
      display: inline-block;
      margin-top: 12px;
    }

    .action-link {
      display: inline-block;
      background-color: #56d7fd;
      color: #0f1117;
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 13px;
      transition: background-color 0.2s;
    }

    .action-link:hover {
      background-color: #40c5e8;
    }

    .empty-state {
      background-color: #0f1117;
      border: 1px dashed #394555;
      border-radius: 6px;
      padding: 20px;
      text-align: center;
      color: #7a8494;
      font-size: 13px;
    }

    .likes-grid {
      display: grid;
      gap: 12px;
    }

    .like-item {
      background-color: #0f1117;
      border-left: 3px solid #ffb300;
      padding: 16px;
      border-radius: 6px;
    }

    .like-item-title {
      color: #fcfcfc;
      font-weight: 600;
      margin-bottom: 6px;
      font-size: 14px;
    }

    .like-item-author {
      color: #7a8494;
      font-size: 12px;
      margin-bottom: 8px;
    }

    .like-count {
      display: inline-block;
      background-color: #ffb300;
      color: #0f1117;
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 700;
    }

    .trending-item {
      background-color: #0f1117;
      border-left: 3px solid #3fe18b;
      padding: 16px;
      margin-bottom: 12px;
      border-radius: 6px;
    }

    .trending-item-title {
      color: #fcfcfc;
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .trending-item-author {
      color: #7a8494;
      font-size: 12px;
      margin-bottom: 8px;
    }

    .trending-score {
      display: inline-block;
      background-color: #3fe18b;
      color: #0f1117;
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 700;
    }

    .footer {
      background-color: #0f1117;
      border-top: 1px solid #394555;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #7a8494;
    }

    .footer-links {
      margin-bottom: 16px;
    }

    .footer-link {
      display: inline-block;
      margin: 0 8px;
    }

    .footer-link a {
      color: #56d7fd;
      text-decoration: none;
      border-bottom: 1px solid #56d7fd;
    }

    .footer-link a:hover {
      color: #40c5e8;
      border-bottom-color: #40c5e8;
    }

    .footer-disclaimer {
      color: #5a6370;
      font-size: 11px;
      margin-top: 16px;
      line-height: 1.4;
    }

    @media (max-width: 600px) {
      .container {
        border-radius: 0;
      }

      .header {
        padding: 24px 16px;
      }

      .header h1 {
        font-size: 24px;
      }

      .content {
        padding: 24px 16px;
      }

      .section {
        margin-bottom: 24px;
      }

      .section-title {
        font-size: 16px;
      }

      .item {
        padding: 12px;
      }

      .footer {
        padding: 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>🌐 Forum BRVM</h1>
      <p>Bonjour <strong>${userName}</strong>, voici votre digest</p>
    </div>

    <!-- Main Content -->
    <div class="content">
      <!-- Replies Section -->
      <div class="section">
        <h2 class="section-title">
          💬 Réponses
          <span class="count">${data.replies.length}</span>
        </h2>
        ${repliesSection}
      </div>

      <!-- Likes & Awards Section -->
      <div class="section">
        <h2 class="section-title">
          ⭐ J'aime & Récompenses
          <span class="count">${totalLikes}</span>
        </h2>
        ${likesSection}
      </div>

      <!-- Trending Section -->
      <div class="section">
        <h2 class="section-title">
          🔥 Tendances
          <span class="count">${data.trending.length}</span>
        </h2>
        ${trendingSection}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        <span class="footer-link">
          <a href="${appUrl}/forum">Retour au Forum</a>
        </span>
        <span class="footer-link">
          <a href="${appUrl}/account/preferences">Mes préférences</a>
        </span>
        <span class="footer-link">
          <a href="${unsubscribeUrl}">Me désabonner</a>
        </span>
      </div>

      <p class="footer-disclaimer">
        Vous recevez ce digest car vous avez activé les notifications du forum.
        <br />
        Vous pouvez gérer votre fréquence de digest dans vos <a href="${appUrl}/account/preferences" style="color: #56d7fd; text-decoration: none;">préférences</a>.
      </p>

      <p style="color: #5a6370; font-size: 10px; margin-top: 12px;">
        © ${currentYear} WESTBOURSE. Tous droits réservés.
        <br />
        <a href="${appUrl}/privacy" style="color: #56d7fd; text-decoration: none; font-size: 10px;">Politique de confidentialité</a> •
        <a href="${appUrl}/terms" style="color: #56d7fd; text-decoration: none; font-size: 10px;">Conditions d'utilisation</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
