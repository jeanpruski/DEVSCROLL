# Avancement DevScroll

Mis à jour le **25 octobre 2026**. Application locale fonctionnelle ; **la feuille de route n'est pas intégralement terminée** : une mise en ligne et des observations d'usage réelles restent nécessaires. Aucun déploiement, achat ou appel IA facturé n'a été effectué.

| Lot                                   | État                                           | Résultat et suite                                                                                                                                       |
| ------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Cadrage                           | Terminé                                        | Spécification intégrale, décisions, backlog et plan du socle.                                                                                           |
| 1 — Socle                             | Terminé et vérifié localement                  | Installation propre, PostgreSQL, propriétaire, connexion et contrôles d'accès.                                                                          |
| 2 — Fil et favoris                    | Terminé et vérifié localement                  | Sessions stables, pagination, reprise, expositions et favoris persistants.                                                                              |
| 3 — Recherche                         | Terminé et vérifié localement                  | FTS, alias, fautes prévues, filtres et favoris ; p95 local 205,7 ms sur 10 032 posts.                                                                   |
| 4 — Révisions                         | Terminé et vérifié localement                  | Calendrier, concurrence, corrections, confiance et reprise après rafraîchissement.                                                                      |
| 5 — Administration                    | Terminé et vérifié localement                  | Édition, aperçu, sources, versions consultables, publication/retrait, questions, import/export et qualité.                                              |
| 6 — IA et mise en service             | Implémenté en local ; mise en ligne en attente | Adaptateur, budgets, worker, PWA et restauration éprouvés ; fournisseur réel, hébergement/TLS et téléphone physique à valider.                          |
| 7 — Retour d'usage                    | Outillage livré ; bilan différé                | Export, diagnostic et rétention livrés ; essai réel de quatorze jours et corrections observées encore nécessaires.                                      |
| 8 — Sémantique et personnalisation    | Évaluation préparée ; extension conditionnelle | 25 requêtes éditoriales, recherche V1 optimisée. Pas de requêtes d'usage réelles ni de bénéfice démontré pour des embeddings : moteur lexical conservé. |
| 9 — Production régulière et ouverture | Non activé ; décisions futures                 | Production manuelle bornée disponible. Planification récurrente, inscription publique et nouveaux services payants non activés.                         |

## Extension de contenu — 100 posts illustrés ajoutés

Demande du 25 octobre 2026 : ajouter 100 posts, un logo ou un sticker par post et mesurer la consommation. **Livré : 130 posts publiés au total, 130 QCM et un visuel pour chaque post**, y compris les 30 premiers. Les nouveaux articles comportent chacun 107 à 128 mots hors résumé, trois blocs, une source distincte, contexte/limites et une question. Les 60 idées du backlog initial sont marquées réalisées ; 40 autres angles complètent le lot.

Visuels : **24 SVG uniques locaux, dont 10 logos et 14 stickers**, partagés entre les posts ; 33 couvertures logo et 97 sticker sur le corpus. Noms avec empreinte, dimensions réservées, chargement paresseux, cache public `immutable` vérifié par HTTP au navigateur. Les anciennes versions et les nouveaux posts sans couverture explicite disposent d’un visuel de repli. Le générateur de brouillons affecte une couverture locale connue plutôt qu’un chemin inventé par un modèle. Origines et licences dans `content/art-manifest.json` et `public/post-art/LICENSES.txt`.

Mesure réelle du premier import : **230 164 octets de JSON** pour les 100 posts (48 736 octets gzip, 40 409 Brotli), **45 131 octets de JSON** pour les 100 questions, **45 472 octets** pour les 24 SVG (22 367 octets gzip séparément), **3 153 920 octets** de croissance PostgreSQL observée, index et audit compris. La variation du contenu JSON stocké des versions est de 233 676 octets. L’import et ses mesures ont pris environ 1,19 seconde ; cela ne mesure pas la durée de rédaction.

**Consommation de génération de l’application : zéro appel, zéro token API et zéro USD facturé par un fournisseur appelé par l’application.** La rédaction a eu lieu dans cette conversation et les visuels sont vectoriels ; les tokens et le coût de la conversation ne sont pas accessibles et restent explicitement inconnus. Aucun total de facture ou coût de génération par modèle n’est inventé. Le poids des données n’est pas converti en faux comptage de tokens. Rapport : [CONTENT-CONSUMPTION.md](CONTENT-CONSUMPTION.md), preuve détaillée dans `content/batches/expansion-100.usage.json`.

