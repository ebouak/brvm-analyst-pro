# Politique de sécurité / Security policy

## Signaler une faille

Merci de **ne pas ouvrir d'issue publique** pour une faille de sécurité.

Deux canaux privés :

1. **GitHub** : onglet *Security* → *Report a vulnerability* (signalement privé,
   visible du seul mainteneur).
2. **E-mail** : support@westbourse.com, objet commençant par `[SECURITE]`.

Indiquez si possible : la ressource concernée (URL, route, fichier), les étapes
pour reproduire, l'impact constaté, et n'utilisez que vos propres comptes ou des
données de test.

Nous accusons réception sous **3 jours ouvrés** et vous tenons informé jusqu'à la
correction. Nous créditons volontiers l'auteur du signalement s'il le souhaite.

## Périmètre

- Le site `westbourse.com` et ses routes `/api/*`.
- Le code de ce dépôt (`frontend/`, `scraper/`, `video/`, `supabase/`).

Hors périmètre : déni de service et tests de charge, ingénierie sociale, services
tiers (Supabase, Vercel, Resend, GitHub) pour leurs propres failles.

## Clés présentes dans l'historique git

Des clés figurent dans l'historique de ce dépôt public. Elles ont été **révoquées**
et leur révocation a été vérifiée service par service. Un signalement reste
bienvenu si vous constatez qu'une clé de l'historique est encore acceptée par un
service, quel qu'il soit.

---

## Reporting a vulnerability (English)

Please **do not open a public issue** for security problems.

Use either private channel:

1. **GitHub**: *Security* tab → *Report a vulnerability* (private, visible to the
   maintainer only).
2. **Email**: support@westbourse.com, subject starting with `[SECURITY]`.

Please include the affected resource, reproduction steps and observed impact, and
only use your own accounts or test data. We acknowledge reports within
**3 business days** and keep you updated until a fix ships. Credit is given on
request.

Out of scope: denial of service and load testing, social engineering, and
vulnerabilities in third-party services themselves.

Keys visible in the git history have been revoked, and each revocation was tested
on every service. Reports are still welcome if any of them is accepted anywhere.
