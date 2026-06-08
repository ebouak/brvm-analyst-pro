import { getClassement, type CritereClassement } from '@/lib/premium/classements';
import { ClassementsTable } from '@/components/premium/ClassementsTable';

const CRITERES: CritereClassement[] = [
  'performance', 'liquidite', 'volatilite', 'valeur_echangee',
  'marge_nette', 'taux_rotation', 'reserve', 'per', 'pbr',
];

export default async function ClassementsPage({
  searchParams,
}: {
  searchParams: { critere?: string };
}) {
  const critereInit = (CRITERES.includes(searchParams.critere as CritereClassement)
    ? searchParams.critere
    : 'performance') as CritereClassement;

  const results = await Promise.all(CRITERES.map((c) => getClassement(c)));
  const data = Object.fromEntries(
    CRITERES.map((c, i) => [c, results[i]!]),
  ) as Record<CritereClassement, Awaited<ReturnType<typeof getClassement>>>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <span className="text-[10px] font-semibold text-warn uppercase tracking-widest">Premium</span>
        <h1 className="text-2xl font-bold text-white mt-1">Classements des Actions</h1>
        <p className="text-sm text-muted mt-1">Classement de toutes les sociétés BRVM selon 9 critères.</p>
      </div>
      <ClassementsTable data={data} critereInit={critereInit} />
    </div>
  );
}
