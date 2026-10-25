# Décisions DevScroll

Date : 25 octobre 2026.

## D001 — Architecture

Application Next.js App Router, React et TypeScript sur Node.js 22.19. PostgreSQL 16, accessible avec `pg` et migrations SQL explicites : transactions, recherche plein texte et verrous restent lisibles. Cet accès SQL remplace Prisma, proposé mais non imposé par la feuille de route. Un processus Node séparé traite les jobs. Pas de Redis ni de base vectorielle.

## D002 — Accès privé

Better Auth avec sessions persistantes PostgreSQL et connexion email/mot de passe. Inscription publique désactivée. Un script local crée le propriétaire ; aucun identifiant codé en dur. Les API vérifient session, rôle, origine et entrées. La clé IA reste facultative.

## D003 — Exécution et hébergement

Développement : PostgreSQL local isolé dans `.local/`, port 55432, ou Docker Compose. Aucun service PostgreSQL existant n'est modifié. Production cible : hôte Node/Docker avec web, worker et PostgreSQL persistants derrière TLS. Le runtime Cloudflare de Sites ne correspond pas au worker et au PostgreSQL TCP demandés ; pas de migration de stack ni d'achat implicite. Le déploiement réel exige un hôte accessible.

## D004 — Périmètre et vérification

Réaliser les lots dans l'ordre, vérifier chaque incrément, puis poursuivre. Les lots 7–9 comportent des conditions : 14 jours d'usage, besoin observé pour les embeddings, décision distincte pour l'ouverture. Préparer les outils et protocoles réalisables maintenant sans inventer un retour d'usage, une mesure terrain ou une mise en ligne. Génération manuelle, désactivée sans budget, aucun achat, aucune inscription publique.

## D005 — Contenu

30 posts français originaux de démonstration, au moins 8 thèmes, 6 formats et 12 questions. 60 sujets supplémentaires dans un backlog éditorial. Sources officielles reliées aux affirmations ; les vérifications non exécutées sont signalées. Texte, code, comparaisons et carrousels ; pas d'images générées systématiques. Le corpus est indépendant des interactions et les versions publiées sont immuables.

## D006 — Commandes prévues

`npm ci`, `npm run setup:local`, `npm run db:migrate`, `npm run db:seed`, `npm run owner:create`, `npm run dev`, `npm run worker`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run build`. Versions exactes et résultats consignés après installation.

## Plan du lot 1

1. Verrouiller les dépendances compatibles avec Node 22.
2. Initialiser TypeScript, Next, scripts et variables documentées.
3. Démarrer une base PostgreSQL dédiée, migrer et créer le propriétaire par script.
4. Vérifier connexion, déconnexion, protection serveur, navigation et carte de lecture.
5. Consigner les commandes réellement exécutées avant d'activer le fil du lot 2.

Références : [Next.js, installation](https://nextjs.org/docs/app/getting-started/installation), [Better Auth, installation](https://www.better-auth.com/docs/installation), [PostgreSQL, pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html). Versions npm vérifiées lors de l'installation ; Node local : 22.19.0.
