# Mazbar : caisse de boissons, version Netlify + terminal SumUp Solo

Caisse de boissons pour tablette Android. Le montant de la commande est envoyé **automatiquement** au terminal **SumUp Solo** (API Cloud de SumUp) : plus aucune ressaisie. Dès que le client a payé, la caisse enregistre la commande toute seule.

```
caisse-netlify/
├── public/                    ← la caisse (page web installable sur la tablette)
│   ├── index.html             (le logo du club y est intégré)
│   ├── manifest.webmanifest, sw.js, icon-*.png (icônes = logo du club)
├── netlify/functions/sumup.js ← le petit serveur qui parle à SumUp (garde vos clés secrètes)
├── netlify.toml               ← configuration Netlify
└── .env.example               ← liste des variables à renseigner
```

## Comment ça marche

```
Tablette (caisse)  ──►  Fonction Netlify  ──►  API Cloud SumUp  ──►  Solo
   montant + code        (vos clés ici)                                 │
   ◄── résultat, vérifié toutes les 1,5 s ◄──────────────────────────────┘
```

Les clés SumUp ne quittent jamais Netlify. La tablette ne connaît qu'un **code d'accès** que vous choisissez : sans lui, la fonction refuse toute demande.

## Ce qu'il vous faut

- Un terminal **SumUp Solo** (pas le Solo Lite, qui exige un téléphone) et un compte marchand SumUp actif.
- Un compte **Netlify** (gratuit pour commencer) et un compte **GitHub**, ou un ordinateur avec Node.js pour la méthode en ligne de commande.
- Une tablette Android avec Chrome, connectée à internet.
- Le Solo doit rester **branché** pendant le service (recommandation de SumUp pour l'API Cloud). Le Solo doit avoir un logiciel à jour : la création de paiement exige la version 3.3.24.3 ou plus, et l'indicateur de batterie la version 3.3.39.0 ou plus.

**Pour essayer sans matériel** : SumUp propose un « Virtual Solo » (virtual-solo.sumup.com) à utiliser avec un compte marchand de test (*sandbox*). Vous pouvez valider tout le parcours avant d'acheter.

---

## Étape 1 : récupérer vos identifiants SumUp

Sur le site développeur de SumUp (developer.sumup.com), connecté à votre compte :

1. **Clé API** : créez-en une dans le tableau de bord développeur. Elle ressemble à `sup_sk_…`. Gardez-la secrète.
2. **Clé d'affiliation** (*Affiliate Key*) : créez-la sur la page developer.sumup.com/affiliate-keys, en indiquant un **identifiant d'application** de votre choix, par exemple `com.monasso.caisse`. SumUp l'exige pour chaque paiement envoyé au Solo.
3. **Code marchand** : l'identifiant de votre compte SumUp (de la forme `MK10CL2A`).

Notez ces quatre valeurs : clé API, clé d'affiliation, identifiant d'application, code marchand.

## Étape 2 : mettre la caisse en ligne sur Netlify

> ⚠️ Le « glisser-déposer » de Netlify Drop **ne déploie pas les fonctions** : la caisse s'afficherait, mais le paiement ne fonctionnerait pas. Utilisez l'une des deux méthodes ci-dessous.

### Méthode A : GitHub (recommandée)

1. Créez un dépôt **privé** sur GitHub et envoyez-y le contenu de ce dossier.
2. Sur Netlify : *Add new project* → *Import an existing project* → choisissez le dépôt. Laissez la commande de build vide. Le dossier de publication et celui des fonctions sont déjà indiqués dans `netlify.toml`.
3. Passez à la section « Variables d'environnement » ci-dessous.

### Méthode B : ligne de commande

Avec Node.js installé sur votre ordinateur, dans ce dossier :

```
npx netlify-cli login
npx netlify-cli init
npx netlify-cli deploy --prod
```

### Variables d'environnement

Dans Netlify : *Site configuration → Environment variables*, ajoutez :

| Variable | Valeur |
|---|---|
| `CAISSE_TOKEN` | un code d'accès de votre choix (12 caractères ou plus) |
| `SUMUP_API_KEY` | votre clé API SumUp |
| `SUMUP_MERCHANT_CODE` | votre code marchand |
| `SUMUP_AFFILIATE_KEY` | votre clé d'affiliation |
| `SUMUP_APP_ID` | l'identifiant d'application choisi à l'étape 1 |
| `SUMUP_READER_ID` *(facultatif)* | l'identifiant du Solo, s'il y en a plusieurs |
| `MAX_AMOUNT_CENTS` *(facultatif)* | montant maximum par commande, en centimes (défaut : 100000 = 1 000 €) |

**Redéployez ensuite le site** : les variables ne sont prises en compte qu'au déploiement suivant.

## Étape 3 : installer la caisse sur la tablette

1. Ouvrez l'adresse Netlify de votre site dans **Chrome**.
2. Menu ⋮ → *Installer l'application* (ou *Ajouter à l'écran d'accueil*).
3. Ouvrez la caisse installée : elle se lance directement **en plein écran**, sans barre du haut. Le bouton « Plein écran » permet aussi de basculer à la main (il devient « Quitter le plein écran »).
   - Si vous aviez déjà installé une version précédente, **désinstallez-la puis réinstallez-la** : Android ne met pas toujours à jour le mode d'affichage d'une application déjà installée.
   - Dans l'aperçu intégré de claude.ai, le plein écran est bloqué par le navigateur : utilisez la version installée.
   - En plein écran, le **bandeau du haut de la caisse** (logo, Admin, Réglages…) se replie pour laisser plus de place aux boissons. Touchez la **petite barre grise en haut au centre** pour le rouvrir 8 secondes. Le numéro de commande reste visible à côté de « Commande ».
   - **En cas de doute sur le mode d'affichage**, ouvrez *Réglages* : la ligne « Affichage » indique si la caisse tourne dans un onglet Chrome, en application installée, en plein écran ou dans une vue intégrée (où le plein écran est impossible).

## Étape 4 : appairer le Solo (une seule fois)

1. Sur la caisse : **Réglages** → saisissez le **code d'accès** (`CAISSE_TOKEN`) et le nom de la caisse → *Enregistrer*.
2. Sur le Solo : allumez-le et connectez-le au Wi-Fi (*Connections → Wi-Fi*).
3. **Déconnectez-le de votre compte** si besoin : menu du haut → *Settings → About → Log out*. L'appairage n'est possible que Solo déconnecté.
4. Sur le Solo : menu du haut → *Connections → API → Connect*. Un **code de 8 ou 9 caractères** s'affiche (valable 5 minutes).
5. Sur la caisse : *Réglages* → collez ce code dans « Appairer un Solo » → *Appairer*. Une confirmation s'affiche brièvement sur le Solo.
6. Touchez **Tester la connexion** : vous devez voir « Solo … en ligne ». Le haut de l'écran de la caisse affiche ensuite en permanence l'état du Solo et sa batterie.

## Étape 5 : premier essai

Faites un vrai paiement de **1 €** (ou un essai avec le Virtual Solo) :

1. Ajoutez une boisson, touchez *Payer* puis *Carte (SumUp Solo)*.
2. Le montant apparaît sur le Solo. Passez la carte.
3. La caisse affiche « Paiement accepté » et la commande apparaît dans **Admin**.
4. Refaites un essai en refusant le paiement, puis un essai avec *Annuler le paiement*, pour voir les messages.

---

## Utilisation au quotidien

- **Carte** : le client paie sur le Solo, la caisse se met à jour seule. La référence du paiement est enregistrée avec la commande et figure dans l'export.
- **Espèces** : inchangé (saisie du montant reçu, monnaie à rendre).
- **Paiement bloqué** : si rien ne se passe pendant 45 secondes, deux boutons apparaissent. *Valider à la main* sert si le paiement est **accepté sur l'écran du Solo** mais que la caisse ne réagit pas (la commande est alors marquée « manuel »). *Abandonner* libère la caisse.
- **Page rechargée pendant un paiement** : la caisse retrouve le paiement en cours et le termine, sans le refaire.
- **Pointage de fin de journée** : dans Admin, comparez le total carte de la caisse avec celui de l'application ou du tableau de bord SumUp.
- **Remboursements** : à faire depuis SumUp (l'application de caisse ne rembourse pas).

## Mettre à jour la caisse

1. Remplacez les fichiers du projet par ceux de la nouvelle archive (GitHub : « Upload files » puis « Commit » ; ou ligne de commande : `npx netlify-cli deploy --prod`). Ne changez pas le nom du site : les données de la tablette sont liées à son adresse.
2. Vos clés SumUp et votre code d'accès restent dans Netlify : rien à ressaisir.
3. Sur la tablette, fermez complètement la caisse puis rouvrez-la avec internet.
4. Vérifiez le **numéro de version** : *Réglages* → en bas du formulaire, « Version x.y.z (date) ».
5. Réinstallez l'application seulement si la mise à jour change l'icône ou le plein écran.

Avant une grosse mise à jour, exportez le CSV des commandes (Admin) : c'est votre sauvegarde. Pour le développeur : incrémentez `APP_VERSION` dans `public/index.html` et le nom du cache dans `public/sw.js` à chaque version.

## Sécurité : ce qu'il faut savoir

- Les clés SumUp ne sont stockées que dans les variables Netlify. Ne les écrivez jamais dans le code ni dans GitHub.
- Le **code d'accès** protège la fonction de paiement. Changez-le (variable `CAISSE_TOKEN`, puis ressaisie sur chaque tablette) si une tablette est perdue ou si une personne quitte l'équipe.
- Le **code administrateur** de l'espace Admin est vérifié sur la tablette : il évite les fausses manœuvres, mais ne protège pas contre quelqu'un qui aurait la tablette en main.
- Gardez l'adresse du site privée. Le paiement exige le code d'accès, mais la page de caisse elle-même reste visible par quiconque connaît l'adresse.
- `MAX_AMOUNT_CENTS` plafonne le montant d'une commande : utile contre une erreur de saisie.

## Limites actuelles

- **Les données restent sur chaque tablette** (commandes, catalogue, pointages). Plusieurs tablettes ne se synchronisent pas et vider les données de Chrome efface l'historique : **exportez le CSV chaque soir** (Admin).
- **Un seul paiement à la fois par Solo.** Après l'envoi du montant, SumUp laisse 60 secondes pour démarrer le paiement et refuse toute autre demande pendant ce temps.
- **Pas de pourboire ni de paiement en plusieurs fois** depuis la caisse.
- **Plusieurs Solo** : la caisse en choisit un seul (le premier appairé, ou celui de `SUMUP_READER_ID`).

## Dépannage

| Message | Cause probable |
|---|---|
| « Code d'accès refusé » | Le code saisi dans Réglages ne correspond pas à `CAISSE_TOKEN` (ou la variable n'est pas définie / pas redéployée). |
| « Configuration serveur incomplète : la variable … est manquante » | Variable d'environnement oubliée dans Netlify, ou site non redéployé après l'ajout. |
| « SumUp a refusé la clé API » | Clé API fausse ou révoquée. |
| « Aucun Solo appairé » | Faire l'étape 4. |
| « Le Solo est hors ligne » | Solo éteint, sans réseau, ou débranché trop longtemps. Vérifiez Wi-Fi ou 4G sur le Solo. |
| « Le Solo est occupé » | Un paiement précédent est encore en cours (jusqu'à 60 secondes). |
| « Pas de connexion internet » | La tablette n'a plus de réseau. |
| Erreur 404 sur `/.netlify/functions/sumup` | Les fonctions n'ont pas été déployées (glisser-déposer utilisé). Voir étape 2. |

Test local (facultatif) : copiez `.env.example` en `.env`, renseignez-le, puis lancez `npx netlify-cli dev`.
