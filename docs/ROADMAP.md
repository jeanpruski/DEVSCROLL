# DevScroll — Feuille de route produit et technique pour Codex

Version 1 — 25 octobre 2026. Nom de travail remplaçable. Document de référence pour construire une application privée de découverte et de mémorisation technique pour Jean, développeur full stack.

## 1. Instructions de lecture et de réalisation

Ce document définit le produit attendu, les décisions de départ, les règles métier et les étapes de réalisation. Il sert de spécification au dépôt. Les choix proposés sont des décisions de conception, pas des exigences déjà confirmées par un prototype ou une étude utilisateur.

Codex doit livrer une application fonctionnelle par incréments, pas uniquement une landing page ou une maquette. Commencer par le lot 0, puis réaliser les lots dans l'ordre. Chaque lot doit laisser le projet exécutable. Les lots 0 à 6 constituent la V1 personnelle ; les lots 7 à 9 l'enrichissent. La génération automatique ne doit pas bloquer l'utilisation du fil ni les révisions.

Ne pas demander à Jean de choisir chaque bibliothèque. Vérifier la compatibilité des versions stables au démarrage, verrouiller les dépendances et consigner les choix structurants. Demander uniquement les informations indispensables qui ne peuvent être inférées, comme les identifiants d'un fournisseur choisi. Sans clé IA, livrer le reste avec un mode démo explicite et des contenus locaux.

À la fin de chaque lot : indiquer les fonctionnalités livrées, les commandes de vérification exécutées, les limites réelles et la prochaine étape. Ne jamais présenter un bouton factice, une réponse simulée ou une donnée en mémoire comme une intégration terminée.

## 2. Vision et objectif

Transformer une partie du temps passé à scroller en moments de découverte technique. Conserver le plaisir d'un fil visuel fluide, avec des posts courts, tout en permettant de retrouver et de mémoriser les connaissances utiles.

Le produit doit être assez agréable pour être ouvert spontanément pendant cinq minutes. Il doit aussi servir de bibliothèque personnelle : un post liké devient retrouvable par son thème, son contenu, son code et, plus tard, par une formulation approximative.

La réussite n'est pas le temps passé dans l'application. C'est la capacité à retenir une notion, à la retrouver et à l'utiliser. Une personne qui repart après quatre posts et une bonne révision a eu une session réussie.

### Public initial et hypothèses

- Un seul utilisateur réel au lancement : Jean, administrateur de son espace privé.
- Interface et explications en français, noms techniques et extraits de code conservés dans leur langue habituelle.
- Lecture principalement sur téléphone ; administration confortable sur ordinateur.
- Profil intermédiaire à confirmé : éviter un flux composé uniquement de définitions débutantes.
- Contenus préparés pour la plateforme, manuellement ou avec l'IA. Pas de réseau social de créateurs au départ.
- Connexion requise dès que l'application est accessible sur Internet.
- Les sujets HubSpot et intégrations métier sont présents, au sein d'une culture technique plus large.

Ces hypothèses peuvent être modifiées sans refonte de la base produit.

## 3. Principes du produit

1. Une idée principale par post et un bénéfice identifiable.
2. Les likes sauvegardent ; les réponses aux questions renseignent l'apprentissage.
3. La lecture n'est jamais présentée comme une preuve de maîtrise.
4. Un post technique doit préciser son contexte et ses limites quand ils changent son sens.
5. Les questions sont courtes, expliquées et facultatives.
6. Le flux fonctionne sur du contenu existant ; aucune génération IA synchrone pendant le scroll.
7. Aucun contenu produit automatiquement n'est publié sans validation dans la V1.
8. La navigation doit rester utilisable sans geste tactile et sans animation.
9. Le contenu et les progrès sont exportables.
10. Pas de pression liée aux séries quotidiennes, de notifications insistantes ou de classement social.

## 4. Périmètre de la V1 et suites

| Fonction | V1 personnelle | Ensuite |
|---|---|---|
| Fil vertical paginé | Oui | Personnalisation plus fine |
| Posts texte, code, petits carrousels | Oui | Visuels enrichis, schémas éditoriaux |
| Like et recherche dans les favoris | Oui | Collections avancées |
| Recherche générale lexicale | Oui | Recherche sémantique hybride |
| Questions et répétition espacée | Oui | Réponses libres et parcours |
| Édition et publication manuelles | Oui | Outils éditoriaux en lot |
| Brouillons IA à partir de sources | Oui, après le cœur fonctionnel | Production planifiée limitée |
| Sources, contexte, versions | Oui | Surveillance d'obsolescence |
| PWA installable | Oui, installation minimale | Lecture hors ligne maîtrisée |
| Comptes multiples | Modèle de données compatible | Inscription et espaces indépendants |
| Commentaires, abonnés, messages | Non | Hors feuille de route actuelle |
| Vidéos et audio | Non | À évaluer après usage réel |
| Abonnement payant | Non | À évaluer après validation personnelle |

Ne pas ajouter une boutique, une page marketing, un classement, des badges complexes ou une application native avant d'avoir validé l'usage du fil et des révisions.

## 5. Les parcours essentiels

### Première utilisation

Connexion, puis choix de cinq à huit thèmes, niveau indicatif et durée habituelle de session. Tout reste modifiable. Préremplir une proposition adaptée à Jean : JavaScript et TypeScript, Node.js, React, SQL, Linux, CI/CD, cloud, intégrations API et IA.

Afficher quelques posts immédiatement. Ne pas imposer un questionnaire initial long. Expliquer le cœur comme action unique : « Un like enregistre le post dans tes favoris. » Proposer les questions de révision activées avec possibilité de les désactiver.

### Session habituelle

Ouvrir le fil à l'endroit mémorisé, consulter des posts, liker une idée utile, passer un sujet connu. Après plusieurs posts qualifiés et si une notion est à revoir, afficher une carte question. Répondre ou passer, lire l'explication, continuer.

Après environ dix posts qualifiés, proposer discrètement un bilan et une sortie : « Tu as découvert 7 notions et revu 2 sujets. » Le fil peut continuer. Aucun compteur ne doit affirmer que les sept notions sont acquises.

### Retrouver une information

Ouvrir Favoris et saisir « annuler requête », « git annuler commit » ou `AbortController`. Les résultats affichent titre, thème, extrait pertinent et date de sauvegarde. Cliquer ouvre le post et conserve la requête et la position de la liste au retour.

La V1 doit retrouver les formulations prévues par les synonymes éditoriaux et les mots indexés. Elle ne doit pas promettre une compréhension universelle des requêtes en langage naturel avant la recherche sémantique.

### Créer du contenu

Depuis l'administration : créer un sujet, renseigner un objectif pédagogique, ajouter des sources, écrire ou générer un brouillon, prévisualiser, corriger et publier. Une question associée est recommandée pour les notions révisables, sans rendre obligatoire un QCM pour une anecdote historique.

