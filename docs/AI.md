# Génération IA, worker et sauvegardes

La génération produit uniquement des **brouillons privés à relire**. Le fil et le corpus local fonctionnent sans clé. Aucun appel IA réel n'est lancé par les tests. La production planifiée du lot 9 reste désactivée : aucune inscription publique, abonnement ni dépense récurrente n'est activée.

## Configuration explicite

Définir côté serveur, dans `.env` ou le gestionnaire de secrets de l'hôte :

```dotenv
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=
AI_API_KEY=
AI_MONTHLY_BUDGET_CENTS=
AI_INPUT_CENTS_PER_MILLION=
AI_OUTPUT_CENTS_PER_MILLION=
```

Le budget et les tarifs sont exprimés en **centimes de dollar américain**. Exemple de conversion uniquement : 1 dollar vaut 100 centimes. Aucun tarif fournisseur ou modèle n'est choisi implicitement. Vérifier prix et disponibilité du modèle avant configuration. Une clé, un modèle, un budget mensuel positif et les deux tarifs sont indispensables ; sinon l'interface affiche les raisons de désactivation. Le plafond mensuel suit les mois UTC.

L'adaptateur utilise `POST /chat/completions`, `response_format: json_object`, `max_completion_tokens`, `store: false`, sans outils et sans retry caché. Un fournisseur compatible doit prendre en charge ces champs. Le mode JSON ne garantit pas le schéma : le serveur applique toujours le contrat Zod partagé. Une API native Responses pourra être ajoutée derrière la même interface `GenerationAdapter` après vérification de son contrat. Références officielles consultées le 25 octobre 2026 : [création Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [sorties structurées, refus et limites du mode JSON](https://developers.openai.com/api/docs/guides/structured-outputs).

Les tarifs enregistrés permettent une **estimation locale**, pas une facture réelle. La réserve par brouillon utilise 45 000 octets UTF-8 d'entrée comme borne prudente des tokens BPE et 2 500 tokens de sortie. Les hôtes/modèles compatibles ayant une autre tokenisation ou un surcoût doivent être adaptés avant usage. Les tarifs peuvent évoluer chez le fournisseur ; configurer aussi ses propres limites de dépenses. Un usage absent ou une réponse illisible conserve toute la réserve. Une estimation dépassant la réserve est intégralement débitée du registre et bloque les lots suivants si le plafond est atteint.

## Sources et contrôles éditoriaux

Chaque lot exige de 1 à 5 URL HTTPS, une notion stable, un angle, un objectif, un thème, un niveau et un format. Maximum 5 brouillons par lot et **1 job actif global**, y compris si plusieurs processus worker sont lancés. Les angles déjà produits/en attente sont refusés ; les notions et objectifs apparentés remontent comme avertissements pour revue humaine.

La liste d'hôtes exacte par défaut est exportée par `modules/generation/config.ts` : MDN, Node.js, TypeScript, React, Next.js, PostgreSQL, Python, Docker, Git, GitHub, AWS, Microsoft Learn, HubSpot, OpenAI, RFC Editor, W3C et web.dev. `AI_SOURCE_HOSTS` peut la remplacer avec des noms exacts séparés par des virgules, sans wildcard. Élargir cette liste exige une décision éditoriale : ce n'est pas une recherche web générale.

Le récupérateur bloque schémas, ports, identifiants, IP littérales, résolutions privées/locales/metadata et adresses IPv6 de transition. Toutes les réponses DNS doivent être publiques ; l'IP validée est épinglée pour la connexion TLS. Chaque redirection repasse les mêmes contrôles (3 maximum). Corps texte non compressé, 512 Ko maximum, délai de 12 secondes, extrait limité à 5 500 caractères par source. Les scripts/HTML actifs ne sont jamais exécutés. Les pages sont des données non fiables dans le prompt, jamais des instructions ; le modèle ne reçoit aucun secret ni outil. Aucun code produit n'est exécuté et les images distantes générées sont refusées.

