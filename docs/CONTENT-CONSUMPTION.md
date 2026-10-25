# Lot de 100 posts : consommation mesurée

Mesure réelle du 2026-10-25T10:21:33.568Z. 100 nouveaux posts et 100 QCM ; corpus total de 130 posts avec un visuel chacun.

| Ressource                                    | Mesure              |
| -------------------------------------------- | ------------------- |
| JSON des 100 posts                           | 224.8 Kio           |
| Même JSON compressé gzip                     | 47.6 Kio            |
| Même JSON compressé Brotli                   | 39.5 Kio            |
| JSON des 100 QCM                             | 44.1 Kio            |
| Visuels uniques : 24 SVG                     | 44.4 Kio            |
| SVG compressés séparément avec gzip, total   | 21.8 Kio            |
| Variation physique PostgreSQL observée       | 3080.0 Kio          |
| Variation tables de contenu + index + audit  | 3080.0 Kio          |
| Variation données JSON stockées des versions | 228.2 Kio           |
| Appels API de génération de l’application    | 0                   |
| Tokens API de l’application                  | 0 entrée / 0 sortie |
| Coût API de génération texte/images          | 0 USD               |
| Tokens/coût de cette conversation            | Non accessibles     |

Les textes ont été rédigés dans cette conversation. Les visuels utilisent des tracés de logos Simple Icons et des stickers SVG locaux ; aucun appel payant de génération d’image. Les consommations de la conversation ne sont pas incluses dans « 0 USD API » et ne sont pas mesurables ici. Il ne s’agit donc pas d’un benchmark du prix d’un fournisseur IA.

Les 24 fichiers sont partagés entre les posts, dont 23 utilisés par les nouveaux. URLs avec empreinte, cache public long, dimensions réservées, chargement paresseux. Le poids unique n’est pas multiplié par cent ; un navigateur ayant déjà chargé un visuel peut le réutiliser. gzip/Brotli désignent des mesures locales de compression, sans promettre le même transfert sur tous les hébergeurs.

L’import préserve les posts et réponses existants. Les visuels des 30 premiers posts passent par de nouvelles versions éditoriales ; un brouillon en cours est conservé. Le delta PostgreSQL inclut ces versions, les index et l’audit, et peut varier selon la réutilisation des pages libres. Le fichier de preuve détaillé est [expansion-100.usage.json](../content/batches/expansion-100.usage.json).

Commandes : `npm run content:build`, `npm run content:import`, puis une seconde importation pour vérifier zéro ajout. La première mesure reste conservée pour ne pas remplacer le coût initial par celui d’un import vide.