Commandes et résultats réellement observés :

- `node scripts/build-post-art.mjs` : 24 SVG, 45 472 octets, aucun téléchargement de logo en échec.
- `node scripts/check-expansion-sources.mjs` : **100 références distinctes récupérées avec succès** lors de la dernière passe ; métadonnées et empreintes conservées. Des échecs transitoires GNU/Stanford ont été traités et documentés dans `content/REVIEW.md` ; un HTTP 200 seul n’est pas une validation factuelle.
- `npm run content:build` : 130 posts, 130 questions, 100 ajouts éditoriaux ; aucun doublon de slug/notion.
- `npm run backup -- .local/backups/devscroll-before-expansion100-20261025.dump` : sauvegarde avant import, 145 659 octets, hors Git.
- `npm run content:import` : **100 posts et 100 questions ajoutés, 30 nouvelles versions de visuel**, réponses/favoris existants conservés. Seconde exécution : **0 ajout, 0 nouvelle version, 0 question ajoutée**. La preuve du premier import n’est pas écrasée par cette passe vide.
- `npm test` : **82 tests réussis**, cinq tests HTTP ignorés sans serveur explicite. Nouveaux contrôles de contenu substantiel, unicité, SVG existants/sans contenu actif, chemins bornés et compatibilité des versions antérieures.
- `npm run lint`, `npm run typecheck`, `npm run build` : **succès**.
- `E2E_BASE_URL=http://localhost:3001 npm run test:e2e` : **5/5 réussis**, dont chargement réel du SVG, texte alternatif, cache immutable, parcours mobile 360 px sans débordement, carrousel/code, favoris et révisions. Capture mobile examinée.

Limites : aucun benchmark d’API IA payante sans clé/modèle/budget ; aucune relecture humaine indépendante. Ces ajouts ne changent pas les conditions de mise en ligne et d’usage des lots 6 à 9.

## Lot 0 — Cadrage

La feuille de route a été lue intégralement (28 sections), puis copiée sans modification dans `docs/ROADMAP.md`. Création de `docs/DECISIONS.md`, `docs/BACKLOG.md` et de ce journal. Le dossier initial contenait uniquement `DEVSCROLL_CODEX_ROADMAP.md`, sans code ni Git initialisé. Next a ensuite généré `AGENTS.md` ; ses consignes ont été lues avec les guides locaux correspondants.

Vérifications : Node **22.19.0**, npm **10.9.3**, PostgreSQL **16.13** disponibles. Compatibilités vérifiées sur le registre npm et les documentations officielles avant installation. Choix : Next 16.4.3, React 19.3.1, TypeScript 5.9.3, Better Auth 1.7.12, pg 8.23.1 et Zod 4.6.7, versions exactes dans le lockfile. SQL explicite remplace Prisma, décision documentée.

## Lot 1 — Socle

Livré : application TypeScript, navigation mobile/ordinateur, thèmes sombre/clair, états de chargement/erreur/vide, cartes de lecture, authentification Better Auth avec sessions PostgreSQL et inscription publique fermée. Variables privées validées ; aucun mot de passe universel ni clé IA requise.

Commandes réellement exécutées : `npm install`, `node scripts/local.mjs setup`, `npm run db:migrate`, `npm run owner:create`, `npm run dev`, puis connexion et déconnexion au navigateur et par HTTP. Base dédiée sur `127.0.0.1:55432`, données `.local/pgdata`, `.env` privé avec secrets aléatoires non affichés. Aucun service PostgreSQL existant modifié.

Une copie propre indépendante dans `/private/tmp/devscroll-clean-2ce66c854f02`, sans `.env`, données ou dépendances du projet, a passé `npm ci --offline` sous Node 22.19/npm 10.9.3 : **412 paquets, code 0**. Sur une base distincte temporaire : migrations 001–006, seed, second seed, création propriétaire, typecheck et build réussis ; **30 posts, 30 versions, 30 questions, 1 propriétaire, aucun doublon**. Cette base et ses secrets temporaires ont été supprimés. Les migrations 007/008 ajoutées ensuite ont été appliquées et testées séparément.