### Réviser volontairement

Ouvrir Révisions pour voir les notions dues. Répondre à une question à la fois, obtenir immédiatement l'explication et éventuellement rouvrir le post. Afficher une fin explicite quand il n'y a plus de révisions disponibles.

## 6. Architecture des écrans

Navigation mobile à quatre entrées : Fil, Explorer, Favoris, Révisions. Profil et Réglages accessibles par l'avatar. Administration accessible au propriétaire depuis le profil, avec une navigation dédiée sur ordinateur.

| Route indicative | Contenu et actions |
|---|---|
| `/login` | Connexion et gestion des erreurs |
| `/onboarding` | Thèmes, niveaux, préférences |
| `/feed` | Fil mixte et questions facultatives |
| `/explore` | Recherche générale, thèmes et niveaux |
| `/saved` | Favoris et recherche limitée aux favoris |
| `/posts/[slug]` | Post complet, sources, question, approfondissement |
| `/reviews` | Session de révision et échéances |
| `/profile` | Activité descriptive et réglages |
| `/admin/posts` | Liste éditoriale et filtres de statut |
| `/admin/posts/[id]` | Éditeur et prévisualisation |
| `/admin/generation` | Préparer, lancer et suivre les lots IA |
| `/admin/quality` | Signalements, contenus à revalider |

Pour chaque écran, traiter chargement, absence de données, erreur, session expirée et reprise. Aucun écran ne doit rester sur un spinner permanent.

### Direction visuelle proposée

Interface mobile soignée, mode sombre par défaut et mode clair disponible. Fond ardoise, cartes lisibles, une couleur d'accent et des couleurs de thème discrètes. Typographie de lecture confortable, code en monospace. L'apparence doit inviter à lire, sans transformer chaque post en affiche pleine d'emojis.

Le post présente : thème et niveau, accroche, corps ou carrousel, code éventuel, phrase à retenir, puis actions. Les sources et détails longs s'ouvrent au clic. Le code peut défiler horizontalement ; le texte explicatif ne doit pas le nécessiter.

Ne pas forcer chaque post à tenir sur une seule hauteur d'écran : les petits écrans et grandes polices doivent pouvoir lire tout le contenu. Si un snap vertical est utilisé, le rendre souple et désactivable ; éviter les conflits entre scroll de page, de carte et de code.

## 7. Formats éditoriaux

Les limites ci-dessous sont des objectifs éditoriaux, ajustables après usage, pas des garanties de durée de lecture.

| Format | Structure attendue | Taille visée |
|---|---|---|
| Notion | Problème, explication, cas concret, à retenir | 80 à 160 mots |
| Astuce | Situation, action, limite | 60 à 130 mots |
| Piège | Intuition trompeuse, comportement réel, correction | 90 à 180 mots |
| Code | Contexte, extrait, résultat, explication | 5 à 18 lignes de code et texte court |
| Histoire | Fait daté, contexte, conséquence | 80 à 160 mots |
| Comparaison | Deux usages, différence, règle de choix | 100 à 180 mots |
| Carrousel | Accroche, 2 à 4 cartes d'explication, synthèse | 3 à 6 cartes au total |
| Question | Énoncé, 3 ou 4 choix, correction | Une notion testée |

Les posts plus longs passent dans l'approfondissement. Éviter les titres absolus comme « Toujours utiliser X » lorsque le sujet dépend du contexte. Indiquer si une commande détruit ou modifie des données. Ne pas mettre de commande dangereuse dans un bouton d'exécution.

### Taxonomie de départ

- Langages : JavaScript, TypeScript, Python, SQL, HTML et CSS.
- Frontend : React, rendu serveur, formulaires, accessibilité, navigateur, performances.
- Backend : Node.js, HTTP, API REST, webhooks, authentification, files de travail, cache.
- Données : PostgreSQL, MySQL, index, transactions, migrations, requêtes.
- Système et réseau : Linux, processus, permissions, DNS, TLS, reverse proxy, NGINX.
- DevOps : Git, GitHub Actions, Docker, CI/CD, déploiement, logs, monitoring.
- Cloud : AWS, Azure Functions, stockage, disponibilité, coûts et limites.
- Intégrations : HubSpot, CRM, pagination, rate limits, idempotence, synchronisations.
- IA : modèles de langage, tokens, contexte, RAG, outils, évaluations et limites.
- Culture technique : histoire du Web, choix de conception, origine d'outils et de protocoles.

Un post a un thème principal et jusqu'à cinq tags. Les notions utilisent des identifiants stables, distincts des tags. Deux posts de styles différents peuvent enseigner la même notion.

### Variété proposée au démarrage

Environ 60 % de sujets directement utiles, 25 % de concepts connexes et 15 % d'histoire ou découverte. En difficulté : 20 % de rappels, 60 % intermédiaire, 20 % avancé. Ces ratios sont des réglages de départ, pas des lois pédagogiques.

### Premier corpus

Créer 30 posts de démonstration rédigés, cohérents et relus, couvrant au moins huit thèmes et six formats. Préparer un backlog de 60 autres sujets. Les exemples qui n'ont pas été vérifiés doivent rester explicitement en brouillon.

Exemples de sujets : Promise.all et les promesses restantes ; AbortController ; event loop et tâches ; closures ; SQL NULL ; index composites ; transactions ; PUT et PATCH ; statuts 429 ; Retry-After ; backoff avec jitter ; idempotence d'un webhook ; signature HMAC ; pagination par curseur ; CORS ; cookies HttpOnly ; variables publiques dans un frontend ; `df` et `du` ; permissions Linux ; health checks ; readiness ; migrations de base ; rollback applicatif ; caches ; DNS TTL ; reverse proxy ; lockfile ; Git revert ; contexte d'un LLM ; RAG et recherche ; limites des sorties JSON structurées ; origine de JavaScript.

## 8. Modèle d'un post

Séparer le contenu pédagogique des interactions utilisateur. Le contenu public ou privé publié est versionné ; une édition ne doit pas réécrire silencieusement l'historique des réponses.

Exemple de contrat éditorial, à traduire en schéma de validation partagé :

```json
{
  "schemaVersion": 1,
  "slug": "promise-all-ne-stoppe-pas-les-autres-promesses",
  "locale": "fr",
  "title": "Promise.all ne stoppe pas les autres promesses",
  "format": "pitfall",
  "difficulty": "intermediate",
  "topic": "javascript",
  "tags": ["async", "promises"],
  "conceptKey": "js.promise-all.failure",
  "learningObjective": "Distinguer rejet de Promise.all et annulation des opérations",
  "blocks": [
    {"type": "paragraph", "text": "Si une promesse rejette, Promise.all rejette. Les autres opérations déjà lancées ne sont pas automatiquement annulées."},
    {"type": "paragraph", "text": "Si ces opérations acceptent une annulation, utilise leur mécanisme dédié, par exemple un AbortSignal pour certaines requêtes."}
  ],
  "takeaway": "Rejeter le résultat agrégé ne signifie pas annuler les opérations.",
  "searchAliases": ["annuler promesses", "erreur parallèle"],
  "context": {"technology": "JavaScript", "version": null},
  "sources": [],
  "reviewAfterDays": 180,
  "status": "draft"
}
```

