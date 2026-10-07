# D.O.R.Y PROJECT — v52 : gestion des SAUTS sur GitHub Pages

Base : dossier web structuré v51, pas le prototype Electron.
Dépôt configuré : MakoKusa/DoryProject.
Aucune écriture GitHub n'a été effectuée pour préparer cette archive.
La branche de publication n'a pas pu être vérifiée depuis l'environnement de préparation.

## Installation initiale

1. Sauvegarder le dépôt actuel.
2. Dans GitHub, consulter Settings > Pages pour identifier la source publiée.
3. Déposer les fichiers de cette archive dans ce dossier source (racine ou docs/).
4. CONSERVER le dossier photos/ actuel. Les images ne sont pas incluses.
5. Le fichier data/sauts.json fourni est vide : il sert UNIQUEMENT à la première installation.
   S'il existe déjà un fichier data/sauts.json rempli, NE PAS LE REMPLACER.
6. Attendre la réussite du déploiement GitHub Pages.
7. Ouvrir gestion-sauts.html à côté de index.html sur le site.

Ne pas supprimer les anciens fichiers avant d'avoir sauvegardé le dépôt.
Les workflows existants ne sont pas fournis ni remplacés. Si Pages publie via
Actions, vérifier que le workflow embarque aussi data/, js/, css/ et la page
gestion-sauts.html. Un workflow qui ne s'exécute pas après une modification
de data/ devra être adapté.
Le dossier source doit être la racine ou docs/ pour ce prototype.

## Jeton GitHub

Créer toi-même dans GitHub Settings > Developer settings > Personal access tokens
> Fine-grained tokens un jeton avec expiration, limité à MakoKusa/DoryProject.
Permission repository : Contents > Read and write ; Metadata est associée par GitHub.
Ne pas donner de permission Workflows : cet outil ne modifie pas les workflows.
Ne jamais envoyer ce jeton dans une conversation ni le committer.

La page de gestion n'a aucun script tiers. Le jeton est saisi à chaque nouvelle
session, immédiatement retiré du champ après connexion, conservé dans un champ
privé JavaScript en mémoire et envoyé uniquement à api.github.com.
Il n'est pas enregistré dans localStorage, sessionStorage, une URL ou un fichier.
Le bouton Déconnecter le retire de l'outil.
La sécurité dépend aussi de l'intégrité de la page et du navigateur : utiliser
un navigateur de confiance et un jeton court, limité au seul dépôt.
Ce jeton donne techniquement des droits sur les contenus du dépôt, pas seulement
sur data/ et photos/. Le formulaire limite les opérations, mais pas les droits du jeton.
Les protections de branche GitHub restent applicables : aucune écriture forcée.

## Publier une entrée

1. Saisir le jeton puis Charger les branches.
2. Choisir la branche réellement publiée. La branche par défaut n'est pas nécessairement celle de Pages.
3. Choisir racine ou docs ; vérifier la configuration Pages, puis cocher la confirmation.
4. Cliquer Vérifier la source et charger les entrées.
5. Renseigner date, titre, message, heure facultative et jusqu'à trois photos.
6. Ajouter des légendes facultatives et prévisualiser.
7. Cliquer Publier et confirmer le résumé.

La page refuse les dates du scénario d'origine et les dates déjà créées.
Elle ne permet ni modification ni suppression dans cette première version.
Les photos sont vérifiées puis décodées et réencodées en JPEG, limitées à 2048
pixels sur le plus grand côté. Les PNG transparents auront un fond blanc.
Entrée : 10 Mo par image maximum. Sortie : 5 Mo maximum. Jusqu'à 3 images.
Les images animées ne sont pas préservées comme animations.

Les photos reçoivent des noms uniques :
photos/AAAA-MM-JJ_saut-IDENTIFIANT_1.jpg (puis _2 et _3).
Le fichier JSON contient les chemins et les légendes : aucun renommage manuel.
L'outil crée les blobs, puis un seul arbre/commit regroupant photos et données,
puis met à jour la branche sans force. Il préserve les autres fichiers via base_tree.
Si quelqu'un modifie la branche pendant l'opération, la publication est refusée.
Des objets Git non rattachés à la branche peuvent subsister après un échec ;
ils ne constituent pas une entrée publiée.

Un message « ENREGISTRÉ DANS GITHUB » ne garantit pas que Pages ait déjà déployé.
Consulter le lien du commit et Actions/Pages. En cas d'erreur réseau ambiguë,
vérifier le dépôt avant de recommencer. Ne pas fermer la page pendant l'envoi.

## Comportement du jeu

Les 12 souvenirs du scénario restent dans app.js. Les nouvelles entrées sont
chargées depuis data/sauts.json au lancement, puis ajoutées à la liste par date.
Le texte est affiché comme texte échappé, pas comme HTML fourni par l'auteur.
Les photos des entrées supplémentaires sont lues depuis les chemins explicites,
les photos des souvenirs d'origine restent cherchées selon la convention v51.

Les entrées supplémentaires sont temporairement masquées pendant la prise de
contrôle de NULL, CREER et le thème NULL afin de ne pas perturber le scénario.
Elles réapparaissent quand le système retrouve son état normal.
Si une date personnalisée coïncide avec la date locale du SAUT final de l'ARG,
le SAUT final est prioritaire sur cet appareil ; les données personnalisées ne
sont pas supprimées. Le formulaire refuse cette collision quand il la connaît.

Si le JSON est absent, invalide ou inaccessible, le jeu conserve les souvenirs
d'origine et signale le problème dans la console. Recharger après le déploiement
pour voir les nouveaux souvenirs ; la requête JSON demande un chargement sans cache.
Pour un test local, utiliser un serveur HTTP (python -m http.server 8000).
Le double-clic file:// ne charge pas les entrées supplémentaires.

## Fichiers

- gestion-sauts.html : formulaire d'administration séparé de l'ARG.
- css/gestion-sauts.css : présentation terminal du formulaire.
- js/gestion-sauts.js : interface, aperçus et conversion JPEG.
- js/github-sauts.js : échanges avec l'API GitHub et publication groupée.
- js/sauts-common.js : validation commune et dates réservées.
- data/sauts.json : entrées ajoutées, à conserver lors des mises à jour.
- js/app.js : v51 avec chargement des nouvelles entrées et isolation du scénario.
- css/styles.css : inchangé par rapport au dossier v51.

## Tests

Avec Node.js installé :

    node --check js/app.js
    node --check js/gestion-sauts.js
    node tests/sauts.test.cjs
    node tests/integration.test.cjs

Ces tests sont locaux et simulés : ils ne publient rien sur GitHub.
Ils couvrent les dates, doublons, chemins, publication en un commit, encodage
Unicode, refus de conflits, déconnexion et fusion/isolation des nouvelles entrées.
Pas de test navigateur, de conversion réelle d'image ni de publication réelle
réalisés dans l'environnement de préparation.

Conserver tests/ et README.md pour le développement ; leur publication n'est pas nécessaire.
Ne jamais remplacer data/sauts.json rempli lors d'une livraison ultérieure.