Limite : npm émet des avertissements de peer dependencies pour ESLint 10 face à trois plugins de Next déclarant encore ESLint 9. L'installation propre et le lint fonctionnent ; aucun contournement `legacy-peer-deps` employé. Docker est absent de cet environnement ; le Dockerfile et Compose sont préparés mais n'ont pas été exécutés.

## Lot 2 — Fil, corpus et favoris

Livré : **30 posts originaux, 14 thèmes, 7 formats, 5 carrousels**, textes/code/comparaisons et **30 QCM**. **60 sujets supplémentaires** identifiés dans `content/backlog.json`. Sources et vérifications dans `content/REVIEW.md` ; exemples JavaScript/TypeScript exécutés et SQL vérifié en lecture seule. Pas d'image raster générée pour le corpus. Les blocs image HTTPS avec texte alternatif sont pris en charge par l'éditeur.

`npm run db:seed` exécuté deux fois : **30 puis 0 nouveaux posts**, 30 questions validées. Les données pédagogiques sont indépendantes des interactions. Les contenus publiés et questions sont versionnés.

Fil : snapshot ordonné par session, curseurs signés et liés au compte, pages de six posts, diversité, exclusion des notions récemment exposées, fin de stock et relecture volontaire. Reprise des pages chargées et de la position via identifiants/positions en sessionStorage, sans y stocker les corps des posts. Une session expirée est renouvelée explicitement. Exposition qualifiée à 60 % pendant cinq secondes cumulées, onglet actif ; dédoublonnage serveur. Likes optimistes avec rollback et requêtes persistantes ; double envoi sans doublon. Les questions du fil sont mises en attente avec un état distinct pour éviter de réutiliser une correction sur une autre question.

Vérifié : trois pages stables sans doublon, curseur et exposition interutilisateurs refusés, likes concurrents idempotents, favori encore présent après rafraîchissement, recherche puis détail et sources au navigateur. Un premier test rafraîchissait avant l'accusé serveur : le test attend maintenant la fin de l'enregistrement ; les mutations de favori utilisent aussi `keepalive`.

## Lot 3 — Recherche et exploration

Recherche PostgreSQL pondérée français/simple, alias, normalisation des identifiants, `pg_trgm` optionnel et chemin sans extension. Titre, tags, notion, contexte et code sont indexés. Droits/favoris, filtres et total appliqués avant pagination ; curseur lié au compte et à la recherche. Annulation des requêtes et de leur pagination lors d'un changement de recherche. Un post retiré reste indisponible dans les favoris, sans fuite de son texte.

Vérifié : AbortController, « annuler requête », AbortControler, accents, C++, C#, `.env`, Promise.all, CI/CD et Node.js. Les requêtes techniques absentes du corpus sont testées sur des fixtures isolées. Erreur UI initiale (`difficulty=`/`format=` vides) corrigée en omettant les filtres absents, puis parcours navigateur réussi.

Commandes : `npm run db:migrate`, `npx tsx scripts/reindex-search.ts`, `npm run search:benchmark`, `npm test -- tests/search.integration.test.ts`. Migrations 007/008 et réindexation de 32 versions présentes à cet instant réellement exécutées, sans modifier leur contenu.

**Mesure locale réelle** : p95 passé de **1 607,1 à 205,7 ms**, p50 **135,4 ms**, maximum **209,0 ms**, sur 30 appels et **10 032 posts / 1 005 favoris** dans un schéma isolé. **21/21 attendus du corpus au premier rang**, deux fixtures C++/C# et deux exclusions Favoris réussies ; autre compte : zéro favori. Schéma de benchmark supprimé et absence vérifiée. Environnement, plans SQL et limites dans `docs/SEARCH.md` ; rapport `.local/search-benchmark.json`. Ces requêtes sont éditoriales et cette latence n'est pas une mesure HTTP distante ou terrain.

## Lot 4 — Révisions

Ordonnanceur transparent version 1 : délais 1/3/7/14/30/60/120 jours, UTC et horloge injectable. Tests immédiats distincts des révisions dues ; like avec opt-in active le suivi à J+1. Solutions et explications absentes avant réponse. Correction puis confiance ; un bon résultat deviné garde son stade. Passage sans pénalité et pause d'une heure. Plafond du fil trois questions et une pour cinq expositions qualifiées conservé côté serveur.