Cet exemple illustre la structure ; il n'est pas publiable tant que ses sources ne sont pas ajoutées et vérifiées. Les blocs autorisés sont un sous-ensemble contrôlé : paragraphe, liste, code, comparaison, image avec texte alternatif. Pas de HTML arbitraire ou de MDX exécutable depuis la base.

Les sources contiennent URL, titre, éditeur, date de consultation, date de publication si connue et affirmations soutenues. Les dates techniques, modèles IA et numéros de version sont documentés quand ils sont pertinents ; ne pas inventer une précision indisponible.

## 9. Likes et signaux d'apprentissage

Un seul cœur en V1 : liker sauvegarde dans les favoris, déliker retire des favoris. Double appui facultatif. Éviter d'ajouter un signet redondant.

Actions secondaires : « Je connais déjà », « Plus comme ça », « Moins comme ça », « Signaler une erreur ». « Je connais déjà » réduit l'exposition, sans inscrire automatiquement la notion comme maîtrisée. Une sauvegarde inscrit la notion au suivi de révision si l'utilisateur a activé cette option.

Conserver séparément : impression technique, exposition qualifiée, sauvegarde, préférence, réponse et autoévaluation. Un passage rapide n'est pas un rejet explicite.

Exposition qualifiée proposée : au moins 60 % de la carte visible pendant cinq secondes cumulées lorsque l'onglet est actif. Ce signal signifie « exposé », jamais « compris ». Pour un carrousel, enregistrer les cartes vues. Ces valeurs sont configurables et testables.

## 10. Questions et répétition espacée

### Règles de présentation

Première version : QCM à réponse unique et lecture de petit code. Le vrai ou faux peut venir ensuite ; il facilite le hasard et ne doit pas dominer. Réponses libres, correction IA et exercices exécutables sont différés.

Une question teste un objectif précis, avec une réponse défendable, des distracteurs plausibles et une explication du bon choix ainsi que des erreurs importantes. Éviter les formulations ambiguës ou dépendantes d'une version non indiquée.

Séparer deux usages : un test immédiat facultatif en bas du post pour vérifier la compréhension et une révision différée pour la mémoire. Le test immédiat peut être stocké, mais ne fait pas avancer le calendrier de révision différée. Ne pas prétendre que répondre juste immédiatement prouve une rétention durable.

### Insertion dans le fil

- Proposer une première révision après cinq posts qualifiés si une notion est due.
- Maximum une question intercalée pour cinq posts qualifiés et trois par session par défaut.
- Ne jamais bloquer le défilement ; toujours afficher « Passer ».
- Passer n'est pas une mauvaise réponse et ne repousse pas l'échéance pédagogique.
- Ne pas représenter la même question dans la session ; appliquer aussi une pause d'une heure après un passage.
- Ne pas tester en révision différée une notion tout juste exposée dans la même session.
- S'il n'y a aucune notion due, continuer avec des posts ; ne pas inventer une révision.

Une session expire après trente minutes d'inactivité. Le plafond des révisions intercalées est aussi stocké côté serveur pour éviter qu'un rafraîchissement le remette immédiatement à zéro. La page Révisions peut proposer davantage de questions, à la demande.

### Éligibilité des notions

En V1, une notion entre dans les révisions lorsque le post est liké, lorsque Jean choisit « À revoir », ou lors d'un test explicite suivi d'un opt-in. La simple lecture ne remplit pas automatiquement un énorme backlog. Première échéance : lendemain, selon l'heure serveur et le fuseau utilisateur pour l'affichage.

### Ordonnanceur initial transparent

Utiliser un algorithme simple, versionné et déterministe. Ce choix est une heuristique produit, pas une implémentation revendiquée de FSRS ni une garantie scientifique. Échelle de délais : 1, 3, 7, 14, 30, 60 et 120 jours.

Stocker `stageIndex` initialement à 0, `dueAt` à J+1, dernière réponse, nombre d'échecs et version d'algorithme. À une révision différée due :

- Faux : remettre `stageIndex` à 0 et programmer le lendemain ; montrer immédiatement la correction.
- Juste mais difficile ou obtenu au hasard : garder le stade et utiliser son délai courant.
- Juste avec confiance normale : augmenter le stade d'un cran, plafonné, puis utiliser le nouveau délai.
- Passé : ne modifier ni stade ni échéance ; enregistrer seulement le passage et son délai de silence.

La confiance est demandée après révélation de la réponse ; un bouton « J'avais deviné » suffit au départ. Pas d'accélération pour les réponses « faciles » dans la V1.

Les délais représentent des durées à partir de la réponse, stockées en UTC. L'heure d'été ne doit pas créer de doublons. Des réponses hors échéance peuvent être conservées comme entraînement, sans promotion du stade. Une seule réponse de révision par notion et créneau dû est effective, même en cas de double clic ou d'onglets simultanés.

Après une erreur, un rappel dans la session est possible, mais il ne compte pas comme une nouvelle révision réussie. Après plusieurs échecs, proposer de relire l'explication ou un prérequis ; ne pas punir l'utilisateur.

### Solidité des réponses

Envoyer uniquement l'énoncé et les choix avant la réponse. Garder solution et justification côté serveur jusqu'à soumission. Associer tentative, version de question et ordre des choix. Utiliser des identifiants de choix stables, pas seulement leur index.

Évaluer et mettre à jour l'échéance dans une transaction, avec verrou ou contrôle de version et clé d'idempotence unique. Un second envoi identique renvoie le résultat existant. Une question retirée ou corrigée ne doit plus être servie. Une correction qui change le sens invalide sa version ; conserver l'audit et proposer une réévaluation explicite de la notion.

Prévoir plusieurs questions par notion à terme pour éviter de mémoriser une position ou une formulation. En V1, au moins une question valide par notion révisable et variation de l'ordre des choix sans dégrader le sens.

## 11. Construction du fil

Un fil déterministe simple suffit avant tout apprentissage automatique. Ne pas utiliser le temps de lecture comme unique objectif de classement.

Créer une session de fil avec identifiants ordonnés et version de classement. Cela évite les doublons ou les sauts lorsque les poids évoluent entre deux pages. Paginer par curseur opaque lié à cette session et à l'utilisateur. Le curseur n'autorise jamais à consulter les données d'un autre compte.

### Règles V1

