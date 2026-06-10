'use client';

import { useState, useTransition } from 'react';
import { saveInvestorProfile } from '@/app/onboarding/actions';

type Step = 1 | 2 | 3;

const PROFILS = [
  { key: 'prudent', label: 'Prudent', desc: 'Préserver le capital, faible volatilité' },
  { key: 'modere', label: 'Modéré', desc: 'Équilibre rendement / risque' },
  { key: 'agressif', label: 'Agressif', desc: 'Croissance maximale, risque assumé' },
] as const;

const HORIZONS = [
  { key: 'court', label: 'Court terme', desc: '< 1 an' },
  { key: 'moyen', label: 'Moyen terme', desc: '1 – 5 ans' },
  { key: 'long', label: 'Long terme', desc: '> 5 ans' },
] as const;

export default function OnboardingModal() {
  const [step, setStep] = useState<Step>(1);
  const [profil, setProfil] = useState<string>('modere');
  const [horizon, setHorizon] = useState<string>('moyen');
  const [debutant, setDebutant] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const fd = new FormData();
    fd.set('profil', profil);
    fd.set('horizon', horizon);
    fd.set('mode_debutant', String(debutant));
    setError(null);
    startTransition(async () => {
      const res = await saveInvestorProfile(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-6">

        {step === 1 && (
          <>
            <div className="space-y-1">
              <p className="text-[10px] text-faint uppercase tracking-wide">Bienvenue · Étape 1/3</p>
              <h2 className="text-lg font-semibold text-ivory">Quel est votre profil ?</h2>
              <p className="text-xs text-muted">Personnalise vos signaux et recommandations.</p>
            </div>
            <div className="space-y-2">
              {PROFILS.map(({ key, label, desc }) => (
                <button key={key} type="button" onClick={() => setProfil(key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    profil === key ? 'border-cyan/50 bg-cyan/10 text-ivory' : 'border-border text-muted hover:border-cyan/30'
                  }`}>
                  <span className="font-semibold text-sm">{label}</span>
                  <span className="text-xs text-faint ml-2">{desc}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setStep(2)}
              className="w-full py-2.5 rounded-xl bg-cyan/90 text-bg font-semibold text-sm hover:bg-cyan transition">
              Suivant →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-1">
              <p className="text-[10px] text-faint uppercase tracking-wide">Étape 2/3</p>
              <h2 className="text-lg font-semibold text-ivory">Votre horizon d&apos;investissement ?</h2>
            </div>
            <div className="space-y-2">
              {HORIZONS.map(({ key, label, desc }) => (
                <button key={key} type="button" onClick={() => setHorizon(key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    horizon === key ? 'border-cyan/50 bg-cyan/10 text-ivory' : 'border-border text-muted hover:border-cyan/30'
                  }`}>
                  <span className="font-semibold text-sm">{label}</span>
                  <span className="text-xs text-faint ml-2">{desc}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm hover:border-cyan/30 transition">
                ← Retour
              </button>
              <button type="button" onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-xl bg-cyan/90 text-bg font-semibold text-sm hover:bg-cyan transition">
                Suivant →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="space-y-1">
              <p className="text-[10px] text-faint uppercase tracking-wide">Étape 3/3</p>
              <h2 className="text-lg font-semibold text-ivory">Votre niveau d&apos;expérience ?</h2>
              <p className="text-xs text-muted">Le mode débutant remplace le jargon par des explications simples.</p>
            </div>
            <div className="space-y-2">
              {[
                { val: false, label: 'Investisseur averti', desc: 'Termes techniques complets' },
                { val: true, label: 'Mode débutant', desc: 'Explications simplifiées' },
              ].map(({ val, label, desc }) => (
                <button key={String(val)} type="button" onClick={() => setDebutant(val)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    debutant === val ? 'border-cyan/50 bg-cyan/10 text-ivory' : 'border-border text-muted hover:border-cyan/30'
                  }`}>
                  <span className="font-semibold text-sm">{label}</span>
                  <span className="text-xs text-faint ml-2">{desc}</span>
                </button>
              ))}
            </div>
            {error && (
              <p className="text-xs text-down">{error}</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm hover:border-cyan/30 transition">
                ← Retour
              </button>
              <button type="button" onClick={submit} disabled={pending}
                className="flex-1 py-2.5 rounded-xl bg-up/90 text-bg font-semibold text-sm hover:bg-up transition disabled:opacity-50">
                {pending ? 'Enregistrement…' : 'Commencer →'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