Tests déterministes et PostgreSQL : vrai/faux/deviné/passé, hors échéance, changement d'heure, double clic, deux onglets, créneau unique, ordre stable des choix et retrait d'une question. Verrouillage question/état/opportunité et idempotence. La précision PostgreSQL du créneau est conservée, y compris ses microsecondes. Une correction suspend la notion et demande une reprise explicite à J+1. Après rafraîchissement d'une correction déjà révélée, `pendingConfidence` permet de terminer sans perdre le calendrier.

Vérification navigateur sur un lecteur synthétique temporaire : révision due → réponse → correction → rafraîchissement → correction reprise → confiance → stade 1/J+3 ; nouvelle échéance simulée → passage sans changement de stade/date ; accès admin du lecteur redirigé. Compte synthétique supprimé après le test.

## Lot 5 — Administration

Éditeur de blocs contrôlés, sources reliées aux affirmations, contexte/version, vérifications, aperçu mobile, création et sauvegarde de versions immuables. Publication atomique, dépublication, archive, duplication, import/export JSON idempotent. Questions existantes affichées, correction versionnée et retrait effectif depuis l'interface. Signalements, résolution et contenus à revalider. Consultation du contenu d'une ancienne version en lecture seule, avec dates et indication de publication ; historique actualisé après sauvegarde.

Vérifié : publication puis archivage au navigateur ; ancienne version immuable et version courante distincte, publication et recherche cohérentes, brouillons non visibles, retrait sans fuite, réimport sans doublon, historique et question retirée testés côté PostgreSQL. Tous les accès éditoriaux sont vérifiés sur le serveur, même quand l'interface n'affiche pas les liens.

## Lot 6 — IA, PWA et exploitation

Adaptateur HTTP configurable, uniquement des brouillons à relire ; mode sans clé explicite. Sources HTTPS sur liste autorisée, DNS et IP publiques vérifiés et épinglés, redirections recontrôlées, taille/délai bornés. JSON validé, sortie insuffisante/refus/invalide explicite. Aucun code généré exécuté.

File PostgreSQL : concurrence globale de un, baux/reprise, réservation atomique du budget, coût connu/estimé/incertain, retries 429 bornés et relance administrative prudente. Maximum cinq brouillons par lot, estimation/réserve montrée avant lancement. Aucun appel sans clé, modèle, tarifs et plafond explicites. **42 tests génération**, dont **9 PostgreSQL**, sans appel facturé. Worker démarré, arrêté proprement par SIGTERM puis redémarré deux fois ; zéro run/job créé sans action et maintenance 90 jours fonctionnelle.

PWA : manifeste, icônes SVG/192/512, navigation réseau avec écran hors connexion, aucun cache de contenus authentifiés ou solutions. Déconnexion purge le stockage privé local. Interface contrôlée en émulation 360 px avec clavier, code et carrousel sans débordement global. Contrastes des textes principaux et secondaires calculés dans les deux thèmes ; teintes discrètes ajustées pour atteindre 4,5:1 sur les surfaces prévues. Pas d'affirmation de test sur téléphone physique ou de LCP terrain.

Sauvegarde et restauration **réellement exécutées** : archive `.local/backups/devscroll-snapshot-exercise-20261025.dump`, 136 332 octets, permission 0600 et SHA-256, restaurée dans une base distincte temporaire. Comparaison via même snapshot PostgreSQL : **31 posts, 31 versions, 30 questions, 1 favori, 0 tentative, 0 run IA**, identiques ; références publiées cohérentes. Le post supplémentaire est une fixture de navigateur archivée, hors corpus. Base de restauration supprimée après contrôle. Une première capture non synchronisée avait 0 favori avant une mutation concurrente ; l'exercice final utilise un snapshot exporté. Archives locales privées **non chiffrées** ; sauvegardes automatiques chiffrées à configurer sur l'hôte.

Préférence d'hébergement confirmée : **plateforme Node.js avec PostgreSQL**. `render.example.yaml`, Dockerfile/Compose, Caddy et guides `docs/DEPLOY-NODE.md` / `docs/OPERATIONS.md` préparés. Render est proposé mais **pas installé/connecté** ; pas d'accès au compte/projet ni de dépôt distant. Aucun service créé ou acheté. Mise en ligne privée, TLS, sauvegardes hébergées, appel fournisseur réel et essai sur le téléphone restent à faire.