1. Candidats : uniquement les posts publiés, accessibles, dans la langue demandée et non retirés.
2. Exclure les éléments déjà servis dans la session et les posts récemment exposés, sauf épuisement annoncé du stock.
3. Classer selon thèmes choisis, niveau, nouveauté et retours explicites.
4. Insérer environ un post de découverte hors thèmes principaux pour quatre posts ciblés.
5. Éviter plus de deux posts successifs du même thème et deux variantes successives de la même notion.
6. Insérer les questions dues selon les règles précédentes, au moment du service ; ne pas les intégrer dans le score des posts.
7. Quand le stock inédit est épuisé, afficher « Tu as fait le tour des nouveaux posts » et proposer favoris, révisions ou relecture volontaire.

Les contraintes de diversité peuvent être relâchées si le corpus est trop petit, jamais celles de publication ou d'accès. Une graine de hasard par session rend les problèmes reproductibles. Documenter les poids dans une configuration versionnée. Une modification du classement ne réordonne pas la session active.

Les likes renforcent modérément les thèmes ; ils ne doivent pas enfermer le flux. Les réponses erronées influencent les révisions, pas une avalanche de posts répétés. La nouveauté porte sur la notion et pas uniquement sur le slug.

## 12. Recherche et favoris

V1 : PostgreSQL avec recherche plein texte et gestion explicite des termes techniques. Indexer titre, accroche, texte, résumé, tags, notion, alias et texte des blocs de code. Pondérer le titre et les tags davantage que le corps. Prévoir une configuration française pour la prose et une configuration simple pour les identifiants techniques.

La tokenisation de `C++`, `C#`, `.env`, `Promise.all`, `CI/CD` et `Node.js` exige des alias ou un index normalisé complémentaire. Tester ces cas avec des résultats attendus, pas uniquement avec des mots français simples. Ajouter `pg_trgm` pour les fautes de frappe si disponible sur le serveur choisi ; maintenir un chemin fonctionnel sans cette extension.

Filtres : thème, niveau, format, sauvegardé et période de sauvegarde. Requête vide dans Favoris : derniers likes, avec tri stable `savedAt` puis identifiant. Appliquer la restriction utilisateur et les droits avant de paginer et de compter.

Post dépublié : conserver la sauvegarde et afficher un état indisponible dans les favoris, sans exposer le contenu retiré. Une correction courante met à jour l'affichage vers la version publiée, avec indication de modification importante si nécessaire.

V2 sémantique : embeddings calculés en tâche de fond sur les contenus publiés et recherche hybride. Conserver le filtrage des favoris et droits dans la requête. Réindexer après modification, versionner le modèle d'embedding et mesurer sur un jeu de requêtes réelles. Ne pas ajouter une base vectorielle distincte avant d'avoir démontré son besoin.

## 13. Production et validation du contenu

### Circuit éditorial

`idea → draft → review → published → archived`. Ajouter des drapeaux `needs_sources`, `code_unverified`, `stale` et `reported` plutôt que de multiplier les statuts incompatibles. Une nouvelle révision d'un post publié reste en brouillon jusqu'à approbation ; le post publié précédent continue d'être visible sauf retrait explicite.

L'administrateur peut créer, modifier, prévisualiser, publier, dépublier, archiver, dupliquer et importer un fichier JSON validé. Les identifiants restent stables ; les révisions sont immuables. La publication atomique met à jour la version courante et l'index de recherche.

### Assistant IA

L'utilisateur choisit thème, niveau, format, objectif et quantité plafonnée. Il fournit une ou plusieurs sources autorisées ; une étape ultérieure peut découvrir des sources proposées. Le backend prépare les extraits nécessaires, demande une sortie structurée, valide le schéma, enregistre un brouillon et présente les points à vérifier.

Le modèle ne décide pas seul qu'un contenu est vrai. Une seconde passe IA peut repérer une contradiction, mais ne constitue pas une validation indépendante. La validation humaine reste requise avant publication en V1.

Pour une histoire, vérifier les faits et dates dans des sources primaires lorsque disponibles. Pour une fonctionnalité, préciser la version ou le contexte qui peut modifier le comportement. Pour le code, ajouter une vérification adaptée et conservée dans le dossier éditorial.

Une URL correcte n'est pas une preuve que la source soutient l'affirmation. L'écran de validation doit montrer les liens entre affirmations, extraits et références. Aucun statut « vérifié » fondé seulement sur une requête HTTP réussie.

### Règles de génération

- Répondre en français, sans remplissage ni promesse absolue.
- Produire une seule notion principale ; inclure ses prérequis.
- Ne pas inventer une API, une option CLI, une citation, une URL ou une date.
- Si les sources sont insuffisantes, produire un état incomplet avec les manques.
- Générer une question uniquement si une réponse unique est justifiable.
- Générer et valider les distracteurs ; pas de « toutes les réponses » ni de choix qui divulgue la solution.
- Conserver modèle, version du prompt, paramètres utiles, sources, horodatage et coût estimé ou réel quand disponible.
- Les sorties structurées règlent la forme ; elles ne garantissent pas la vérité du contenu.

### Protection et limites techniques

Les pages récupérées sont des données non fiables, jamais des instructions. Le modèle n'a pas accès aux secrets ni à des outils capables de modifier l'infrastructure. Protéger la récupération de sources contre SSRF : schémas autorisés, blocage des IP privées, locales et metadata, vérification DNS et de chaque redirection, taille et durée maximales. Commencer par une liste d'hôtes documentaires autorisés.

Ne pas exécuter automatiquement le code généré dans le serveur applicatif. Vérifications limitées à des cas éditoriaux relus ou à un environnement isolé, sans secrets ni accès réseau, avec quotas stricts. L'exécution arbitraire de code généré n'est pas un prérequis de la V1.

Respecter les conditions des sources et éviter de recopier des articles complets. Rédiger des synthèses originales, attribuer et limiter les extraits. Ne pas importer de documentation privée de clients dans un service externe sans décision explicite.

### Déduplication et obsolescence

Avant génération : comparer notion, angle, thème et titres existants. Une similarité suggérée n'entraîne pas une suppression automatique. Une nouvelle explication d'une même notion peut être utile si son angle diffère.

Délais éditoriaux indicatifs : IA et API changeantes, revue tous les 30 à 60 jours ; frameworks et cloud, 90 jours ; notions stables, 180 à 365 jours. Une échéance dépassée signale une revue à faire, sans prouver une erreur. Un contenu techniquement incorrect est retiré et ses questions suspendues.

## 14. Architecture technique proposée

Un dépôt, une application web et un worker. Éviter microservices, Kubernetes et application mobile native au départ.

