# Les cartes des possibles

Les 50 cartes du jeu, réécrites selon [TON.md](TON.md) à partir de [50 questions cartes.pdf](50%20questions%20cartes.pdf). **Validées.**

## Ce qu'il y a dans une carte

| Champ | Ce que c'est | Qui le voit |
|---|---|---|
| **Titre** | Le thème affiché sur la carte. Court, ce n'est pas une question. | Le jeune, sur la carte |
| **Niveau** | Léger, moyen ou profond : sert au tirage des cartes. | Personne : géré par le moteur |
| **Amorce de référence** | Un exemple de première phrase pour l'IA. Elle l'adapte toujours au jeune (son registre, ce qu'il a déjà raconté). | Personne tel quel : l'IA s'en inspire |
| **Peut révéler** | Où se cachent les talents sur cette carte. L'IA s'en sert pour orienter ses relances. | Personne : jamais dit au jeune |

Il n'y a pas de cartes générées sur mesure : c'est la conversation qui va plus en profondeur, en s'adaptant aux réponses du jeune. Le **niveau** de chaque carte sert au **tirage**, selon [RULES_V2.md](RULES_V2.md).

## Les niveaux

| Niveau | Ce que la carte demande au jeune | Quand elle peut sortir | Dans le JSON |
|---|---|---|---|
| **Léger** (15 cartes) | Parler de son quotidien, de ce qui lui plaît, de ses envies. Aucun enjeu, facile même pour un jeune fermé. | Toujours. La première carte de la partie est toujours légère. Aussi pour revenir au calme après une carte difficile. | `general` |
| **Moyen** (28 cartes) | Raconter une action concrète : une réussite, un rôle, un problème réglé. Il parle de ce qu'il a fait. | Seulement après une carte où le jeune s'est bien investi. | `specific` |
| **Profond** (7 cartes) | Parler de lui : sa fierté, son image, ses valeurs, sa projection dans l'avenir. | Seulement si le jeune choisit cette carte parmi plusieurs, jamais au hasard. | `personal` |

Si le jeune répond toujours court, on reste sur des cartes légères : ce n'est pas un échec, c'est son rythme.

## Principes des amorces

- **Une invitation à raconter, pas une question d'interrogatoire** : « Raconte-moi… », « Parle-moi de… », « Dis-moi ce que… », « Décris-moi… », « Imagine… ».
- **Jamais de question fermée** : pas de « Dis-moi si… », « Tu as déjà… ? », ni de choix imposé (« plutôt X ou Y ? »).
- **Ancrée dans un moment concret** quand c'est possible (« la dernière fois que… »).
- **Courte**, pour se dire d'une traite à voix haute.
- **Variée** : l'IA ne répète pas la même formule d'une carte à l'autre.

## Passion
*Ce qui t'attire, t'amuse ou te fait perdre la notion du temps.*

| # | Titre | Niveau | Amorce de référence | Peut révéler |
|---|---|---|---|---|
| 01 | La dernière fois que t'as pas vu le temps passer | Léger | Raconte-moi la dernière fois que t'as pas vu le temps passer. | Activité qui motive, concentration |
| 02 | Ton week-end idéal | Léger | Décris-moi ton week-end idéal. | Centres d'intérêt réels, envies |
| 03 | Le sujet dont tu pourrais parler des heures | Léger | Parle-moi d'un sujet sur lequel tu pourrais parler pendant des heures. | Expertise cachée, passion |
| 04 | Une vidéo, une série ou une musique qui t'a accroché | Léger | Parle-moi de la dernière vidéo, série ou musique qui t'a vraiment accroché. | Curiosité, domaines d'intérêt |
| 05 | Ce que t'aimerais faire plus souvent | Léger | Dis-moi un truc que t'aimerais faire plus souvent dans tes journées. | Envies, motivation |
| 06 | Un truc que tu fais juste pour le plaisir | Léger | Parle-moi d'un truc que tu fais juste pour le plaisir, sans te prendre la tête sur le résultat. | Intérêts sans pression |
| 07 | Un moment où ça t'a vraiment plu de faire quelque chose | Léger | Raconte-moi un moment où ça t'a vraiment plu de faire quelque chose. | Type d'activité préférée (manuel, créatif, social…) |
| 08 | Une découverte faite par hasard | Léger | Raconte-moi un truc que t'as découvert un peu par hasard et qui t'a plu. | Ouverture, curiosité |
| 09 | Un truc qui te tente depuis longtemps | Léger | Parle-moi d'un truc qui te tente depuis longtemps. | Envies, attirances |

## Fiertés
*Les choses que tu as faites, apprises ou menées à bien.*

| # | Titre | Niveau | Amorce de référence | Peut révéler |
|---|---|---|---|---|
| 10 | Un petit truc réussi récemment | Moyen | Raconte-moi un petit truc que t'as réussi récemment. | Réussites concrètes |
| 11 | Un truc dont t'es fier en secret | Profond | Parle-moi d'un truc dont t'es fier, même si t'en parles à personne. | Fierté intérieure, exigence |
| 12 | Quelqu'un qui a compté sur toi | Moyen | Raconte-moi la dernière fois que quelqu'un a compté sur toi. | Fiabilité, responsabilité |
| 13 | Le dernier truc appris tout seul | Moyen | Raconte-moi le dernier truc que t'as appris tout seul. | Autonomie, apprendre seul |
| 14 | Un truc où t'as progressé | Moyen | Raconte-moi un truc où t'as progressé. | Progression, persévérance |
| 15 | Ce qu'on te demande souvent | Moyen | Parle-moi du truc qu'on te demande souvent de faire. | Compétence reconnue par les autres |
| 16 | Un truc que tu pensais pas pouvoir faire | Profond | Raconte-moi une fois où t'as réussi un truc que tu pensais pas pouvoir faire. | Dépassement de soi |
| 17 | Un truc que t'as aidé à organiser ou à réparer | Moyen | Raconte-moi le dernier truc que t'as aidé à organiser ou à réparer. | Organisation, compétences manuelles |
| 18 | Un truc cool sur toi | Profond | Imagine que tu rencontres quelqu'un. Dis-moi le truc cool que tu lui raconterais sur toi. | Image de soi, ce qui compte pour lui |

## Relations
*Ta façon d'être avec les autres et de contribuer à un groupe.*

| # | Titre | Niveau | Amorce de référence | Peut révéler |
|---|---|---|---|---|
| 19 | Un bon moment passé avec d'autres personnes | Léger | Raconte-moi un bon moment que t'as passé avec d'autres personnes. | Sociabilité, ce qu'il apporte à un groupe |
| 20 | La dernière fois que t'as donné un coup de main | Moyen | Raconte-moi la dernière fois que t'as donné un coup de main à quelqu'un. | Entraide, sens du service |
| 21 | Quelqu'un qui t'a parlé d'un problème | Moyen | Raconte-moi la dernière fois que quelqu'un t'a parlé d'un problème. | Écoute, conseil, résolution de problèmes |
| 22 | Un truc que t'as expliqué à quelqu'un | Moyen | Raconte-moi une fois où t'as expliqué un truc à quelqu'un. | Pédagogie, transmission |
| 23 | Ta place dans un groupe | Moyen | Raconte-moi la dernière fois que t'as fait un truc en groupe, et ce que tu faisais, toi. | Rôle dans un groupe, leadership |
| 24 | Bien s'entendre avec quelqu'un | Moyen | Dis-moi ce qui fait que tu t'entends bien avec quelqu'un. | Valeurs relationnelles |
| 25 | Ce que t'aimes faire à ta façon | Léger | Parle-moi d'un truc que t'aimes faire à ta façon, sans personne pour te dire comment. | Autonomie, méthode personnelle |
| 26 | Un truc réussi à plusieurs | Moyen | Raconte-moi un truc que vous avez réussi à plusieurs, et ce que tu faisais, toi. | Travail en équipe, rôle |

## Défis
*Les imprévus, les problèmes et la manière dont tu t'y prends.*

| # | Titre | Niveau | Amorce de référence | Peut révéler |
|---|---|---|---|---|
| 27 | Un truc qui a pas marché du premier coup | Moyen | Raconte-moi la dernière fois qu'un truc a pas marché du premier coup. | Persévérance, adaptation |
| 28 | Un problème réglé, même tout petit | Moyen | Raconte-moi un problème que t'as réussi à régler, même tout petit. | Résolution de problèmes |
| 29 | Quand tu savais pas comment faire | Moyen | Raconte-moi la dernière fois que tu savais pas comment faire un truc, et comment tu t'en es sorti. | Débrouillardise, recherche d'info |
| 30 | Quand rien s'est passé comme prévu | Moyen | Raconte-moi une fois où rien s'est passé comme prévu. | Improvisation, sang-froid |
| 31 | Quand un truc devient saoulant | Moyen | Dis-moi ce qui te fait continuer quand un truc devient saoulant à faire. | Motivation, endurance |
| 32 | Changer de façon de faire | Moyen | Raconte-moi une fois où t'as dû changer ta façon de faire parce que ça marchait pas. | Flexibilité, remise en question |
| 33 | Un défi pas gagné d'avance | Moyen | Parle-moi d'un défi qui te donne envie d'essayer, même si c'est pas gagné d'avance. | Goût du défi, prise de risque |
| 34 | Plein de trucs à faire en même temps | Moyen | Raconte-moi la dernière fois que t'avais plein de trucs à faire en même temps. | Organisation, gestion des priorités |

## Rêves
*Les envies, les idées à essayer et les pistes pour la suite.*

| # | Titre | Niveau | Amorce de référence | Peut révéler |
|---|---|---|---|---|
| 35 | Un talent que t'aimerais avoir | Léger | Parle-moi d'un talent que t'aimerais avoir. | Aspirations, attirances |
| 36 | Un métier ou une activité à explorer | Léger | Parle-moi d'un métier ou d'une activité que t'aimerais explorer. | Pistes d'orientation venant de lui |
| 37 | Une journée sans aucune limite | Léger | Imagine une journée entière pour faire ce que tu veux, sans aucune limite. Raconte-la-moi. | Envies profondes |
| 38 | Ce que t'aimerais mieux savoir faire | Moyen | Dis-moi ce que t'aimerais savoir mieux faire d'ici quelques mois. | Objectifs, envie de progresser |
| 39 | Une de tes journées dans quelques années | Profond | Imagine une de tes journées dans quelques années. Raconte-moi comment elle commence. | Projection, mode de vie souhaité |
| 40 | Un boulot où tu te sentirais bien | Moyen | Décris-moi un boulot où tu te sentirais bien. | Environnement de travail idéal |
| 41 | Un projet à réaliser un jour | Moyen | Parle-moi d'un projet, même petit, que t'aimerais réaliser un jour. | Projets, initiative |
| 42 | Un truc à essayer au moins une fois | Léger | Dis-moi un truc nouveau que t'aimerais avoir essayé au moins une fois. | Curiosité, envie d'expérimenter |

## Valeurs
*Ce qui compte pour toi dans une activité, un projet ou une équipe.*

| # | Titre | Niveau | Amorce de référence | Peut révéler |
|---|---|---|---|---|
| 43 | La dernière fois que tu t'es senti utile | Moyen | Raconte-moi la dernière fois que tu t'es senti vraiment utile. | Sens, utilité |
| 44 | Ce qui te donne envie de bien faire | Profond | Dis-moi ce qui te donne envie de bien faire un truc. | Motivation, exigence |
| 45 | Ce qui t'aide quand on te demande un truc | Moyen | Quand quelqu'un te demande de faire un truc, dis-moi ce qui t'aide à bien le faire. | Besoin de cadre ou d'autonomie |
| 46 | Un groupe où tu te sentais bien | Moyen | Raconte-moi un groupe où tu te sentais bien, au sport, en cours ou ailleurs. | Travail en équipe, ambiance recherchée |
| 47 | Un effort qui a fini par payer | Moyen | Raconte-moi un effort qui a fini par payer. | Persévérance, rapport à l'effort |
| 48 | Quelqu'un de bien | Profond | Décris-moi quelqu'un de bien, pour toi. | Valeurs, respect des autres |
| 49 | Un truc où tu t'es dit « ça, c'est moi » | Profond | Raconte-moi la dernière fois que t'as fait un truc et que tu t'es dit « ça, c'est moi ». | Identité, valeurs |
| 50 | Une journée qui valait le coup | Moyen | Raconte-moi une bonne journée, une de celles où tu te dis le soir que ça valait le coup. | Ce qui donne du sens |

## Le bas de carte

« À ton rythme. Une question à la fois. Tu peux passer, préciser ou ne rien garder. » : **conservé**. Il rappelle que le jeune garde la main.