## Lot 7 — Qualité et retour d'usage

Livré : export personnel JSON sans secrets, suppression du compte et interactions, diagnostic réservé au propriétaire, rétention transactionnelle des expositions brutes après 90 jours avec agrégats quotidiens conservés. Maintenance au démarrage du worker puis toutes les six heures, et commande `npm run maintenance`. Tests : purge, compteurs conservés, seconde passe sans doublon et nettoyage des sessions.

`docs/USAGE.md` prépare le protocole de quatorze jours, trois frictions et trois notions retrouvées/retenues/utilisées. Les tableaux restent vides : **aucun retour d'usage de Jean n'a été inventé**. Les réglages fondés sur cet usage attendent ce bilan ; pas d'enrichissement prétendument fondé sur des thèmes consultés qui ne l'ont pas encore été.

## Lot 8 — Évaluation et personnalisation

Livré maintenant : jeu de **25 requêtes éditoriales** avec attendus, benchmark isolé, mesures avant/après et préférences de thèmes/niveau. La recherche lexicale optimisée reste utilisée. Il manque vingt à trente requêtes spontanées réelles et le besoin observé prévu après le lot 7. Les embeddings, la recherche hybride et les collections avancées ne sont pas activés sans ce signal et sans comparaison démontrée. Aucun appel d'embedding payant ou base vectorielle ajouté.

## Lot 9 — Régularité et ouverture

La production manuelle privée de brouillons, les quotas, l'audit et la relecture sont disponibles. La génération planifiée récurrente reste désactivée et non présentée comme implémentée. L'inscription publique, les espaces publics, les paiements et les nouveaux achats ne sont pas ouverts. Après les lots précédents et décision explicite : cadrer une planification avec plafond et revue de sources, puis évaluer coût/support/confidentialité avant toute ouverture.

## Vérifications consolidées

- `npm run check` : **succès final** (lint, TypeScript, tests et build).
- `npm test` : **79 tests réussis**, cinq tests HTTP volontairement ignorés sans variable de serveur. Corpus, calendrier, flux, recherche, transactions, maintenance, génération et sécurité métier couverts.
- `HTTP_TEST_URL=http://localhost:3001 npm test -- tests/backend-http.test.ts` : **5/5 réussis** sur le serveur standalone de production local : anonyme, inscription publique fermée, rôle lecteur, origine étrangère, curseurs/expositions interutilisateurs et déconnexion.
- `E2E_BASE_URL=http://localhost:3001 npm run test:e2e` : **5/5 réussis** sur le build de production : lecture/favori/recherche/détail/déconnexion, publication/archivage, mobile 360 px/code/carrousel, IA désactivée explicite, révision/correction/reprise/confiance/passage.
- `npm run lint`, `npm run typecheck`, `npm run build` : **succès**, lint sans avertissement. Le build final avec accès à la base ne signale plus d'erreur de schéma d'authentification.
- `PORT=3001 BETTER_AUTH_URL=http://localhost:3001 npm start` : serveur standalone réellement démarré avec ses ressources statiques. Un premier essai `next start` signalait l'incompatibilité du mode standalone ; remplacé par `scripts/start.mjs` puis vérifié.
- Sauvegarde/restauration, double seed, installation propre, redémarrage worker et benchmark effectivement exécutés comme détaillé ci-dessus. Aucun test automatisé n'appelle un fournisseur IA réel.

La CI GitHub est fournie mais n'a pas encore été exécutée sur une forge distante. La limitation de débit de connexion/recherche est en mémoire par processus : adaptée à l'instance personnelle unique ; à externaliser avant plusieurs instances web. La revue documentaire du corpus et les exemples vérifiés ne remplacent pas une relecture humaine indépendante. Les données synthétiques du benchmark n'ont jamais été publiées dans le corpus utilisateur.

## Prochaine étape nécessaire

Installer/connecter Render (ou fournir l'accès à une autre plateforme Node/PostgreSQL existante), sélectionner le projet/dépôt et confirmer le coût des ressources avant création. Déployer en privé, vérifier TLS et sauvegardes, essayer sur le téléphone, puis commencer le protocole de quatorze jours. Les lots conditionnels ne doivent pas être cochés comme terminés avant ces preuves.
