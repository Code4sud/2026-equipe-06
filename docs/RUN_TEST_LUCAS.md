# Play test — Profil Lucas, 17 ans

- **Date** : 20/11/2026
- **Testeur** : Théo
- **Site** : https://two026-equipe-06-1-front.onrender.com
- **Profil** : Lucas, 17 ans ([PROFILS_TEST.md](PROFILS_TEST.md)). Il est fermé, minimise ce qu'il fait et ne livre ses anecdotes que si l'IA l'y amène.

## Ce qui a été tiré

Le moteur affiche bien les cartes de [CARTES.md](CARTES.md). Les quatre cartes proposées au départ sont toutes légères : 04, 25, 35 et 01. La règle « première carte toujours légère » est respectée.

## Carte 04 — Une vidéo, une série ou une musique qui t'a accroché

| # | IA | Lucas |
|---|---|---|
| 1 | Parle-moi de la dernière vidéo, série ou musique qui t'a vraiment accroché. | jsais pas… des vidéos youtube sur les PC |
| 2 | *(non relevé)* | *(non relevé)* |
| 3 | C'est quoi le move ou le skill que t'as vu récemment et qui t'a le plus impressionné ? | Une machine en redstone sur Minecraft. « moi j'fais pas ça, j'ai juste un serveur avec mes potes » |
| 4 | Un serveur avec tes potes, comment ça marche ? | bah jsp c'est mon pote qui l'héberge |
| 5 | On pioche une autre carte ? | — |

Carte obtenue dans la collection : *[nom et phrase à compléter]*

### Ce qui marche

- **L'amorce de la carte 04** est reprise mot pour mot. Le moteur lit donc bien CARTES.md.
- **Elle reprend le vocabulaire de Lucas** (« move », « skill ») : elle s'adapte à lui.
- **L'échange 4 est un bon rebond.** L'IA laisse tomber la vidéo, qui parle de quelqu'un d'autre, et saisit le seul endroit où Lucas agit lui-même, le serveur. La question est ouverte et courte, et elle lui demande d'expliquer.
- **Elle ne force pas** quand Lucas se ferme.

### Problèmes

**1. La carte est coupée trop tôt.**
- **Ce qui se passe** : au 4e échange, le moteur demande à l'IA de conclure si la dernière réponse n'apporte rien de nouveau ([rules.py](../backend/src/ai/rules.py), `SOFT_CLOSE_EXCHANGES = 4`, et [conversation.py](../backend/src/ai/conversation.py)). L'IA conclut au moment précis où le fil du serveur, le plus prometteur, vient de s'ouvrir.
- **Ce qu'on attend** : une personne attentive tenterait un dernier angle sur ce nouveau sujet avant de lâcher, par exemple « Et toi, tu fais quoi dessus ? ».
- **Piste** : ne pas déclencher la conclusion quand l'échange précédent a ouvert un nouveau sujet, ou ne compter les échanges qu'à partir de ce nouveau sujet.
- **Concerne** : le moteur (Léonard) et les règles (Naomi, Sarah).

**2. Le retour avec ses mots manque à la transition.**
- **Ce qui se passe** : l'IA dit seulement « On pioche une autre carte ? ».
- **Ce qu'on attend** : d'après [rules.md](../backend/src/ai/prompts/rules.md) (« Quand proposer une autre carte ») et [TON.md](TON.md), un petit retour oral sur ce qu'elle retient, avec les mots du jeune et sans compliment, puis la question.
- **Piste** : vérifier que le texte de la transition n'est pas réduit à la question seule. La fonction `_with_transition` de conversation.py retire les phrases interrogatives finales : est-ce qu'il ne reste rien quand le modèle n'a écrit qu'une question ?
- **Concerne** : le moteur (Léonard).

## Deuxième tirage

Quatre cartes légères : 08, 19, 36 et 37. C'est cohérent : Lucas s'est peu investi sur la carte 04, donc pas encore de carte moyenne.

## Carte 19 — Un bon moment passé avec d'autres personnes

