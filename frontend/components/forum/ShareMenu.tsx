'use client';

import { useState } from 'react';

export interface ShareMenuProps {
  postTitle: string;
  shareUrl: string;
}

const SHARE_TARGETS = [
  {
    name: 'Twitter/X',
    icon: '𝕏',
    href: (title: string, url: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    name: 'LinkedIn',
    icon: '💼',
    href: (title: string, url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'WhatsApp',
    icon: '💬',
    href: (title: string, url: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
];

/**
 * Share menu: social platforms + copy link
 */
export function ShareMenu({ postTitle, shareUrl }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full hover:text-accent hover:bg-accent/10 transition"
        title="Partager"
        aria-label="Partager"
      >
        <span>🔗</span>
        <span className="text-xs">Partager</span>
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 bg-surface border border-border rounded-lg shadow-lg p-2 z-40 min-w-max"
          role="menu"
        >
          {SHARE_TARGETS.map((target) => (
            <a
              key={target.name}
              href={target.href(postTitle, shareUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 hover:bg-elevated rounded text-sm transition text-ivory"
              role="menuitem"
            >
              <span>{target.icon}</span>
              {target.name}
            </a>
          ))}
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-elevated rounded text-sm transition text-ivory"
            role="menuitem"
          >
            <span>📋</span>
            {copied ? 'Copié!' : 'Copier le lien'}
          </button>
        </div>
      )}
    </div>
  );
}