| Couche | Proposition | Rôle |
|---|---|---|
| Web | Next.js, React, TypeScript | Interface et endpoints serveur |
| UI | Tailwind CSS et composants accessibles | Cohérence et vitesse de réalisation |
| Validation | Zod ou équivalent partagé | Entrées API et contrats éditoriaux |
| Données | PostgreSQL et Prisma | Transactions, migrations et recherche |
| Auth | Bibliothèque éprouvée compatible avec l'hôte | Sessions et contrôle d'accès |
| Worker | Processus Node.js séparé | Génération, indexation et maintenance |
| Jobs | Table PostgreSQL à verrouillage transactionnel | File simple sans Redis initial |
| IA | Adaptateur fournisseur côté serveur | Brouillons structurés et limites de coût |
| Tests | Vitest et Playwright | Métier, intégration et parcours |
| Exécution locale | Docker Compose pour PostgreSQL | Installation reproductible |
| Production | Hôte Node.js avec web et worker, base persistante | Déploiement et sauvegardes |

Il s'agit d'une architecture recommandée pour ce projet. Codex doit vérifier les versions compatibles et les besoins de l'hébergement au moment de l'implémentation, sans supposer que n'importe quel hébergement mutualisé accepte un worker permanent.

Prisma ne remplace pas les fonctions PostgreSQL : accepter des migrations SQL explicites pour les index de recherche, extensions et verrous. Garder l'algorithme de révision, la sélection du fil et les règles de publication dans des modules métier indépendants de React.

### Arborescence indicative

```text
app/                 routes et interfaces
components/          composants visuels
modules/feed/        constitution et pagination du fil
modules/content/     versions, publication et taxonomie
modules/reviews/     questions, réponses et calendrier
modules/search/      indexation et requêtes
modules/generation/  adaptateurs IA et validation
modules/auth/        accès et sessions
lib/                 base, configuration et utilitaires
worker/              prise de jobs et handlers
prisma/              schéma, migrations et seeds
content/             exemples et import JSON
tests/               tests d'intégration et parcours
docs/                décisions, exploitation et avancement
```

### Environnements

Développement, test et production séparés. Prévoir un environnement de préproduction dès le premier déploiement réel. Aucun test automatisé ne doit lancer une génération facturée par défaut. Aucun seed de démonstration ne doit écraser une base de production.

Fournir `.env.example` sans secret : URL de base, URL applicative, secret de session, configuration de connexion, fournisseur IA, clé IA facultative au démarrage, modèle configurable, plafond de génération, hôtes sources autorisés, fréquence de jobs et niveau de logs. Valider les variables au démarrage ; ne jamais exporter une clé IA dans une variable frontend publique.

## 15. Modèle relationnel

| Entité | Champs et contraintes principaux |
|---|---|
| User | id, identité, rôle, fuseau, dates ; identité d'auth unique |
| UserPreference | userId unique, niveaux, révisions actives, préférences de fil |
| Topic et Tag | identifiant stable, slug unique, libellé |
| UserTopic | userId + topicId unique, poids explicite |
| Concept | key unique, objectif, prérequis |
| Post | id, slug unique, statut, currentPublishedVersionId, conceptId |
| PostVersion | postId + numéro unique, JSON validé, texte indexable, auteur, dates |
| Source | URL normalisée, titre, éditeur, dates de consultation |
| PostVersionSource | version, source, affirmations ou extraits associés |
| QuestionVersion | conceptId, version, énoncé, choix, solution serveur, explication, statut |
| SavedPost | userId + postId unique, savedAt |
| UserPostFeedback | userId + postId unique, connu, plus ou moins, dates |
| Exposure | userId, postId, sessionId, eventId unique, exposition agrégée |
| LearningState | userId + conceptId unique, stageIndex, dueAt, version algo, lockVersion |
| QuestionAttempt | userId, questionVersionId, conceptId, mode, choix, score, confiance, answeredAt, idempotencyKey unique par utilisateur |
| ReviewOpportunity | userId, conceptId, dueAt, état et tentative effective ; unicité du créneau |
| FeedSession | userId, seed, version classement, ordre, expiration |
| Job | type, payload validé, état, tentatives, availableAt, lockedUntil, idempotencyKey |
| GenerationRun | fournisseur, promptVersion, statut, budget réservé, usage, erreurs |
| ContentReport | userId, postVersionId, raison, statut de traitement |
| AuditLog | acteur, action éditoriale, cible, date, métadonnées minimales |

Les noms peuvent évoluer, pas les contraintes métier. Dates en UTC, identifiants opaques et index sur les clés de filtrage. Ne pas placer toutes les interactions dans un JSON géant de l'utilisateur.

Index nécessaires : favoris par utilisateur et date ; révisions par utilisateur et dueAt ; posts publiés et thèmes ; tentatives par utilisateur et notion ; jobs par état et availableAt ; index de recherche GIN adapté. Contrôler les plans des requêtes principales sur un jeu de données représentatif.

Définir clairement la politique de suppression : supprimer un utilisateur efface ses interactions, sans effacer le corpus éditorial partagé. Archiver un post conserve les historiques de réponses. Une suppression définitive de contenu doit être une action administrative distincte et documentée.

## 16. Contrats serveur

Les routes ci-dessous décrivent le comportement attendu. Les Route Handlers ou actions serveur peuvent varier, mais les mutations doivent être centralisées, validées et autorisées côté serveur.

| Opération | Comportement essentiel |
|---|---|
| `GET /api/feed` | Session et curseur opaques, limite bornée, posts et questions éligibles |
| `GET /api/posts/:id` | Version publiée accessible, solution non divulguée |
| `PUT /api/saved/:postId` | Créer ou conserver le favori de l'utilisateur connecté |
| `DELETE /api/saved/:postId` | Retrait idempotent du favori |
| `GET /api/search` | q, scope, filtres, curseur, droits appliqués |
| `POST /api/exposures` | Lot borné et dédoublonné, pas de contenu sensible |
| `GET /api/reviews` | Questions dues sans solution |
| `POST /api/attempts` | Validation, idempotence, correction et nouvelle échéance |
| `PUT /api/preferences` | Mise à jour des préférences propres à l'utilisateur |
| `POST /api/reports` | Signalement d'une version précise |
| `POST /api/admin/posts` | Créer un brouillon validé |
| `POST /api/admin/posts/:id/publish` | Publication atomique d'une version approuvée |
| `POST /api/admin/generation-runs` | Réserver le budget et mettre le travail en file |
| `GET /api/admin/generation-runs/:id` | Statut, coûts et erreurs compréhensibles |

Erreurs cohérentes : non connecté, non autorisé, introuvable, validation, conflit, quota et indisponibilité. Utiliser codes HTTP appropriés et codes métier stables, sans exposer de stack trace. Borner longueurs, tailles des lots et nombres de résultats.

Le serveur déduit userId de la session. Une valeur userId envoyée par le navigateur n'est jamais une autorisation. Vérifier rôle propriétaire sur chaque action d'administration, pas seulement dans la navigation.