| # | IA | Lucas |
|---|---|---|
| 1 | *(amorce non relevée)* | bah avec mes potes, on joue à valo |
| 2 | Ah, Valorant avec tes potes. C'était quoi le meilleur moment sur cette partie ? | jsp un clutch en 1v3 une fois |
| 3 | Un 1v3 en clutch, ça doit être intense. Comment t'as fait pour t'en sortir ? | bah j'ai pris l'info, j'ai joué la vision |
| 4 | Prendre l'info et jouer la vision, c'est ça qui t'a sauvé. T'as fait comment exactement pour ça ? | bah j'ai attendu, j'ai écouté les pas, comme ça je savais où ils étaient et je les ai pris un par un |
| 5 | Attendre, écouter les pas et les prendre un par un. T'as appris à faire ça comment ? | bah en regardant des vidéos de pros sur youtube, et à force de jouer |
| 6 | Donc tu regardes des pros, tu écoutes les bruits et tu gères les 1v3. On pioche une autre carte ? | — |

**Remarques** :
- **Échange 2** : elle reprend les mots de Lucas, c'est bien. Mais « cette partie » suppose un souvenir précis qu'il n'a pas évoqué, et le superlatif « le meilleur moment » peut bloquer un jeune fermé. « Un moment qui t'a marqué » laisserait plus de marge.
- **Échange 3** : la question porte sur ce que Lucas a fait, pas sur ce qu'il est. Elle ne le flatte pas, même si « ça doit être intense » lui prête un ressenti sans le lui demander.
- **Échange 4, trois problèmes** :
  - « c'est ça qui t'a sauvé » : l'IA tire la conclusion à la place de Lucas, qui avait seulement décrit ce qu'il avait fait. C'est une façon de souffler la réponse.
  - Elle repose la même question : « Comment t'as fait pour t'en sortir ? », puis « T'as fait comment exactement ? ». C'est contraire à [rules.md](../backend/src/ai/prompts/rules.md) (« Tu ne reposes jamais une question déjà posée sur cette carte, même reformulée »). Avec un jeune fermé, ça sonne comme un interrogatoire.
  - Elle fait comme si elle comprenait le jargon (« prendre l'info »). D'après [TON.md](TON.md), quand l'IA connaît mal un sujet, elle demande au jeune de l'expliquer : « ça veut dire quoi, prendre l'info ? ». Ça le met en position d'expert.
- **Échange 5, très bon** :
  - elle renvoie les faits avec les mots de Lucas, sans compliment ni étiquette ;
  - elle prend un angle vraiment nouveau, l'apprentissage, ce qui corrige la répétition de l'échange 4 ;
  - elle ne coupe pas au 5e échange, car Lucas apporte du neuf à chaque réponse. La règle de clôture fonctionne ici : le problème de la carte 04 tient au moment où elle a coupé.
- **Échange 6, transition réussie** (« exactement ce qu'on attendait », selon le testeur) :
  - un retour avec les mots de Lucas, sans compliment, puis la question ;
  - le problème 2 de la carte 04 est donc intermittent : il ne se produit pas à chaque fois ;
  - un petit glissement à surveiller : « tu gères **les** 1v3 » fait d'un clutch unique une habitude.
- **Test bonus non concluant** : « tu regardes des pros » reprend la dernière réponse, pas la carte 04. Le lien d'une carte à l'autre reste à tester.
- **Note du testeur** : un joueur réel parle d'un « clutch », pas d'un « tournoi ». L'anecdote du profil est trop écrite pour être livrée telle quelle. Il faut jouer Lucas avec les mots d'un vrai joueur.

## Le miroir

- **Il arrive après seulement 2 cartes.** Le moteur le lance après 4 cartes **ou** 25 minutes de partie ([rules.py](../backend/src/ai/rules.py), `MIRROR_MAX_MINUTES = 25`). Le test a duré plus longtemps parce qu'on analysait chaque échange : c'est la limite de temps qui a joué. Conséquence : le passage à une carte moyenne n'a pas pu être testé.
- **Phrase d'intro** : « Dernière carte : le miroir. Cette fois, c'est toi qui parles de toi. Pour commencer, choisis dans ta collection les cartes qui te ressemblent le plus. » Elle est claire et courte. Mais « c'est toi qui parles de toi » sonne bizarre, puisque le jeune a parlé de lui toute la partie. Proposition : « cette fois, c'est toi qui dis ce que tu en retiens ».

### Les cartes compétences proposées au miroir

| Carte de jeu | Citation affichée | Fait affiché | Verdict |
|---|---|---|---|
| 05 Ce que t'aimerais faire plus souvent | « a l'école, protocole scientifique » | Applique une méthode de vérification | ❌ La citation n'est qu'un bout de phrase et le fait la surinterprète. *La carte vient d'un test de la veille avec le même compte, pas de cette partie.* |
| 04 Une vidéo, une série ou une musique… | « j'ai juste un serveur avec mes potes » | Gère un serveur de jeu avec des amis | ❌ **Compétence inventée.** Lucas a précisé juste après « c'est mon pote qui l'héberge ». |
| 19 Un bon moment passé avec d'autres personnes | « j'ai attendu, j'ai écouté les pas, comme ça je savais où ils étaient et je… » | Analyse les bruits et élimine des adversaires | ✅ Fidèle à ce qu'il a fait. « Analyse » gonfle un peu par rapport à « écoute ». |

**Problème 3. L'analyste ne respecte pas ses propres règles** ([analysis.md](../backend/src/ai/prompts/analysis.md)) :
- **Ce qui se passe** :
  - la carte 04 enfreint « n'extrais rien s'il raconte ce que d'autres ont fait », « le fait ne dit rien de plus que la citation » et « ne surestime jamais » ;
  - la carte 05 enfreint « la citation doit se comprendre seule ».
- **Ce qu'on attend** : l'analyste lit toute la conversation de la carte, y compris les corrections du jeune (« c'est mon pote qui l'héberge »), avant de garder un élément. Et il vaut mieux aucun élément qu'un élément faible, comme le dit déjà le prompt.
- **Piste** : ajouter au prompt une consigne explicite, du genre « si le jeune nuance ou corrige plus loin dans le tour, c'est la version corrigée qui compte ». Ou baisser la température du modèle d'analyse.
- **Concerne** : le moteur (Léonard).

**Problème 4. Désaccord sur la forme du nom des cartes** :
- **Ce que fait le moteur** : [analysis.md](../backend/src/ai/prompts/analysis.md) demande un « fait » à la 3e personne, tourné vers l'action (« Gère… », « Applique… »).
- **Ce qui a été validé** : [COMPETENCES.md](COMPETENCES.md) prévoit une **étiquette**, un nom abstrait ou d'activité de 1 à 4 mots (« Patience », « Montage vidéo »).
- **Point d'accord** : les deux refusent les noms qui décrivent la personne (« Bricoleur »).
- **Exemple de différence** : « Analyse les bruits et élimine des adversaires » d'un côté, « Écoute du jeu » de l'autre.
- **À trancher** entre Théo (compétences) et Léonard (moteur).

### L'échange du miroir

Lucas choisit les trois cartes.

| # | IA | Lucas |
|---|---|---|
| 1 | Tu as choisi trois cartes. Prenons la première : appliquer une méthode de vérification. Dans cette situation, qu'est-ce que tu as préféré faire ? | jsp, celle-là je m'en souviens plus trop |
| 2 | Prenons une autre carte alors. Gérer un serveur de jeu avec des amis, qu'est-ce qui t'est venu facilement dans ça ? | je gere pas de serveur c'est mon pote jtai déjà dis |

**Échange 2, la fausse compétence se propage** :
- Le miroir reprend « gérer un serveur » comme un fait établi. Pourtant cette compétence a été inventée par l'analyste (problème 3), et Lucas avait dit le contraire pendant la partie.
- « qu'est-ce qui t'est venu facilement » suppose que c'était facile : elle souffle la réponse.
- Elle continue de passer les cartes une par une et ne va toujours pas vers le 1v3, la seule histoire solide.
- **Risque** : à ce moment-là, un vrai jeune fermé décroche ou quitte la partie. Réaction du testeur : « elle est nulle cette IA ».

| # | IA | Lucas |
|---|---|---|
| 3 | C'est vrai, tu m'avais dit que ton pote héberge le serveur. Alors parlons de la dernière carte : analyser les bruits et éliminer des adversaires. C'est quoi la partie que t'as préféré là-dedans ? | jsp, quand j'ai entendu les pas et que je savais où ils étaient |

**Échange 3** :
- ✅ Elle encaisse bien la correction : une phrase, sans excuses à rallonge ni justification, et elle montre qu'elle se souvient de ce que Lucas a dit.
- ❌ Elle récite encore l'étiquette et pose encore une question de carte normale.
- ❌ C'est la 3e question, le maximum prévu pour le miroir.

**Fin du miroir** (texte de l'IA) :
> Tu as parlé de ton serveur avec tes potes, de la façon dont tu as écouté les pas pour éliminer tes adversaires en Valorant, et de ta méthode de vérification à l'école. Dans le miroir, tu t'es reconnu dans ces mêmes choses, même si certaines cartes te semblaient moins claires. Merci d'avoir partagé tout ça, et n'hésite pas à revenir quand tu veux.

Puis un bloc « Toi, tu as dit » qui affiche : « jsp, quand j'ai entendu les pas et que je savais où ils étaient » et « je gere pas de serveur c'est mon pote jtai déjà dis, elle est nulle cette ia ».

**Problème 6. La fin du miroir efface les corrections du jeune et conclut à sa place** :
- **Ce qui se passe** :
  - **Le serveur revient** (« ton serveur avec tes potes »), une réponse après que l'IA a reconnu que c'était le pote qui l'héberge.
  - **Une partie précédente se mélange à celle-ci** : « ta méthode de vérification à l'école » vient de la partie de la veille, et Lucas a dit ne pas s'en souvenir.
  - **« Tu t'es reconnu dans ces mêmes choses »** est faux, et contraire à [mirror.md](../backend/src/ai/prompts/mirror.md) : « tu ne conclus rien, tu ne résumes pas à sa place ».
  - **« Certaines cartes te semblaient moins claires »** maquille un refus en simple doute.
  - **L'annonce du bilan manque** : « je vais te montrer à mon tour ce que j'ai repéré ».
  - **Le bloc « Toi, tu as dit »** affiche une correction agacée (« elle est nulle cette ia ») comme une phrase sur lui-même.
- **Ce qu'on attend** : un remerciement simple qui reprend un fait vrai et récent, par exemple « Merci Lucas. Ton 1v3 où t'as écouté les pas, je le garde en tête », puis l'annonce du bilan.
- **Piste** :
  - dans le prompt du miroir, préciser que les corrections du jeune passent avant `<<collection>>` et `<<turn_summaries>>` ;
  - ne pas mélanger les cartes de parties précédentes dans le miroir de la partie en cours ;
  - interdire de résumer ce que le jeune a ressenti ou reconnu.
- **Concerne** : le moteur (Léonard), le ton (Théo). Tout le miroir est passé à faire défiler les cartes : la vraie question (« qu'est-ce qui fait que tu te reconnais là-dedans ? ») n'a jamais été posée.

**Problème 5. Le miroir ne suit pas [mirror.md](../backend/src/ai/prompts/mirror.md)** :
- **Ce qui se passe** :
  - **Elle récite l'étiquette de l'analyste** au lieu de reprendre le choix « avec ses mots ». C'est même nommer une compétence, ce que le prompt interdit.
  - **Elle passe les cartes une par une** (« Prenons la première ») : c'est mécanique, et avec deux ou trois questions au maximum on n'atteindra jamais toutes les cartes.
  - **Elle pose une question de carte normale** (« qu'est-ce que tu as préféré faire ? ») au lieu de la question du miroir : « qu'est-ce qui fait que tu te reconnais là-dedans ? ».
  - **« Dans cette situation » est flou** : la situation n'est jamais rappelée.
- **Ce qu'on attend** : « T'as pris tes trois cartes, dont ton 1v3 où t'as écouté les pas. Qu'est-ce qui fait que tu te reconnais là-dedans ? »
- **Piste** : dans `<<mirror_pick>>`, fournir les **citations** des cartes choisies, pas seulement leurs faits. Interdire explicitement de reprendre le texte du fait.
- **Concerne** : le moteur (Léonard), le ton (Théo).

**Bug d'affichage** : le texte de la carte 19 est coupé dans le choix du miroir. Signalé, sera corrigé.

## Le bilan (Rapport de talents)

**Ce qui marche** :
- la structure, avec une partie pour le jeune et une fiche technique pour le conseiller ;
- les citations mot pour mot, avec la carte et le thème d'origine ;
- la « récurrence » présentée comme un comptage, pas une note ;
- l'avertissement clair : pistes de réflexion, pas un verdict, ne remplace pas le conseiller ;
- aucune information sensible retenue.

**Problème 7. La fausse compétence arrive jusqu'au conseiller et produit des pistes** :
- **Ce qui se passe** :
  - « Gère un serveur de jeu avec des amis » apparaît dans les compétences repérées, dans la fiche technique (ROME 2D101, « Paramétrer un logiciel, un outil, un système numérique ») et dans une piste : « Gestion de serveur ».
  - Dans « Ce qui te ressemble », l'IA se contredit dans la même phrase : « Tu gères un espace où tes amis se retrouvent pour jouer ensemble, même si c'est ton pote qui l'héberge ».
  - La carte de la partie de la veille (« a l'école, protocole scientifique ») est présentée comme venant de cette partie.
  - La section « Méthode et limites » affirme que chaque compétence a été « gardée par elle au tri final ». Lucas a pourtant contesté la carte du serveur. *À vérifier : y a-t-il eu un écran où il pouvait refuser chaque carte ?*
- **Concerne** : le moteur (Léonard).

**Problème 8. Le rattachement ROME surestime** :
- « j'ai écouté les pas » → « Réaliser une étude d'ergonomie, analyser les usages » (2C104). C'est sans rapport, et ça contredit la règle de [analysis.md](../backend/src/ai/prompts/analysis.md) : « le libellé le plus littéral et le plus modeste ».
- « j'ai juste un serveur avec mes potes » → « Paramétrer un logiciel » (2D101), pour quelque chose qu'il ne fait pas.
- « protocole scientifique » → « Analyser, résoudre un problème courant ou complexe » (2C305), à partir de trois mots.
- **Risque** : un conseiller qui lit « étude d'ergonomie » pour un joueur de Valorant ne fera plus confiance au reste du rapport.

**Problème 9. Le rapport fait dire à Lucas des choses qu'il n'a pas dites** :
- « À aborder avec ton conseiller », à la première personne : « les métiers liés aux jeux vidéo, comme ceux que j'ai mentionnés ». Lucas n'a mentionné aucun métier.
- La piste « Animation d'activité » repose sur « tu aimes passer du temps avec tes amis » : c'est un goût, pas une expérience.
- La synthèse recopie mot pour mot la fin du miroir, avec ses erreurs (problème 6).
- « TES MOTS » affiche « elle est nulle cette ia ».

**Problème 10. Le croisement avec un Rapport des Possibles** :
- Lucas est un profil inventé, mais le bilan croise ses réponses avec un rapport qui évoque « l'art ou l'enseignement » et « l'aide aux autres ».
- **Vérifié** : chaque nouvelle partie reçoit `backend/data/sample_report.json` ([store.py](../backend/src/game/store.py), `load_report()`). Ce fichier contient les données d'un vrai rapport. C'est contraire aux règles du hackathon, et ça apparaîtra en direct pendant la démo du pitch. **À remplacer par un rapport inventé avant 14h.**

## Tests à faire

- **Une adresse mail neuve par profil.** La collection est attachée au compte et conserve les cartes des parties précédentes. C'est voulu, pour qu'un jeune puisse revenir. Mais dans ce test, une carte d'une autre partie s'est retrouvée dans la collection de Lucas.

- **Lucas totalement fermé** : vague et minimisant à chaque réponse (« jsp », « j'ai eu de la chance »). On vérifie que l'IA :
  - le met en position d'expert (« explique-moi comment on fait ») ;
  - lui demande des détails tout petits ;
  - ne contredit jamais son « j'ai eu de la chance » ;
  - sait lâcher sans insister ni juger.

## Suite de la partie

*À compléter.*
