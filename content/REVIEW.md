# Revue du corpus initial

Date éditoriale : 25 octobre 2026. Corpus de démonstration français, rédigé pour DevScroll et importable sans fournisseur IA.

Le corpus contient 30 posts, 30 QCM à réponse unique et 60 autres sujets au statut `idea`. Les 30 notions disposent donc chacune d’une question. Les posts couvrent 14 thèmes et les 7 formats du contrat, dont 5 carrousels de 4 blocs et 7 extraits de code. Les blocs de carrousel forment une séquence de lecture. Aucun visuel raster, aucune photographie et aucun appel payant n’ont été nécessaires ; la représentation visuelle repose sur le code, les comparaisons et les cartes.

## Vérifications réellement effectuées

Les schémas de `lib/contracts.ts` valident les fichiers JSON. La suite `tests/content.test.ts` contrôle aussi les identifiants uniques, la couverture thématique, les références des questions, les sources déclarées et l’absence de chevauchement entre les notions initiales et celles du backlog.

Les cinq extraits JavaScript présents dans les posts ont été exécutés tels quels sous Node.js **v22.19.0**, dans des processus courts distincts. Les sorties ont été vérifiées, sans accès réseau :

| Extrait                                  | Résultat observé             |
| ---------------------------------------- | ---------------------------- |
| Promise.all et travail restant           | `rejet → terminé`            |
| Script, microtâches et timer             | `A`, `B`, `P`, `Q`, `T`      |
| Compteurs et closures                    | `1 2 1`                      |
| EventEmitter                             | `avant`, `listener`, `après` |
| Full jitter avec générateur déterministe | `250`, `1000`, `15000`       |

L’extrait `satisfies` a été contrôlé avec **TypeScript 5.9.3**, `tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext`, puis transpilé et exécuté sous Node. Résultat : `LOCALHOST 3000`. Il s’agit bien d’un contrôle de types, pas seulement d’une transpilation.

L’extrait SQL a été exécuté en lecture seule sur la base PostgreSQL 16 locale dédiée à DevScroll :

```sh
/opt/homebrew/opt/postgresql@16/bin/psql \
  -h127.0.0.1 -p55432 -Udevscroll -ddevscroll \
  -At -P null=NULL \
  -c 'SELECT NULL = NULL AS egalite_inconnue, NULL IS NULL AS absence, NULL IS NOT DISTINCT FROM NULL AS egalite_totale, 1 IS DISTINCT FROM NULL AS difference;'
```

Résultat observé : `NULL|t|t|t`. La documentation citée est celle de PostgreSQL 18 ; les prédicats de cette fiche ont été vérifiés sur l’instance locale 16. Aucun schéma ni aucune donnée n’ont été modifiés par cette vérification.

Commande reproductible pour les validations de corpus et les exemples JavaScript/TypeScript :

```sh
npm test -- tests/content.test.ts
```

Résultat initial observé : **1 fichier réussi, 9 tests réussis**. Le contrôle SQL ci-dessus est distinct et manuel ; ce test Vitest ne prétend pas démarrer PostgreSQL.

## Revue documentaire

Chaque source dans `posts.json` contient son URL HTTPS, son titre, son éditeur, la date de consultation `2026-10-25` et les affirmations qu’elle soutient. Les dates de publication sont ajoutées seulement quand elles sont connues. Les questions héritent du dossier documentaire de leur notion ; elles ne constituent pas des faits détachés du post.

Les sections pertinentes des documents ont été consultées, au-delà de la seule disponibilité de leurs URL :