## 17. Worker et fiabilité

Le worker prend un job atomiquement, pose un bail, exécute puis marque son résultat. Un job expiré peut être repris. Les handlers supportent une livraison au moins une fois : création de brouillon, publication et indexation doivent être idempotentes.

Définir des retries bornés pour erreurs transitoires, avec backoff exponentiel, jitter et respect de Retry-After. Ne pas réessayer indéfiniment les erreurs de validation ou d'authentification. Après le plafond, état failed et relance administrative explicite. Conserver des logs corrélés au job et au lot de génération.

Un timeout fournisseur peut survenir après facturation ou génération effective. Une clé locale ne garantit pas l'absence de double facturation côté fournisseur. Vérifier les possibilités d'idempotence du fournisseur choisi, limiter les tentatives et présenter les coûts incertains comme tels.

Réserver le budget avant l'appel sous transaction afin que deux workers ne dépassent pas le plafond par concurrence. Libérer ou régulariser la réservation au résultat ; maintenir une réserve prudente en cas de résultat inconnu. Limiter concurrence, taille d'entrée, sortie et nombre de brouillons par lot.

## 18. Sécurité et confidentialité

Authentification par une bibliothèque maintenue ; accès privé sans inscription publique en V1. Cookie de session HttpOnly, Secure en production et politique SameSite adaptée. Contrôles d'origine et protections CSRF cohérents avec le mécanisme retenu. Limitation de débit sur connexion, recherche coûteuse et génération.

Contrôler tous les accès côté serveur. Ajouter un test avec un second utilisateur synthétique pour vérifier qu'il ne peut ni lire les favoris de Jean, ni soumettre une réponse à sa place, ni administrer les contenus.

Valider et assainir les contenus ; refuser HTML actif et URL dangereuses. Les liens externes s'ouvrent avec protections adéquates. Aucun secret dans les logs, exports, prompts ou captures d'erreur. Les endpoints de jobs et de diagnostic internes sont protégés.

Prévoir export JSON des contenus et interactions utiles, suppression du compte et rétention limitée des événements bruts. Proposition initiale : événements détaillés 90 jours, agrégats utiles conservés jusqu'à suppression. Les tentatives pédagogiques restent dans l'historique sauf suppression utilisateur. Si ouverture à d'autres utilisateurs, revoir information de confidentialité, obligations applicables et traitements externes avant mise en ligne publique.

## 19. Performance, accessibilité et PWA

- Utilisable à 360 px de largeur et avec zoom texte ; pas de débordement global.
- Cibles tactiles confortables, contraste vérifié, labels explicites et focus visible.
- Aucun geste obligatoire ; boutons et navigation clavier équivalents.
- Annoncer les corrections de questions aux lecteurs d'écran sans lire prématurément la réponse.
- Respecter les préférences de réduction des animations.
- Précharger la page suivante avec une limite ; annuler les requêtes devenues inutiles.
- Éviter de monter des centaines de cartes ; préserver focus et position si virtualisation.
- Mutation de favori optimiste avec rollback visuel si l'enregistrement échoue.
- Objectif de recherche : p95 inférieur à 500 ms côté serveur sur le corpus de test, mesuré dans un environnement documenté.
- Objectif terrain : LCP inférieur à 2,5 s au 75e percentile sur les appareils visés, à mesurer après déploiement ; une cible n'est pas un résultat.

PWA V1 : manifeste, icônes, installation compatible et écran réseau absent clair. Pas de promesse hors ligne complète. Ne pas mettre en cache des endpoints authentifiés ou des solutions de questions par défaut. Déconnexion et changement de compte doivent purger les données privées locales. Un éventuel mode hors ligne nécessitera une conception spécifique des conflits de réponses et favoris.

## 20. Mesures de réussite

Tableau personnel sobre : posts exposés, favoris, questions tentées, réponses justes et notions à revoir. Afficher la taille de l'échantillon. Une augmentation du taux de bonnes réponses peut venir de questions répétées ; ne pas l'appeler automatiquement progression de compétence.

Mesures utiles après deux semaines : Jean ouvre-t-il spontanément le produit ? Retrouve-t-il un post sauvegardé ? Les questions reviennent-elles au bon moment ? Le corpus se renouvelle-t-il suffisamment ? La production de dix posts de qualité prend-elle un temps acceptable ?

Protocole de validation proposé : utiliser la V1 pendant quatorze jours, noter trois frictions et trois exemples d'informations retenues ou utilisées. Ajuster corpus, fréquence des questions et ergonomie avant d'ajouter des fonctionnalités importantes.

Ne pas optimiser la durée de session ou le nombre de scrolls. Aucune notification n'est nécessaire à ce test.

## 21. Feuille de route de réalisation

Les charges sont des ordres de grandeur en jours de travail effectif de Jean avec Codex, comprenant lecture, corrections et validation. Elles ne sont pas des engagements ni une prévision du temps machine. Réestimer après les lots 1 et 2. Les contraintes d'hébergement, l'authentification et l'effort éditorial peuvent modifier fortement ces chiffres.

### Lot 0 — Cadrage du dépôt et décisions

Charge indicative : 0,5 à 1 jour. Dépendance : aucune.

- Copier ce document dans `docs/ROADMAP.md`.
- Créer `docs/DECISIONS.md`, `docs/PROGRESS.md` et un backlog avec identifiants stables.
- Vérifier les versions compatibles et documenter le choix de l'authentification et de l'hébergement cible.
- Définir commandes standard, variables et limites de périmètre.
- Préparer un plan d'implémentation du lot 1 sans construire les lots suivants.

Validation : architecture résumée, commandes de démarrage prévues, absence de dépendance à une clé IA pour le premier écran. Livrable : dépôt cadré et première décision technique.

### Lot 1 — Socle exécutable et interface

Charge : 1 à 2 jours. Dépendance : lot 0.

- Initialiser application TypeScript, UI, formatage et scripts de validation.
- Installer PostgreSQL local, première migration et seed idempotent.
- Implémenter connexion privée et propriétaire, layout mobile, mode sombre et navigation.
- Construire un composant PostCard sur données locales réalistes.
- Ajouter écrans d'absence de contenu et d'erreur, sans boutons factices.

Validation : installation depuis un clone propre, connexion/déconnexion, navigation mobile et données persistantes. Aucun accès admin anonyme. Livrable : application utilisable localement avec base.

### Lot 2 — Fil persistant et favoris

Charge : 2 à 3 jours. Dépendance : lot 1.

- Modéliser posts, versions, thèmes, notions et favoris.
- Intégrer les 30 posts du corpus initial et plusieurs carrousels/code.
- Construire sessions de fil, pagination et déduplication.
- Ajouter likes persistants, double clic sans doublon et rollback d'erreur.
- Préserver position au retour d'un détail et enregistrer les expositions qualifiées.

