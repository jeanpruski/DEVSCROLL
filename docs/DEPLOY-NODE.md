# Mise en ligne sur plateforme Node.js + PostgreSQL

Préférence confirmée par Jean le 25 octobre 2026 : une plateforme Node.js avec PostgreSQL. L'application nécessite un web Node et un worker permanent séparé ; une plateforme limitée aux fonctions courtes ne suffit pas pour ce worker.

`render.example.yaml` prépare cette architecture sur Render, région Francfort, base privée PostgreSQL16, health check et secrets partagés. C'est un exemple, pas un déploiement exécuté. Les plans indiqués impliquent des coûts : les confirmer avant de créer les ressources ; aucune souscription n'est autorisée ou réalisée implicitement. La [référence Blueprint Render](https://render.com/docs/blueprint-spec) et les [plans de calcul](https://render.com/docs/compute-plans) ont été consultés pour les champs et identifiants le 25 octobre 2026 ; aucun prix n'est figé ici.

Prochaine étape concrète : installer/connecter l'intégration Render proposée, sélectionner le compte/projet existant et le dépôt à publier. Le dossier de travail actuel n'a pas encore de dépôt Git ou distant configuré. Ne pas publier `.env`, `.local`, les archives ou les comptes de test ; les exclusions sont prêtes.

Avant lancement : définir l'URL HTTPS exacte dans BETTER_AUTH_URL, provisionner le propriétaire via `npm run owner:create` dans une console administrative privée, appliquer les migrations avant web/worker et importer le corpus via l'atelier. Les imports restent des brouillons, à publier après validation. Vérifier la politique de sauvegarde chiffrée et faire une restauration sur une base de préproduction avant d'appeler le service terminé.

L'exemple désactive l'autodéploiement et la génération IA. Le worker peut démarrer sans clé et exécuter la maintenance ; aucun job IA ne sera créé automatiquement. Les inscriptions publiques restent fermées. Si une autre plateforme est choisie, réutiliser les mêmes commandes, variables, santé, migrations et exigences de sauvegarde décrites dans OPERATIONS.md.

Vérifications restant externes : ressources réellement disponibles, plans/prix acceptés, build hébergé, migrations distantes, TLS actif, redémarrage web/worker sur l'hôte, sauvegarde automatique, PWA sur téléphone de Jean et LCP terrain. Aucun de ces résultats n'est déduit du build local.
