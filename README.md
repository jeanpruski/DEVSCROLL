# DevScroll

Application privée en français pour découvrir des notions techniques, garder des posts et les réviser à son rythme. Fil, favoris, recherche PostgreSQL, QCM différés, atelier éditorial et génération de brouillons bornée. Le corpus local fonctionne sans clé IA.

L'avancement et les limites vérifiées sont dans [docs/PROGRESS.md](docs/PROGRESS.md). La spécification complète reste dans [docs/ROADMAP.md](docs/ROADMAP.md).

## Démarrer depuis zéro

Prérequis : Node.js22.19 ou24, npm et PostgreSQL16 (`initdb`, `pg_ctl`, `psql`, `createdb`). Sur macOS avec Homebrew, les outils installés dans `/opt/homebrew/opt/postgresql@16/bin` sont détectés. Ailleurs, ajouter les binaires au PATH ou définir `PG_BIN`. Une alternative Docker est décrite ci-dessous.

```sh
npm ci
npm run setup:local
npm run db:migrate
npm run db:seed
npm run owner:create
npm run dev
```

Ouvrir **http://localhost:3000**. `setup:local` crée `.env` (permission0600) avec un secret de session et un mot de passe propriétaire aléatoires. Consulter **OWNER_EMAIL** et **OWNER_PASSWORD** dans ce fichier privé pour se connecter. Aucun compte ou mot de passe universel n'est fourni. Le script `owner:create` refuse de modifier un compte existant ; pour changer un mot de passe, utiliser une procédure administrative dédiée avant diffusion.

La base est dédiée au dépôt : `.local/pgdata`, écoute127.0.0.1:55432. Elle ne touche aucun service PostgreSQL existant. L'authentification PostgreSQL locale est `trust` sur cette instance de développement isolée ; la production exige un mot de passe et un réseau privé. Pour arrêter : `npm run db:stop`. Pour reprendre : `npm run db:start`.

Avec Docker à la place des binaires PostgreSQL : copier `.env.example` vers `.env`, renseigner les deux secrets manquants, puis `docker compose up -d db`, migrations, seed et propriétaire. Ne pas lancer simultanément la base native et Docker sur le même port.

Dans un second terminal, le worker facultatif :

```sh
npm run worker
```

Sans clé et budget, il n'effectue aucun appel fournisseur. Aucun job n'est créé en lisant le fil. L'installation locale n'utilise aucun abonnement. Les variables sont documentées dans `.env.example` et [docs/AI.md](docs/AI.md).

## Vérifier

```sh
npm run lint
npm run typecheck
npm test
npm run build
# Serveur local démarré, base migrée, corpus et propriétaire créés :
npm run test:e2e
# Contrôles HTTP supplémentaires sur le serveur en cours :
HTTP_TEST_URL=http://localhost:3000 npm test -- tests/backend-http.test.ts
# Mesures isolées, sans injecter de données synthétiques dans le fil :
npm run search:benchmark
```

Les tests d'intégration construisent des schémas temporaires et les suppriment ; utiliser une base de développement/test et un rôle autorisé à créer des schémas, jamais une base de production. Les tests HTTP créent leurs comptes synthétiques puis les retirent. Les tests navigateur nécessitent Chromium Playwright (`npx playwright install chromium` une fois si absent). Ils utilisent le compte OWNER_EMAIL local et archivent leurs brouillons de vérification. La limitation de connexion est volontaire : attendre60secondes après de nombreux essais consécutifs.

## Contenu et architecture

130 posts originaux, 14 thèmes, 7 formats et 130 questions. Les 100 derniers posts réalisent les 60 sujets du backlog initial et ajoutent 40 angles. Sources et vérifications dans [content/REVIEW.md](content/REVIEW.md). L'ajout au seed est idempotent et refuse la production. La revue documentaire et les exemples exécutés ne remplacent pas une relecture humaine indépendante.

Next.js App Router/React/TypeScript, Better Auth, PostgreSQL16 et SQL explicite (`pg`), Zod, worker Node séparé. Polices locales, aucune télémétrie tierce, aucun HTML/MDX exécutable en base. Favoris, expositions, préférences, réponses, états pédagogiques et versions sont distincts. Les solutions des questions ne sont envoyées qu'après réponse.

Les carrousels sont des blocs éditoriaux lisibles ; les images HTTPS avec texte alternatif sont acceptées par l'éditeur. Chaque post affiche un visuel SVG local : 10 logos et 14 stickers partagés, sans génération d’image payante. Mesures dans [docs/CONTENT-CONSUMPTION.md](docs/CONTENT-CONSUMPTION.md).

Pour reconstruire le lot à partir des textes et des références contrôlées : `npm run content:build`. Pour l’importer sur la base locale existante avec de nouvelles versions de couverture : `npm run content:import`. La seconde exécution ne crée aucun doublon et conserve la première mesure de consommation. Pour recontrôler les sources sur le réseau : `npm run content:sources`.

## Exploiter et poursuivre

[Guide production](docs/OPERATIONS.md), [IA et sauvegardes](docs/AI.md), [décisions](docs/DECISIONS.md), [backlog](docs/BACKLOG.md). Aucun hébergement ou TLS n'est présenté comme actif avant déploiement réel. Les lots7–9 dépendent d'un retour d'usage réel et de décisions explicites ; l'inscription publique et la production planifiée facturée restent désactivées.