Validation : un favori existe après rafraîchissement et reconnexion ; aucune répétition involontaire sur trois pages ; lecture confortable sur téléphone. En cas de stock épuisé, état explicite. Livrable : première boucle de lecture réelle.

### Lot 3 — Recherche et exploration

Charge : 1 à 2 jours. Dépendance : lot 2.

- Indexer les contenus et alias ; créer les index SQL nécessaires.
- Construire recherche globale et recherche dans les favoris.
- Ajouter filtres, pagination, annulation des anciennes requêtes et état vide.
- Vérifier les termes techniques et formulations approximatives prévues.

Validation : un post contenant AbortController et son alias ressort dans le bon périmètre ; un post non liké ne ressort pas dans Favoris. Cas de faute de frappe et termes spéciaux couverts. Livrable : bibliothèque personnelle retrouvable.

### Lot 4 — Révisions et mémorisation

Charge : 2 à 4 jours. Dépendance : lot 2 ; lot 3 peut précéder pour valider la boucle de sauvegarde.

- Modéliser questions versionnées, créneaux, tentatives et états pédagogiques.
- Implémenter ordonnanceur avec horloge injectable et version d'algorithme.
- Créer au moins douze questions relues couvrant des notions du seed.
- Ajouter correction, confiance, passage et consultation du post source.
- Insérer les questions dues dans le fil ; construire la page Révisions.
- Protéger double soumission, onglets simultanés et fuite de la solution.

Validation : tests déterministes sur chaque transition de calendrier ; un passage ne pénalise pas ; aucun test immédiat ne promeut le stade ; après une semaine simulée, les échéances restent cohérentes. Livrable : cœur pédagogique opérationnel.

### Lot 5 — Administration éditoriale

Charge : 2 à 3 jours. Dépendance : lots 2 et 4.

- Construire éditeur de blocs, prévisualisation mobile et import/export JSON.
- Ajouter sources, versions, statuts, validation et publication atomique.
- Gérer questions, corrections, retrait d'un contenu et signalements.
- Créer une vue des contenus à revalider.

Validation : publier depuis l'interface, corriger sans écraser l'historique, retirer une question incorrecte, exporter et réimporter sans doublon. Livrable : production manuelle autonome.

### Lot 6 — Assistant IA et première mise en service

Charge : 3 à 5 jours. Dépendance : lot 5.

- Brancher un fournisseur derrière un adaptateur configurable.
- Implémenter sources autorisées, schéma de sortie, brouillons et points de contrôle.
- Ajouter file de jobs, coûts, budgets réservés, retries et reprise après crash.
- Ajouter mode sans clé IA ; aucune génération n'est nécessaire pour scroller.
- Déployer web, worker et base ; configurer TLS, logs, sauvegardes et contrôle de santé.
- Ajouter manifeste PWA et tester sur le téléphone de Jean.
- Exécuter restauration de sauvegarde dans un environnement distinct.

Validation : un lot produit uniquement des brouillons ; une erreur fournisseur est visible et récupérable ; le budget bloque de nouveaux appels ; un restart n'entraîne pas de doubles publications. Démontrer une restauration. Livrable : V1 personnelle en ligne.

### Lot 7 — Retour d'usage et qualité

Charge : 1 à 3 jours de corrections après quatorze jours d'usage. Dépendance : V1 en service.

- Examiner les frictions et le corpus consommé.
- Ajuster densité des cartes, recherche, fréquence des questions et variété.
- Ajouter export de données utilisateur et diagnostic utile.
- Renforcer le corpus sur les thèmes réellement consultés.

Validation : Jean peut citer des posts retrouvés et des notions retenues ; les principaux problèmes signalés ont une résolution vérifiable. Décider des suites à partir de cet usage.

### Lot 8 — Recherche sémantique et personnalisation

Charge : 2 à 4 jours. Dépendance : lot 7 et besoin observé.

- Construire un jeu de vingt à trente requêtes réelles avec résultats attendus.
- Ajouter embeddings en arrière-plan et recherche hybride si cela améliore les résultats.
- Ajouter collections, variantes de questions et réglage fin des thèmes si utile.
- Mesurer pertinence, latence et coût face à la recherche V1.

Validation : amélioration démontrée sur le jeu de requêtes sans régression sur les identifiants exacts ni fuite de favoris. Sinon conserver la recherche lexicale.

### Lot 9 — Production régulière et ouverture éventuelle

Charge à estimer après usage. Dépendance : lots précédents et décision explicite.

- Production planifiée de brouillons, quotas et revue des sources.
- Questions variantes et adaptation pédagogique plus élaborée.
- Inscription, espaces isolés et administration adaptée si ouverture à d'autres personnes.
- Revoir coût par utilisateur, confidentialité, support et conditions de diffusion.

Validation : l'ouverture au public est une décision distincte. La création d'une application personnelle n'autorise pas automatiquement l'inscription publique ou des achats de services.

### Ordre et effort global

V1 personnelle : environ 12 à 20 jours effectifs d'après les fourchettes des lots 0 à 6 ; prévoir une marge et réestimer tôt. Le corpus et sa vérification peuvent demander un effort supplémentaire selon leur profondeur. Une version locale fil et favoris apparaît dès le lot 2 ; une version avec apprentissage actif dès le lot 4. Ne pas attendre la génération IA pour tester le concept.

## 22. Plan de vérification

Tester les comportements à risque et les parcours réels. Ne pas multiplier les snapshots de composants ou les tests qui recopient les constantes sans vérifier leur effet.

| Domaine | Vérifications significatives |
|---|---|
| Fil | curseurs stables, doublons, contenu retiré, petit corpus |
| Favoris | ajout et retrait idempotents, échec réseau, persistance |
| Recherche | périmètre utilisateur, termes techniques, accents, filtres, publication |
| Révisions | vrai, faux, deviné, passé, date limite, plafond, changement d'heure |
| Concurrence | double clic, deux onglets, une seule progression effective |
| Questions | solution absente avant réponse, version conservée, retrait appliqué |
| Éditorial | brouillon non visible, publication atomique, version précédente conservée |
| IA | refus, sortie invalide, source absente, timeout, quota, coût inconnu |
| Jobs | reprise de bail expiré, retry borné, idempotence de résultat |
| Sécurité | anonyme, second utilisateur, rôle lecteur, récupération de sources hostile |
| Mobile | petit écran, grandes polices, carrousel, code long, clavier |
| Exploitation | migrations, sauvegarde et restauration, restart web et worker |

Parcours E2E prioritaires : connexion → lecture → favori → recherche → détail ; notion sauvegardée → date simulée → révision → correction → échéance ; administrateur → brouillon → publication → visibilité ; échec IA → statut explicite → reprise sans double publication.

