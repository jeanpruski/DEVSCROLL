# Recherche V1 : contrat, évaluation et mesures

Évaluation du 25 octobre 2026. Le moteur reste lexical. **Les 25 requêtes du jeu sont éditoriales, préparées à partir du corpus ; aucune ne provient encore de l’usage réel de Jean.** Elles permettent de vérifier une implémentation, pas de démontrer que la recherche sémantique serait utile.

## Contenu indexé et classement

`searchableText` indexe titre, tags, alias, notion et métadonnées techniques avec le poids A. Objectif, phrase à retenir, paragraphes, listes, comparaisons, texte alternatif et code sont indexés avec le poids B. Les métadonnées comprennent le thème, la technologie et la version de contexte : une fiche Node.js reste retrouvable même si son titre cite seulement EventEmitter.

Deux vecteurs PostgreSQL sont conservés : français pour la prose et `simple` pour les identifiants. Un texte complémentaire normalisé préserve les formes techniques que la ponctuation sépare : `C++ → cpp`, `C# → csharp`, `.env → dotenv`, `Promise.all → promiseall`, `CI/CD → cicd`, `Node.js → nodejs`. Les accents sont retirés dans ce texte complémentaire.

Les candidats proviennent de branches distinctes : plein texte français, plein texte simple, sous-chaîne normalisée et, si `pg_trgm` est disponible, ressemblance de mots sur des descripteurs courts. Ces descripteurs générés en base contiennent titre, tags, alias, notion et contexte. Le corps complet reste disponible pour le plein texte et les correspondances normalisées ; la tolérance aux fautes de frappe porte sur les descripteurs éditoriaux. Elle ne promet pas de corriger toute formulation erronée d’un paragraphe.

Score courant : rang français × 2 + rang simple + bonus 2 pour une sous-chaîne normalisée. Un candidat uniquement approché par trigrammes peut donc avoir un score nul ; ce mécanisme est un rappel lexical, pas une mesure de proximité sémantique. Les égalités utilisent la date de publication, ou de sauvegarde dans Favoris, puis l’identifiant.

Les droits, la publication et les filtres sont appliqués avant total et pagination. Les favoris restent propres au compte connecté. Un post retiré reste représenté comme indisponible dans la liste de favoris vide, sans exposer son contenu ; il ne ressort pas dans une recherche textuelle. Le curseur signé est lié au compte, à la requête et aux filtres. Le total et la page proviennent d’une même instruction SQL, y compris si des retraits ont rendu une page vide.

## Jeu éditorial

Le fichier [search-evaluation.json](../content/search-evaluation.json) contient exactement 25 cas avec identifiants stables, requête, périmètre et slugs attendus :

- 21 cas positifs sur les 30 posts rédigés : identifiants, alias, accents, fautes de frappe et favoris.
- 2 cas d’identifiants absents du corpus pédagogique, `C++` et `C#`, évalués sur deux documents artificiels distincts.
- 2 exclusions vérifiant qu’une fiche non sauvegardée ne ressort pas dans Favoris.

Les documents artificiels sont intégrés uniquement au schéma du benchmark. Ils ne figurent pas dans `content/posts.json` et ne sont jamais importés par le seed utilisateur. Les attendus indiquent les résultats nécessaires, pas une annotation exhaustive de tous les résultats pertinents : ce jeu ne permet donc pas de calculer une précision fiable.

Le rappel@12 mesure la part des slugs attendus présents sur la première page. Le MRR@12 moyenne l’inverse du rang du premier attendu retrouvé ; un attendu absent vaut zéro. Chaque cas positif actuel attend un seul slug. Les cas vides et les deux documents artificiels sont comptabilisés séparément pour ne pas gonfler le résultat du corpus rédigé.

## Banc de mesure isolé

Commande :

```sh
npm run search:benchmark
```

Le script accepte uniquement une base PostgreSQL en loopback et refuse `NODE_ENV=production`. `BENCHMARK_DATABASE_URL` peut désigner une autre base locale ; à défaut il utilise `DATABASE_URL`. Il crée un schéma aléatoire `devscroll_bench_…`, applique ses tables et index, impose ce schéma au `search_path` de toutes les connexions de son pool puis injecte ce pool **avant** d’importer les services applicatifs. Il vérifie que la table `posts` résolue appartient au schéma créé. Aucune extension globale n’est installée par le benchmark.

La pertinence est évaluée avant l’ajout de volume. Puis 10 000 posts et 1 000 favoris artificiels sont construits en lots, séparément des 30 posts initiaux, des 2 fixtures d’identifiants et des 5 favoris éditoriaux. Le banc interroge le véritable service `searchPosts`, avec conversion des contenus et pagination, sans HTTP, authentification ni navigateur. Il vérifie aussi qu’un second utilisateur fictif n’obtient aucun favori du premier.

Après `ANALYZE`, cinq appels chauffent le scénario, puis trente appels séquentiels alternent `AbortController`, `Promise.all`, `.env`, `AbortControler` et `annuler requête` dans Favoris. Le p95 utilise le rang supérieur : observation 29 sur 30 après tri. Trois requêtes sont également rejouées avec `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` sur le SQL effectivement envoyé par le service.

