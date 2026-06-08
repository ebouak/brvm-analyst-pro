// frontend/components/financials/PrintTrigger.tsx
'use client';
import { useEffect } from 'react';

export default function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 800);
    return () => clearTimeout(t);
  }, []);
  return null;
}
