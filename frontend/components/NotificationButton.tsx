'use client';

import { useEffect, useState } from 'react';

type Status = 'loading' | 'unsupported' | 'denied' | 'enabled' | 'disabled';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output.buffer as ArrayBuffer;
}

export default function NotificationButton() {
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Vérifier l'état courant à l'initialisation
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'enabled' : 'disabled');
    });
  }, []);

  async function subscribe() {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        setMsg('Permission refusée. Activez les notifications dans les paramètres du navigateur.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setMsg('Clé VAPID non configurée (NEXT_PUBLIC_VAPID_PUBLIC_KEY manquante).');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Erreur serveur (${res.status})`);
      }

      setStatus('enabled');
      setMsg('Notifications activées.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setStatus('disabled');
        return;
      }

      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });

      await sub.unsubscribe();
      setStatus('disabled');
      setMsg('Notifications désactivées.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
      setMsg('Notification test envoyée.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading') {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  if (status === 'unsupported') {
    return (
      <p className="text-sm text-muted">
        Les notifications push ne sont pas supportées par ce navigateur.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {status === 'denied' ? (
        <p className="text-sm text-warn">
          Les notifications sont bloquées dans ce navigateur. Autorisez-les dans les paramètres du
          site puis rechargez la page.
        </p>
      ) : status === 'enabled' ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={unsubscribe}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-down/20 text-down border border-down/40 hover:bg-down/30 disabled:opacity-50 text-sm"
          >
            {busy ? 'En cours…' : '🔕 Désactiver les notifications'}
          </button>
          <button
            type="button"
            onClick={sendTest}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-surface border border-border hover:border-up/40 text-sm disabled:opacity-50"
          >
            Envoyer une notification test
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={subscribe}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-up/20 text-up border border-up/40 hover:bg-up/30 disabled:opacity-50 text-sm"
        >
          {busy ? 'En cours…' : '🔔 Activer les notifications'}
        </button>
      )}

      {msg && (
        <p className="text-sm text-muted border border-border rounded-lg p-2">{msg}</p>
      )}
    </div>
  );
}