Le rapport détaillé est écrit dans `.local/search-benchmark.json`, ignoré par Git : échantillons, classements, environnement et plans. Le schéma est supprimé dans `finally`, puis son absence est vérifiée. La dernière exécution a confirmé `cleanup: verified-removed`. Aucun post synthétique n’a été écrit dans `public`.

## Résultats observés

Environnement : Node.js **22.19.0**, PostgreSQL **16.13 Homebrew**, macOS arm64, **Apple M1 Pro**, `pg_trgm` disponible, pool de trois connexions au maximum et concurrence de mesure de un. Volume final : **10 032 posts**, dont 10 000 artificiels, et **1 005 favoris** du compte fictif.

| Mesure | Première version | Version optimisée |
|---|---:|---:|
| Rappel@12 sur les 21 cas positifs du corpus | 20/21, soit 95,24 % | 21/21, soit 100 % |
| MRR@12 sur ces mêmes cas | 0,9524 | 1,0000 |
| Identifiants C++ et C# artificiels | 2/2 | 2/2 |
| Exclusions Favoris | 2/2 | 2/2 |
| Résultats des favoris pour l’autre compte | 0 | 0 |
| p50 du service, 30 appels | 1 271,0 ms | 135,4 ms |
| p95 du service, 30 appels | 1 607,1 ms | **205,7 ms** |
| Maximum observé | 1 656,0 ms | 209,0 ms |
| Cible locale p95 < 500 ms | Non atteinte | Atteinte sur ce scénario |

Le cas initial manquant était `Node.js → node-eventemitter-synchrone`, car les métadonnées n’étaient pas indexées. Elles ont été ajoutées à `searchableText`. Le script de maintenance suivant a réellement réindexé les **32 versions présentes** dans la base locale au moment de l’exercice, sans modifier leur contenu :

```sh
npx tsx scripts/reindex-search.ts
```

Les migrations `007_search_performance.sql` et `008_search_hints.sql` ont été appliquées réellement avec `npm run db:migrate`. La première ajoute les index de jointure vers la publication et de filtres éditoriaux ; la seconde ajoute les descripteurs courts générés et leur index trigramme lorsque l’extension existe. Les migrations déjà appliquées n’ont pas été réécrites.

La requête initiale effectuait deux calculs, pour compter puis paginer. Sur `AbortController`, ses plans prenaient environ 627 ms puis 640 ms. Une première refonte en branches séparées et requête unique réduisait le p95 à 939 ms, mais la comparaison approchée du texte complet coûtait encore environ 717 à 787 ms par requête. La comparaison sur les descripteurs courts a supprimé ce coût dominant.

Plans finaux observés :

| Requête | Temps SQL `EXPLAIN ANALYZE` | Observation |
|---|---:|---|
| `AbortController`, global | 133,3 ms | Branches séparées ; le plan choisit encore des parcours séquentiels sur ce jeu fréquent. |
| `AbortControler`, global | 124,8 ms | Index trigramme du texte normalisé pour une branche et clé primaire des versions ; parcours court pour les descripteurs approchés. |
| `annuler requête`, favoris | 134,7 ms | Filtrage des favoris avant total/page ; l’index trigramme du texte normalisé sert une branche. |

La présence d’un index ne signifie pas qu’il sera choisi pour chaque recherche. Aucun paramètre global du planificateur n’a été forcé pour obtenir ces résultats. Les plans JSON complets restent dans le rapport local.

## Vérifications et limites

Commandes réellement exécutées :

```sh
npm run db:migrate
npx tsx scripts/reindex-search.ts
npm run search:benchmark
npm test -- tests/search.integration.test.ts
npm run typecheck
npx eslint scripts/benchmark.ts modules/search/service.ts tests/search.integration.test.ts
```

Les **six tests PostgreSQL de recherche** ont réussi : identifiants dans les métadonnées, alias et accents dans les favoris, isolation des comptes et des curseurs, pagination sans doublons, page devenue vide après retraits avec total exact, contenu retiré indisponible et correspondances exactes sans branche trigramme. Pour ce dernier cas, le test simule seulement l’absence de l’extension lors de sa détection ; il ne désinstalle pas l’extension de la base. Typecheck et ESLint ciblé ont réussi.

Ces mesures sont artificielles, locales et séquentielles. La distribution répétitive des documents ne représente pas une bibliothèque réelle de 10 000 articles. Le cache est chaud, trente appels constituent un petit échantillon et l’activité de développement de la machine n’est pas contrôlée. Ni latence réseau d’un téléphone, ni TLS, ni coût HTTP/authentification, ni charge concurrente ne sont mesurés. Les chiffres avant/après utilisent le même scénario et les mêmes volumes, avec enrichissement des métadonnées dans la version optimisée. Ils ne prédisent pas une performance de production.

Le lot 8 reste une préparation : aucune observation réelle du lot 7 ne justifie encore des embeddings. Le protocole [USAGE.md](USAGE.md) prépare quatorze jours d’essai et la collecte de requêtes réelles. Une recherche hybride ne devra être ajoutée qu’après comparaison sur ces usages, sans régression des identifiants exacts, des favoris ni des autorisations.
