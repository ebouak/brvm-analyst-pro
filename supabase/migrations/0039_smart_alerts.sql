-- Alertes intelligentes : étend les types et rend le seuil optionnel.
-- Nouveaux types pilotés par les données quotidiennes (signal, RSI, dividende).

ALTER TABLE public.alerts ALTER COLUMN seuil DROP NOT NULL;

ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_type_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_type_check CHECK (
  type IN (
    'prix_au_dessus', 'prix_en_dessous', 'variation',
    'signal_achat', 'signal_vente',
    'rsi_survente', 'rsi_surachat',
    'dividende_proche'
  )
);