- [ECMA-262, Promise.all](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.all), [environnements des fonctions](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinaryfunctioncreate), [DOM, annulation](https://dom.spec.whatwg.org/#aborting-ongoing-activities) et [HTML, boucle événementielle](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops).
- Documentation officielle de [TypeScript](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator), [React](https://react.dev/learn/state-as-a-snapshot), [Node.js](https://nodejs.org/api/events.html#asynchronous-vs-synchronous) et [PostgreSQL](https://www.postgresql.org/docs/18/functions-comparison.html).
- RFC de l’IETF pour [HTTP](https://www.rfc-editor.org/rfc/rfc9110.html), [PATCH](https://www.rfc-editor.org/rfc/rfc5789.html), [429](https://www.rfc-editor.org/rfc/rfc6585.html), [cookies](https://www.rfc-editor.org/rfc/rfc6265.html) et [DNS](https://www.rfc-editor.org/rfc/rfc1035.html).
- Documentation du fournisseur pour les [webhooks Stripe](https://docs.stripe.com/webhooks), la [signature](https://docs.stripe.com/events/manage-webhook-endpoints) et la [pagination](https://docs.stripe.com/api/pagination). Le corpus ne prétend pas appliquer tous leurs détails à HubSpot ou à une autre API.
- Sources officielles de [Next.js](https://nextjs.org/docs/app/guides/environment-variables), [Kubernetes](https://kubernetes.io/docs/concepts/workloads/pods/probes/), [Prisma](https://www.prisma.io/docs/guides/database/data-migration), [npm](https://docs.npmjs.com/cli/v11/commands/npm-ci/), [Git](https://git-scm.com/docs/git-revert) et [AWS pour le jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/).
- Le manuel GNU public renvoyait des erreurs de récupération ; son [fichier source officiel Coreutils](https://raw.githubusercontent.com/coreutils/coreutils/master/doc/coreutils.texi) a été consulté pour `df` et `du`. Les permissions de parcours s’appuient sur [Linux man-pages](https://man7.org/linux/man-pages/man7/path_resolution.7.html).
- [Documentation Anthropic sur le contexte](https://platform.claude.com/docs/en/build-with-claude/context-windows), [papier original RAG](https://arxiv.org/abs/2005.11401) et [récit historique coécrit par le créateur de JavaScript](https://wirfs-brock.com/allen/jshopl.pdf), notamment pages 3 et 8. Aucun chiffre de taille de contexte, tarif ou modèle du moment n’est figé dans les posts.

Les comparaisons et exemples sont des reformulations originales. Les conseils de conception, comme séparer évaluation de récupération et fidélité de génération, sont présentés comme des conséquences pratiques, sans les faire passer pour une garantie donnée par une norme ou un fournisseur.

## Limites et maintenance

Cette revue a été effectuée par l’agent qui a préparé le corpus. Une relecture humaine indépendante n’a pas été effectuée. Le statut `published` sélectionne le corpus initial de démonstration relu ; il ne constitue pas une certification externe ni une autorisation de publication automatique des futurs brouillons IA.

Les exemples JavaScript ont été exécutés sous Node, pas dans une matrice de navigateurs. L’explication des microtâches a aussi été confrontée au modèle HTML. Les fiches conceptuelles ne revendiquent ni benchmark d’index, ni déploiement Kubernetes, ni webhook Stripe réel, ni migration de production, ni commande Git destructive exécutée. Les conseils liés à ces systèmes restent contextualisés.

Le corpus ne contient aucun exemple exécutable laissé sans vérification. Tout nouveau code non testé doit rester en brouillon avec `code_unverified`. Les 60 entrées du backlog sont des propositions d’angles, sans revendication de vérification documentaire ou d’exécution.

Les délais `reviewAfterDays` valent 30 jours pour l’IA, 60 pour les contrats Stripe, 90 pour les frameworks et outils de déploiement, et 180 à 365 pour les notions plus stables. Une date dépassée déclenche une revue éditoriale ; elle ne prouve pas qu’un post est faux. Une modification de sens doit créer une nouvelle version de question dans l’application.

## Extension de 100 posts — 25 octobre 2026

État actuel : **130 posts, 130 QCM et un visuel par post**. Les 30 posts initiaux ci-dessus sont conservés ; 100 notions supplémentaires disposent chacune de trois paragraphes originaux (107 à 128 mots hors résumé), d'une référence distincte, d'un contexte, d'une limite et d'un QCM. Les 60 sujets du backlog initial sont maintenant réalisés avec `status: published` et leur `postSlug` ; 40 autres angles complètent le lot.

Les textes sources sont dans `batches/expansion-100.source.mjs`, le manifeste dans `batches/expansion-100.json` et le contrôle des **100 références récupérées avec succès** dans `batches/expansion-100.sources.json`. Les empreintes permettent d'identifier les documents effectivement consultés ; leur texte de travail reste sous `.local/source-reviews/`, hors Git. L'accessibilité d'une URL n'est pas une preuve factuelle : la revue confronte aussi le sens des notions aux références (notamment Array.fromAsync et la séquentialité, égalité des objets, échelle d'EPSILON, propriétés optionnelles, snapshots SQL, unicité/NULL et limites des métriques RAG).

Les références Node sont celles de la branche 22, PostgreSQL celles de la version 16. Le contrôle direct GNU et une référence Stanford ont subi des erreurs de récupération pendant les premières passes : GNU a ensuite été récupéré, et la référence de métriques a été remplacée par la documentation officielle scikit-learn accessible. Aucun échec réseau n'est présenté comme une consultation réussie. Les statuts Bash ont en outre été exécutés dans des processus courts : `exit 0` → 0, `exit 7` → 7, `false | true` → 0, et la même pipeline avec `pipefail` → 1.

Cette extension conceptuelle n'ajoute pas d'extrait de code exécutable non testé. Les extraits des 30 premiers posts restent vérifiés par les tests initiaux. Les QCM sont associés aux notions et leur correction est concise ; le détail se relit dans le post. Revue par l'agent auteur, sans relecture humaine indépendante.

Les **24 SVG** (10 logos, 14 stickers) sont stockés localement dans `public/post-art/` avec empreinte dans leur nom. Logos : tracés Simple Icons CC0 ; stickers : compositions originales avec pictogrammes Lucide ISC. Origines, empreintes et tailles dans `art-manifest.json`, mentions dans `public/post-art/LICENSES.txt`. Les SVG ne contiennent aucun script ou lien externe actif. Les visuels sont partagés, sans appel de génération d'image et sans chargement depuis un CDN tiers à la lecture.

Validation ajoutée : cent textes distincts substantiels, cent références distinctes, tous les visuels présents, absence de contenu SVG actif, refus de chemins arbitraires et compatibilité des anciennes versions sans champ de couverture. Les consommations mesurées et leurs limites sont détaillées dans `docs/CONTENT-CONSUMPTION.md` ; les tokens de la conversation restent inconnus.
