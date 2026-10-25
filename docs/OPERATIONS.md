# Exploitation

## État et cible

Le dépôt fournit une application Node22 et un worker, PostgreSQL16, Docker Compose et une configuration CaddyTLS. Le déploiement distant n'a pas été exécuté sans hébergement désigné. Docker n'est pas installé dans l'environnement de réalisation : fichiers Compose/Dockerfile préparés, construction conteneur non vérifiée. Le build Next local et les vérifications réellement exécutées sont consignés dans PROGRESS.md.

## Configuration production

Créer un environnement de préproduction distinct et une base dédiée avant le service réel. Créer `.env.production` permission0600 à partir de `.env.example`, puis renseigner :

- `DATABASE_URL` avec hôte `db:5432`, base/compte devscroll et mot de passe fort encodé pour uneURL.
- `BETTER_AUTH_URL=https://<domaine>` et `BETTER_AUTH_SECRET` aléatoire d'au moins32caractères.
- `OWNER_EMAIL` et `OWNER_PASSWORD` aléatoire (12caractères minimum) pour le provisionnement privé.
- IA désactivée par défaut, aucun budget ou modèle implicite. VoirAI.md pour une activation manuelle.

Le Compose lit les variables de substitution via `--env-file .env.production`. Ajouter `POSTGRES_PASSWORD` identique à celui de DATABASE_URL et `DOMAIN` au fichier. Ne pas publier PostgreSQL sur Internet. Réserver DNS et ports80/443 au reverse proxy. Le web reste lié au loopback hôte ; seul Caddy expose le service en TLS avec le profil `tls`.

```sh
docker compose --env-file .env.production -f compose.production.yaml build
docker compose --env-file .env.production -f compose.production.yaml up -d db
docker compose --env-file .env.production -f compose.production.yaml run --rm migrate
docker compose --env-file .env.production -f compose.production.yaml run --rm migrate node --import tsx scripts/owner.ts
docker compose --env-file .env.production -f compose.production.yaml --profile tls up -d web worker edge
```

Le seed de démonstration est refusé sousNODE_ENV=production. Pour charger le corpus : importer `content/posts.json` depuis l'atelier, relire et publier les brouillons ; importer aussi `content/questions.json` avec l'enveloppe `{posts:[],questions:[...]}` ou créer les questions dans l'atelier. Une importation n'est jamais une publication implicite.

La base et les volumes persistent entre redémarrages. Ne pas lancer `down -v` sur le service réel. Limiter l'accès hôte et au fichier de secrets. Pas d'inscription publique, pas de création de compte dans le navigateur. Aucun service n'est acheté par ces fichiers.

## Disponibilité et journaux

`GET /api/health` renvoie seulement une disponibilité minimale et teste la base ; aucun contenu privé ou diagnostic détaillé. Un contrôle public minimal est volontaire pour le superviseur. Les diagnostics détaillés restent réservés au propriétaire. Logs structurés par requestId/jobId, sans clés, corps privés ni prompts. Docker supervise web/worker et relance après crash. Configurer la rotation des journaux et un canal d'alerte réel sur l'hôte ; aucun message n'est présenté comme envoyé ici.

Surveiller : erreursHTTP5xx, disponibilitéPostgreSQL, jobs failed/uncertain, profondeur de file, échéances de revue éditoriale et budget réservé. Les erreurs de réseau fournisseur conservent une réserve prudente ; consulter le fournisseur avant tout nouvel appel équivalent.

## Sauvegarder et restaurer

VoirAI.md pour les scripts de dump, contrôleSHA-256 et restauration vers une base vide distincte. Programmer la sauvegarde quotidienne sur l'hôte et chiffrer les archives avant copie hors serveur, avec clé distincte et rétention7quotidiennes+4hebdomadaires. Vérifier l'envoi au stockage et son chiffrement, puis refaire une restauration en préproduction. Aucun cron ni stockage externe n'a été activé.

Exercice local réalisé : dump et restauration avec snapshot identique, comptages et références vérifiés ; détail dansPROGRESS.md. Les archives locales de développement sont privées0600, non chiffrées. ObjectifsRPO24h/RTO4h restent à confirmer en conditions de production, pas des résultats mesurés.

Après restauration, démarrer la copie avec une URL, un secret de session et des accès distincts. Désactiver l'IA et inspecter les jobs avant de démarrer le worker ; une copie restaurée ne doit pas déclencher de dépenses. Vérifier connexion, données, favori, recherche et révision avant bascule.

## Migrations et retour arrière

Les migrations SQL sont ordonnées et protégées par un verrouPostgreSQL avec checksum. Ne jamais modifier une migration déjà appliquée : en ajouter une nouvelle. Sauvegarder avant une migration risquée. Un rollback du code ne restaure pas la base ; préférer une correction en avant. Pour une reprise de données, restaurer dans une base distincte puis basculer après vérification. Ne jamais écraser la base de service à l'aveugle.

## Confidentialité et PWA

Exports utilisateur et suppression de compte dansProfil ; l'effacement conserve le corpus éditorial partagé et supprime les interactions de l'utilisateur. Les réponses de révision versionnées restent dans l'historique tant que le compte existe. Les expositions brutes ont une cible de rétention90jours ; consulter la commande de maintenance et son état dansPROGRESS.md.

Le service worker ne met aucune réponse privée ni solution en cache : navigation réseau avec page hors connexion claire. Déconnexion purge les données locales privées ; seule la préférence de thème persiste. InstallationPWA minimale avec manifeste et icônes192/512 ; essai physique sur téléphone et mesureLCP terrain à faire après déploiement. La version actuelle ne promet pas une lecture hors ligne.