Performance : seed synthétique séparé de 10 000 posts et interactions réalistes, plans des principales requêtes et mesure des cibles. Les données synthétiques ne deviennent pas du contenu utilisateur.

## 23. Exploitation et déploiement

Fournir un guide local depuis zéro : prérequis, variables, démarrage base, migration, seed, lancement web et worker. Fournir un guide production : build, migrations, démarrage, TLS, sauvegardes, alertes et procédure de restauration.

CI minimale : installation verrouillée, lint, typecheck, tests métier et intégration, build ; parcours E2E prioritaires sur branche ou préproduction. Éviter les appels IA réels dans les checks courants.

Migrations compatibles avec la version en service lorsque possible. Sauvegarder avant une migration risquée. Un rollback de code ne restaure pas automatiquement le schéma ou les données ; documenter les étapes et préférer une correction en avant quand nécessaire.

Logs structurés avec requestId/jobId, sans corps de posts privés complets ni clés. Surveiller erreurs web, échecs de jobs, backlog, disponibilité base et dépenses de génération. Une alerte ne doit pas être marquée envoyée tant qu'un canal n'est pas réellement configuré.

Sauvegardes automatiques chiffrées selon capacités de l'hôte, rétention documentée et essai de restauration. Objectifs initiaux proposés : perte maximale de 24 h de données et retour sous 4 h, à confirmer après choix de l'hébergement et exercice réel.

## 24. Coûts et maîtrise du budget

Aucun tarif fournisseur précis n'est figé dans ce document. Vérifier les prix à la date du choix et avant tout abonnement. Une première version locale fonctionne sans coût d'API IA.

Les postes de coût sont : hébergement web et worker, PostgreSQL, sauvegardes, domaine facultatif, appels de génération, éventuels embeddings et outils de surveillance. Éviter les images générées pour chaque post en V1 ; texte et code suffisent pour valider l'expérience.

Formule de suivi IA : coût d'entrée + coût de sortie + éventuels appels d'outils et embeddings, multipliés par les tentatives réelles. Afficher estimation avant un lot et usage après exécution, avec incertitude si le fournisseur ne donne pas de résultat complet.

Proposition de configuration personnelle : génération manuelle uniquement, cinq brouillons maximum par lot, un appel concurrent initial, plafond mensuel configurable et génération désactivée tant qu'aucun budget n'est renseigné. Le montant final appartient à Jean ; ne pas activer une dépense récurrente implicite.

## 25. Risques et arbitrages

| Risque | Réponse prévue |
|---|---|
| Posts faux mais convaincants | Sources reliées aux faits, validation et corrections versionnées |
| Nouveau scroll sans mémorisation | Révisions différées, sortie douce de session, mesure de l'utilité |
| Corpus consommé trop vite | Stock inédit explicite, production par lots, relecture volontaire |
| Révisions envahissantes | Plafond, passage libre, opt-in et page dédiée |
| Mémorisation du QCM | Variantes, distracteurs solides, prise en compte des réponses devinées |
| Projet trop vaste | Lots livrables, IA après cœur fonctionnel, social différé |
| Recherche décevante | Alias et cas techniques testés avant embeddings |
| Dépense IA incontrôlée | Quotas, réservations atomiques, retries bornés |
| Données perdues | Exports, sauvegardes et restauration éprouvée |
| Complexité mobile | Lecture naturelle, gestes facultatifs, essais sur appareil réel |

## 26. Définition de la V1 terminée

- [ ] Installation documentée et reproductible depuis un clone propre.
- [ ] Application privée accessible et utilisable sur téléphone.
- [ ] Trente posts de qualité, au moins huit thèmes et douze questions vérifiées.
- [ ] Fil stable, diversité minimale, fin de stock explicite.
- [ ] Favoris persistants avec recherche dans leur contenu.
- [ ] Révisions dues, questions facultatives, corrections et calendrier cohérent.
- [ ] Réponses et échéances résistantes aux doublons et à la concurrence.
- [ ] Création manuelle, prévisualisation, sources, publication et correction depuis l'admin.
- [ ] Assistant IA produisant des brouillons avec quotas et erreurs visibles.
- [ ] Application toujours utilisable sans fournisseur IA disponible.
- [ ] Autorisations testées côté serveur et absence de secrets exposés.
- [ ] Tests principaux, typecheck et build réussis.
- [ ] Sauvegarde restaurée avec succès dans un environnement distinct.
- [ ] Export des contenus disponible et limites connues documentées.
- [ ] Aucun bouton central factice ni simulation présentée comme réelle.

## 27. Prompt initial à donner à Codex

Copier ce fichier dans le dépôt sous `docs/ROADMAP.md`, puis donner cette instruction :

```text
Construis DevScroll en suivant docs/ROADMAP.md.

C'est une application privée, mobile d'abord et en français, pour apprendre
en consultant de courts posts techniques. Elle doit avoir un vrai fil,
des likes qui enregistrent les posts, une recherche dans les favoris,
des questions de révision différée et un espace de production du contenu.

Lis le document en entier avant de modifier le code. Inspecte le dépôt
existant et conserve ses conventions lorsqu'elles sont compatibles.
Réalise d'abord le lot 0, puis implémente le lot 1 et vérifie-le réellement.
Ne tente pas de tout construire en une seule passe. Ne livre pas une simple
landing page ou une maquette à la place de l'application.

Fais des choix raisonnables sans me demander chaque détail. Vérifie les
versions et documente les décisions. Le projet doit démarrer sans clé IA,
avec du contenu local explicite, mais les interactions doivent persister.
N'achète aucun service et n'ouvre pas les inscriptions publiques.

Mets à jour docs/PROGRESS.md à chaque lot : terminé, vérifié, limites,
prochaine étape. À chaque fin de lot, indique les commandes exécutées
et les résultats observés. Ne prétends pas avoir exécuté un test non lancé.
```

Pour poursuivre : « Lis docs/ROADMAP.md et docs/PROGRESS.md, puis réalise le prochain lot non terminé avec ses critères de validation. »

## 28. Références techniques consultées

Références officielles consultées pour orienter les choix le 25 octobre 2026. Elles décrivent des capacités techniques, pas une validation de l'ensemble de l'architecture ou du calendrier proposé. Codex doit les reconsulter quand il fixe les versions et implémente les intégrations.

- Next.js, authentification et autorisations : https://nextjs.org/docs/app/guides/authentication
- PostgreSQL, pg_trgm et index de similarité : https://www.postgresql.org/docs/current/pgtrgm.html
- OpenAI, sorties structurées et limites de la garantie de schéma : https://developers.openai.com/api/docs/guides/structured-outputs

Le mécanisme de répétition espacée décrit ici est une règle de départ propre au projet, à évaluer sur l'usage réel. Ne pas le présenter comme un algorithme scientifique validé.