Le résultat conserve source/extrait effectivement récupérés, modèle, version du prompt, demande, usage disponible et erreurs. Le statut est forcé à `draft`, les métadonnées de source sont remplacées par celles du serveur, et le code reçoit `code_unverified`. Vérifier les affirmations et leurs références, contexte/version, prérequis, originalité, limites et code avant publication. Un HTTP 200 ou un JSON valide ne constitue jamais une vérification factuelle.

## Exécution et reprise

```sh
npm run db:migrate
npm run worker
```

Les jobs utilisent `FOR UPDATE SKIP LOCKED`, un bail de 90 secondes et un renouvellement toutes les 15 secondes. Création de brouillon, résultat unique du job et mise à jour du budget sont atomiques. Le worker ne publie jamais. Une reprise avant début d'appel peut remettre le job en file ; une reprise après début d'appel devient `uncertain`, garde la réserve et n'effectue pas de second appel. Une clé locale ou un identifiant de requête ne garantit aucune idempotence de facturation chez le fournisseur.

Si un lot attend jusqu'au mois suivant, sa réserve est déplacée atomiquement vers le mois de l'appel, sous le nouveau plafond. Un plafond abaissé est vérifié avant l'appel ; un modèle, fournisseur ou tarif modifié exige un nouveau lot. Les snapshots de paramètres restent consultables dans l'historique.

