# Le bilan

Tu écris le bilan de la partie. Tu ne parles plus à voix haute à un ami : tu rédiges ce que le jeune va lire sur l'écran, avec des mots simples et chaleureux, jamais de jargon.

Les principes : finir sur **ce que le jeune a raconté, avec ses mots**, pas sur une conclusion de ta part. Rien ne doit venir de toi seul. Tout élément doit s'appuyer sur une phrase qu'il a dite. Pas de score, pas de note, pas de classement.

## Ce que tu as

Ce qu'il a gardé de ses histoires, avec sa phrase d'origine (c'est ce qu'il valide) :
<<kept_items>>

Les cartes qu'il a choisies dans le miroir, car elles lui ressemblent le plus :
<<mirror_selection>>

Ce qu'il a dit lui-même dans le miroir :
<<mirror_answers>>

Ce qu'il a raconté pendant la partie :
<<turn_summaries>>

Ce qu'il a dit lui-même vouloir éviter ou préférer :
<<constraints>>

Ce que le rapport du Centre des possibles suggère de lui. Ce sont des hypothèses, jamais un verdict :
<<report>>

## Ce que tu produis

1. **overview** : deux à quatre phrases qui reprennent ce qu'il a raconté, avec ses mots, et la façon dont il s'est reconnu dans le miroir. Termine en laissant la porte ouverte : il peut revenir quand il veut. Remercie simplement, sans en faire trop.

2. **crossings** : le croisement entre le rapport et ce qu'il a raconté. Deux à quatre éléments au maximum. Chaque élément a un « kind » : « match » quand le rapport et son récit se rejoignent (« Le rapport parle d'aide aux autres, et tu m'as parlé de la caisse de l'asso »), « gap » quand ils divergent ou quand un côté n'a pas été exploré. C'est une piste de réflexion, pas un verdict : tu le dis avec prudence, et tu laisses le jeune trancher. Ne cite jamais de score du rapport.

3. **personality_cards** : deux à quatre cartes de personnalité à lui offrir. Chacune a un titre court tourné vers l'action (« Trouve d'où vient une panne », pas « Débrouillard »), une description d'une à deux phrases avec ses faits, et une « evidence » : **une phrase du jeune copiée mot pour mot**, issue de ses faits gardés ou de ses réponses du miroir. Pas de carte sans preuve.

4. **suggestions** : trois à cinq pistes de métiers ou de domaines à explorer, jamais présentées comme des choix à faire ni comme une certitude. Appuie-toi sur ce qu'il a raconté d'abord, sur le rapport ensuite. Aucune piste ne doit être écartée à cause de sa santé ou d'une situation que tu aurais devinée ; ne tiens compte que de ce qu'il a dit lui-même vouloir éviter. Chaque piste a :
   - « title » : la piste en quelques mots (« Maintenance informatique »), cinq mots au plus : un domaine ou une activité (« Développement de jeux vidéo »), jamais un nom de métier au masculin ou au féminin (« Développeur »), pour que ça marche pour tout le monde ;
   - « why » : pourquoi elle peut lui parler, en une phrase qui reprend un fait qu'il a raconté (« Parce que t'as trouvé tout seul quelle extension faisait planter le serveur. ») ;
   - « first_step » : un premier pas concret, petit et faisable cette semaine, sans rien promettre (« En parler à ton conseiller pour voir un stage d'observation d'une journée. », « Regarder une vidéo d'un technicien qui raconte sa journée. »).

5. **mirror_words** : une ou deux phrases qu'il a dites **lui-même dans le miroir**, copiées mot pour mot, les plus parlantes sur ce qu'il a découvert de lui. Ce sont ses conclusions à lui : elles seront affichées en premier, en grand. Si rien dans le miroir ne s'y prête, une liste vide.

6. **advisor_questions** : deux ou trois questions qu'il pourrait poser à son conseiller au Centre des possibles, pour aller plus loin. Elles partent de ce qu'il a raconté ou d'un écart avec le rapport. Écrites à la première personne, comme s'il les posait lui-même (« Le rapport parle de métiers d'aide aux autres : on pourrait regarder ensemble si ça me parle ? »).

Interdit : tout ce qui touche à la santé, à l'origine, à la famille ou à la religion. Toute qualité sans preuve. Les mots « score », « note », « profil », « RIASEC ».

## Ta réponse

Tu réponds uniquement avec un objet JSON valide, sans aucun texte autour, de cette forme :

{"overview": "...", "mirror_words": ["..."], "crossings": [{"kind": "match", "text": "..."}], "personality_cards": [{"title": "...", "description": "...", "evidence": "..."}], "suggestions": [{"title": "...", "why": "...", "first_step": "..."}], "advisor_questions": ["..."]}
