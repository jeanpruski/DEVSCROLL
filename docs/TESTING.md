# Vérifier DevScroll

Les tests ne font aucun appel à un fournisseur IA réel. Les données de contenu et les interactions sont persistées dans PostgreSQL ; les fixtures de test ne deviennent pas le corpus de démonstration.

## Vérifications courantes

```sh
npm ci
npm run setup:local
npm run db:migrate
npm run db:seed
npm run owner:create
npm run lint
npm run typecheck
npm test
npm run build
```

Le script propriétaire demande les variables `OWNER_EMAIL`, `OWNER_PASSWORD` (au moins douze caractères) et, facultativement, `OWNER_NAME`. Il conserve un compte existant sans réinitialiser son mot de passe. L'inscription HTTP publique reste désactivée.

Les tests purs de classement, normalisation et calendrier fonctionnent sans base :

```sh
npx vitest run tests/backend.test.ts tests/reviews.test.ts
```

## Intégration PostgreSQL

```sh
npm run test:integration
```

Les tests de `tests/integration.test.ts` utilisent l'URL de `.env`, refusent un hôte distant dont le nom de base ne contient pas `test` et créent des identifiants uniques. Ils suppriment leurs utilisateurs, posts, versions, questions et interactions à la fin. Ils ne réinitialisent pas les tables du corpus. Une base locale dédiée ou une base de test reste le choix approprié ; ne pas pointer ces tests vers une base de production. Sans `DATABASE_URL`, ce fichier est explicitement ignoré.

La suite couvre les pages de fil stables, les curseurs liés au compte, les favoris concurrents idempotents, les périmètres de recherche, les identifiants techniques (`C++`, `C#`, `.env`, `Promise.all`, `CI/CD`, `Node.js`), les alias et les fautes de frappe lorsque `pg_trgm` est installé. Sans cette extension optionnelle, le plein texte et les alias restent utilisables.

Après une modification des champs indexés, `npx tsx scripts/reindex-search.ts` recalcule les index des versions existantes avec la même fonction que la publication, sans modifier leur contenu pédagogique ni leur historique.

Les révisions vérifient le test immédiat sans promotion, l'absence de solution avant réponse, les tentatives simultanées, la confiance après correction, l'effet unique de la promotion, le passage sans pénalité et son silence d'une heure. Le quota de trois questions par session est contrôlé après cinq, dix et quinze expositions qualifiées, y compris après rafraîchissement. Une notion exposée dans cette session est exclue des questions intercalées.

Si l'utilisateur ferme la page après une réponse correcte et avant sa confiance, la correction déjà révélée reste disponible au même compte dans `pendingConfidence`. Un rafraîchissement ne bloque donc pas le créneau et n'accorde aucune promotion automatique. Les dates de créneau conservent la précision PostgreSQL lors des opérations SQL ; elles ne transitent pas par la précision limitée des dates JavaScript pour déterminer l'unicité.

Une correction éditoriale conserve l'ancienne version. Une correction de question suspend les états concernés jusqu'à la réévaluation volontaire ; le test vérifie le refus des réponses et confiances sur la version retirée, puis le retour au stade zéro avec une échéance à J+1.

L'historique éditorial est consultable par le propriétaire avec `GET /api/admin/posts/:id?version=1`. Le test compare le contenu ancien à la dernière révision, vérifie les dates et numéros, le statut de publication actuel et le marqueur de lecture seule. L'absence du paramètre conserve l'ouverture sur la dernière version ; une version inexistante renvoie 404.

La rétention est testée avec des expositions synthétiques datées de plus de quatre-vingt-dix jours : les événements détaillés disparaissent, leurs totaux quotidiens persistent, une seconde exécution ne les compte pas à nouveau et les sessions anciennes sans événement sont supprimées. Le worker exécute cette maintenance périodiquement ; `npx tsx scripts/maintenance.ts` permet aussi une exécution volontaire.

## Authentification et autorisations HTTP

Avec `npm run dev` lancé dans un autre terminal :

```sh
HTTP_TEST_URL=http://localhost:3000 npx vitest run tests/backend-http.test.ts
```

Cette suite nécessite les identifiants du propriétaire dans `.env`. Elle crée et supprime un compte lecteur synthétique, utilise les vraies sessions Better Auth et vérifie les refus anonymes, l'inscription fermée, les rôles, l'origine des mutations, l'isolation des curseurs et expositions, puis l'invalidation de session à la déconnexion. Elle ne journalise ni mots de passe ni cookies. Sans `HTTP_TEST_URL`, ces tests sont explicitement ignorés : le serveur web n'est pas un prérequis implicite des tests courants.

## Limites de ce que les tests démontrent

Une exposition de cinq secondes n'atteste aucune maîtrise. Les statistiques affichent des observations, pas une mesure de compétence. Les tests d'ordonnanceur couvrent des durées UTC et le changement d'heure ; ils ne valident pas scientifiquement les intervalles choisis.

La suite locale ne démontre ni une mise en ligne, ni une expérience sur le téléphone de Jean, ni quatorze jours d'usage. Les vérifications IA avec un adaptateur factice démontrent la file, les budgets et les erreurs, pas la disponibilité d'un fournisseur réel. Une restauration réussie doit être constatée sur une base distincte.