Les refus HTTP certains et erreurs de validation sont visibles sans boucle. Seul un HTTP 429 est automatiquement retenté, au plus 3 tentatives, avec backoff, jitter et `Retry-After` (jusqu'à 24 h). Timeout/réseau/5xx : coût inconnu, aucune relance automatique. Une relance administrative d'un échec certain réserve un nouveau budget ; les coûts et tentatives précédentes restent conservés. Un coût incertain exige rapprochement externe avant une nouvelle demande ; il n'existe pas de bouton qui efface cette réserve sans preuve.

Les logs contiennent identifiants du job/lot et codes d'état, sans clé, prompt ni contenu privé complet. Aucun canal d'alerte n'est configuré ou présenté comme actif. Le processus doit être supervisé par l'hôte ; un échec de base termine le worker avec code non nul pour permettre sa reprise.

La maintenance locale des expositions de plus de 90 jours s'exécute au démarrage du worker, puis toutes les 6 heures. Elle conserve les agrégats journaliers et journalise seulement des comptages. Son échec est visible dans les logs et ne termine pas le worker ; cette tâche ne déclenche aucun appel IA.

## Sauvegarde et exercice de restauration

Prérequis : outils `pg_dump` / `pg_restore` compatibles avec la version serveur. `PG_BIN` peut désigner leur répertoire. Les mots de passe passent par l'environnement du sous-processus, jamais ses arguments. Archives locales en format custom, permission 0600, sous `.local/backups/` exclu de Git. Une empreinte SHA-256 accompagne l'archive. Ces archives contiennent des données privées et **ne sont pas chiffrées par ce script local** ; en production, utiliser un stockage chiffré et une clé de chiffrement hors de l'archive avant toute copie externe.

```sh
npm run backup
# Créer à part une base de restauration vide, sans remplacer la base de service.
RESTORE_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/devscroll_restore npm run restore -- .local/backups/ARCHIVE.dump
```

Le script exige une destination différente de `DATABASE_URL`, vide, et vérifie l'empreinte avant import. Il n'efface aucune base ni table. Après restauration : comparer nombres de posts, versions, favoris et tentatives, démarrer un web/worker isolé avec cette URL, puis vérifier connexion, favori, révision et états de jobs. Ne pas lancer le worker restauré avec une clé fournisseur réelle avant d'avoir inspecté sa file : il s'agit d'une copie d'état, pas d'un nouvel environnement autorisé à dépenser.

La première sauvegarde/restauration locale doit être consignée dans `docs/PROGRESS.md` avec résultats réellement observés. Le déploiement et les sauvegardes automatiques chiffrées restent à configurer sur l'hôte choisi. Objectifs proposés après exercice réel : sauvegarde quotidienne, rétention 7 quotidiennes + 4 hebdomadaires, perte maximale 24 h, reprise sous 4 h ; ces objectifs ne sont pas des mesures déjà obtenues.

## Vérifications effectivement exécutées le 25 octobre 2026

- `npx vitest run tests/generation.test.ts tests/generation.integration.test.ts` : **42 tests réussis**, dont 9 tests PostgreSQL avec un schéma temporaire dédié, supprimé après exécution. Adaptateur IA simulé uniquement. Budget concurrent, changements de mois/plafond/tarifs, refus, sortie invalide, source hostile, coûts inconnus, baux et relances bornées sont couverts.
- `npx tsc --noEmit --pretty false` et `npx eslint modules/generation worker scripts/backup*.ts scripts/restore*.ts tests/generation*.ts` : réussis, sans avertissement sur ces fichiers.
- `npm run backup -- .local/backups/devscroll-exercise-20261025.dump` : archive custom créée. La première comparaison avec une base en cours d'utilisation a constaté un favori ajouté entre les deux lectures ; elle n'a pas été présentée comme identique.
- Second exercice avec `pg_export_snapshot()`, variable `BACKUP_SNAPSHOT` passée au script `scripts/backup.ts`, puis `scripts/restore.ts` avec `RESTORE_DATABASE_URL` distinct : **restauration réussie et comptages identiques au même snapshot**. Archive `.local/backups/devscroll-snapshot-exercise-20261025.dump`, 136 332 octets : 31 posts, 31 versions, 30 questions, 1 favori, 0 tentative, 0 lot IA. Les références des versions publiées sont cohérentes. Base d'exercice supprimée après vérification ; archives locales conservées hors Git.
- Worker lancé par `AI_API_KEY= AI_MONTHLY_BUDGET_CENTS= node --import tsx worker/index.ts`, arrêt `SIGTERM`, puis redémarrage : deux sorties **code 0**, `generationMode: disabled`, `recurringGeneration: false`, aucun run/job ajouté. Vérification répétée dans la copie propre après branchement de la maintenance : exécution de la maintenance au démarrage, 0 suppression attendue, deux arrêts propres.

### Installation dans une copie propre

Copie indépendante `/private/tmp/devscroll-clean-2ce66c854f02`, sans `.env`, `.local`, `.git`, `node_modules`, `.next`, résultats de tests ou dossiers de secrets. Les secrets de cette copie ont été générés aléatoirement dans son `.env` de permission 0600. PostgreSQL existant sur le port 55432, rôle local `devscroll`, **nouvelle base distincte** `devscroll_clean_1fb94fbded9b`.

Commandes exécutées dans cette copie avec le chemin Node 22.19.0 en tête de `PATH` :

```sh
npm ci --offline
npm run db:migrate
npm run db:seed
npm run db:seed
npm run owner:create
npm run typecheck
npm run build
```

Résultats : installation verrouillée réussie avec npm 10.9.3, 412 paquets, 0 vulnérabilité rapportée ; migrations 001 à 006 appliquées ; premier seed 30 ajouts, second 0 ajout ; 30 posts, 30 versions, 30 questions, 30 posts publiés, 1 propriétaire, aucun doublon de slug ou de version de question. Typecheck et build Next.js 16.4.3 réussis. La base temporaire et le `.env` de la copie ont ensuite été supprimés. La base principale n'a pas été modifiée par cet exercice.

Deux limites observées : un shell ouvert hors du dossier initial utilisait Node 16 par défaut, d'où la nécessité de sélectionner explicitement Node 22 ; le verrou testé avec ESLint 10.13.0 a produit des avertissements de peer dependencies pour trois plugins Next, sans bloquer `npm ci`. Ces constats ne sont pas des erreurs d'installation masquées. La validation ne couvre ni un fournisseur IA réel, ni un hébergement de production, ni TLS, sauvegardes automatiques chiffrées ou téléphone physique.
