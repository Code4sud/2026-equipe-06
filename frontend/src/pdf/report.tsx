// The "Télécharger mon rapport" PDF. Loaded only when the button is pressed (it is a heavy library).
// Not a screen, never hot-reloaded: its PDF components can live next to the function that renders them
/* eslint-disable react-refresh/only-export-components */
//
// A sober, precise A4 report, to keep or to hand to an adviser: not a copy of the playful summary
// pages. Page 1 is for the young person; page 2, the technical sheet, for an adviser or a
// psychologist. Helvetica is built into PDF readers and has all French accents.
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { Summary } from '../types'
import {
  ENDED_BY_LABELS,
  ENGAGEMENT_LABELS,
  FAMILY_LABELS,
  METHOD_POINTS,
  STRENGTH_HINTS,
  STRENGTH_LABELS,
  plural,
  wordsPerAnswer,
} from '../utils/technicalLabels'

const INK = '#1e1633'
const SOFT = '#5f5873'
const LINE = '#d9d4e3'
const ACCENT = '#7a1fd6'

/** Text sizes at scale 1; lowered step by step until each page fits on one sheet */
const BASE_SIZE = 9.5

function makeStyles(scale: number) {
  const size = BASE_SIZE * scale
  return StyleSheet.create({
    page: {
      paddingTop: 34,
      paddingBottom: 40,
      paddingHorizontal: 40,
      fontFamily: 'Helvetica',
      fontSize: size,
      lineHeight: 1.35,
      color: INK,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingBottom: 8,
      marginBottom: 10 * scale,
      borderBottomWidth: 1.5,
      borderBottomColor: ACCENT,
    },
    title: { fontFamily: 'Helvetica-Bold', fontSize: size * 1.75, lineHeight: 1.15, marginBottom: 3 },
    subtitle: { fontSize: size * 0.9, color: SOFT, marginTop: 2 },
    meta: { fontSize: size * 0.85, color: SOFT, textAlign: 'right' },
    section: { marginBottom: 9 * scale },
    h2: {
      fontFamily: 'Helvetica-Bold',
      fontSize: size * 1.1,
      color: ACCENT,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 4 * scale,
    },
    paragraph: { marginBottom: 2 },
    quote: { fontFamily: 'Helvetica-Oblique', marginBottom: 2 },
    table: { borderTopWidth: 0.75, borderTopColor: LINE },
    row: { flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: LINE, paddingVertical: 3 * scale },
    headRow: { flexDirection: 'row', paddingVertical: 3 * scale, borderBottomWidth: 0.75, borderBottomColor: LINE },
    head: { fontFamily: 'Helvetica-Bold', fontSize: size * 0.85, color: SOFT },
    cell: { paddingRight: 8 },
    bold: { fontFamily: 'Helvetica-Bold' },
    oblique: { fontFamily: 'Helvetica-Oblique' },
    soft: { color: SOFT },
    columns: { flexDirection: 'row', gap: 14 },
    column: { flex: 1 },
    bullet: { flexDirection: 'row', marginBottom: 2 },
    bulletMark: { width: 10, color: ACCENT },
    bulletText: { flex: 1 },
    footer: {
      position: 'absolute',
      bottom: 18,
      left: 40,
      right: 40,
      paddingTop: 5,
      fontSize: 6.8,
      color: SOFT,
      borderTopWidth: 0.75,
      borderTopColor: LINE,
    },
  })
}

type Styles = ReturnType<typeof makeStyles>

function Bullets({ items, styles }: { items: string[]; styles: Styles }) {
  return (
    <View>
      {items.map((item) => (
        <View key={item} style={styles.bullet}>
          <Text style={styles.bulletMark}>–</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

interface PageProps {
  summary: Summary
  date: string
  scale: number
}

/** Page 1: the young person's report */
function TalentsPage({ summary, date, scale }: PageProps) {
  const styles = makeStyles(scale)
  const matches = summary.crossings.filter((c) => c.kind === 'match').map((c) => c.text)
  const gaps = summary.crossings.filter((c) => c.kind === 'gap').map((c) => c.text)

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Rapport de talents</Text>
          <Text style={styles.subtitle}>Synthèse d’une partie de Pioche ta voix, à partir de ce que tu as raconté</Text>
        </View>
        <Text style={styles.meta}>
          {date}
          {'\n'}Centre des Possibles · Nice
        </Text>
      </View>

      {summary.overview ? (
        <View style={styles.section}>
          <Text style={styles.h2}>Synthèse</Text>
          <Text style={styles.paragraph}>{summary.overview}</Text>
        </View>
      ) : null}

      {summary.mirrorWords.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>Tes mots</Text>
          {summary.mirrorWords.map((words) => (
            <Text key={words} style={styles.quote}>
              « {words} »
            </Text>
          ))}
        </View>
      )}

      {summary.collection.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>Compétences repérées</Text>
          <View style={styles.table}>
            <View style={styles.headRow}>
              <Text style={[styles.head, styles.cell, { width: '27%' }]}>Ce que tu as fait</Text>
              <Text style={[styles.head, styles.cell, { width: '40%' }]}>Ta phrase</Text>
              <Text style={[styles.head, { width: '33%' }]}>Compétence (référentiel ROME 4.0)</Text>
            </View>
            {summary.collection.map((entry) => (
              <View key={entry.id} style={styles.row} wrap={false}>
                <Text style={[styles.bold, styles.cell, { width: '27%' }]}>{entry.skill}</Text>
                <Text style={[styles.oblique, styles.cell, { width: '40%' }]}>« {entry.quote} »</Text>
                <Text style={[styles.soft, { width: '33%' }]}>
                  {entry.romeLabel ?? '—'}
                  {entry.romeCode ? ` (${entry.romeCode})` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {summary.personalityCards.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>Ce qui te ressemble</Text>
          {summary.personalityCards.map((card) => (
            <Text key={card.id} style={styles.paragraph}>
              <Text style={styles.bold}>{card.title}. </Text>
              {card.description} <Text style={[styles.oblique, styles.soft]}>(« {card.evidence} »)</Text>
            </Text>
          ))}
        </View>
      )}

      {summary.crossings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>Croisement avec ton rapport des possibles</Text>
          <View style={styles.columns}>
            {matches.length > 0 && (
              <View style={styles.column}>
                <Text style={styles.bold}>Ce qui se rejoint</Text>
                <Bullets items={matches} styles={styles} />
              </View>
            )}
            {gaps.length > 0 && (
              <View style={styles.column}>
                <Text style={styles.bold}>Ce qui reste à explorer</Text>
                <Bullets items={gaps} styles={styles} />
              </View>
            )}
          </View>
        </View>
      )}

      {summary.suggestions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>Pistes à explorer</Text>
          <View style={styles.table}>
            <View style={styles.headRow}>
              <Text style={[styles.head, styles.cell, { width: '24%' }]}>Piste</Text>
              <Text style={[styles.head, styles.cell, { width: '40%' }]}>Pourquoi</Text>
              <Text style={[styles.head, { width: '36%' }]}>Premier pas</Text>
            </View>
            {summary.suggestions.map((lead) => (
              <View key={lead.title} style={styles.row} wrap={false}>
                <Text style={[styles.bold, styles.cell, { width: '24%' }]}>{lead.title}</Text>
                <Text style={[styles.cell, { width: '40%' }]}>{lead.why || '—'}</Text>
                <Text style={{ width: '36%' }}>{lead.firstStep || '—'}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {summary.advisorQuestions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>À aborder avec ton conseiller</Text>
          <Bullets items={summary.advisorQuestions} styles={styles} />
        </View>
      )}

      <Text style={styles.footer} fixed>
        Ce rapport vient de ce que tu as raconté pendant le jeu et peut comporter des erreurs. Ce sont des pistes de
        réflexion, pas un verdict : il ne remplace pas l’échange avec un conseiller. Aucune information sur la santé,
        l’origine, la famille ou la religion n’y est retenue sans ton accord.
      </Text>
    </Page>
  )
}

function TechnicalPage({ summary, date, scale }: PageProps) {
  const styles = makeStyles(scale)
  const technical = summary.technical

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Fiche technique</Text>
          <Text style={styles.subtitle}>
            Pour le conseiller ou le psychologue · compétences rattachées au référentiel ROME 4.0
          </Text>
        </View>
        <Text style={styles.meta}>
          {date}
          {'\n'}Pioche ta voix
        </Text>
      </View>

      {technical.domains.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>Profil par domaine ROME</Text>
          {technical.domains.map((line) => (
            <Text key={line.domain} style={styles.paragraph}>
              <Text style={styles.bold}>{line.domain}</Text>
              <Text style={styles.soft}>
                {'  '}
                {plural(line.skills, 'compétence')} · {plural(line.stories, 'récit')}
              </Text>
            </Text>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.h2}>Compétences repérées</Text>
        {technical.skills.length === 0 ? (
          <Text style={styles.soft}>Aucune carte gardée sur cette partie.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.headRow}>
              <Text style={[styles.head, styles.cell, { width: '36%' }]}>Macro-compétence ROME</Text>
              <Text style={[styles.head, styles.cell, { width: '20%' }]}>Récurrence</Text>
              <Text style={[styles.head, { width: '44%' }]}>Preuves (mot pour mot)</Text>
            </View>
            {technical.skills.map((skill) => (
              <View key={skill.code} style={styles.row} wrap={false}>
                <View style={[styles.cell, { width: '36%' }]}>
                  <Text style={styles.bold}>{skill.label}</Text>
                  <Text style={styles.soft}>
                    {skill.code} · {skill.category}
                  </Text>
                  <Text style={styles.soft}>
                    {skill.domain} › {skill.issue} › {skill.objective}
                  </Text>
                </View>
                <View style={[styles.cell, { width: '20%' }]}>
                  <Text style={styles.bold}>{STRENGTH_LABELS[skill.strength]}</Text>
                  <Text style={styles.soft}>{STRENGTH_HINTS[skill.strength]}</Text>
                  <Text style={styles.soft}>
                    {plural(skill.evidence.length, 'récit')}, {plural(skill.cards, 'carte')},{' '}
                    {plural(skill.families, 'thème')}
                  </Text>
                </View>
                <View style={{ width: '44%' }}>
                  {skill.evidence.map((item, index) => (
                    <Text key={`${item.quote}-${index}`} style={styles.paragraph}>
                      <Text style={styles.oblique}>« {item.quote} »</Text>
                      <Text style={styles.soft}>
                        {' '}
                        ({item.cardTitle}, {FAMILY_LABELS[item.family]})
                      </Text>
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {technical.unmapped.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>Sans équivalent ROME</Text>
          {technical.unmapped.map((item, index) => (
            <Text key={`${item.quote}-${index}`} style={styles.paragraph}>
              <Text style={styles.bold}>{item.fact}. </Text>
              <Text style={styles.oblique}>« {item.quote} »</Text>
            </Text>
          ))}
        </View>
      )}

      {technical.turns.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>Déroulé de la partie</Text>
          <View style={styles.table}>
            <View style={styles.headRow}>
              <Text style={[styles.head, styles.cell, { width: '30%' }]}>Carte</Text>
              <Text style={[styles.head, styles.cell, { width: '11%' }]}>Thème</Text>
              <Text style={[styles.head, styles.cell, { width: '9%' }]}>Réponses</Text>
              <Text style={[styles.head, styles.cell, { width: '10%' }]}>Mots / rép.</Text>
              <Text style={[styles.head, styles.cell, { width: '15%' }]}>Échange</Text>
              <Text style={[styles.head, styles.cell, { width: '16%' }]}>Fin</Text>
              <Text style={[styles.head, { width: '9%' }]}>Gardées</Text>
            </View>
            {technical.turns.map((turn, index) => (
              <View key={`${turn.cardTitle}-${index}`} style={styles.row} wrap={false}>
                <Text style={[styles.cell, { width: '30%' }]}>{turn.cardTitle}</Text>
                <Text style={[styles.cell, { width: '11%' }]}>{FAMILY_LABELS[turn.family]}</Text>
                <Text style={[styles.cell, { width: '9%' }]}>{turn.answers}</Text>
                <Text style={[styles.cell, { width: '10%' }]}>{wordsPerAnswer(turn)}</Text>
                <Text style={[styles.cell, { width: '15%' }]}>
                  {turn.engagement ? ENGAGEMENT_LABELS[turn.engagement] : '—'}
                </Text>
                <Text style={[styles.cell, { width: '16%' }]}>{ENDED_BY_LABELS[turn.endedBy]}</Text>
                <Text style={{ width: '9%' }}>{turn.kept}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.soft, { marginTop: 3 }]}>
            « Échange » est lu par l’assistant à la fin de chaque carte : il décrit la conversation, pas la personne.
          </Text>
        </View>
      )}

      {technical.topics.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>Sujets à reprendre en entretien</Text>
          <Text>{technical.topics.join(' · ')}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.h2}>Méthode et limites</Text>
        <Bullets items={METHOD_POINTS} styles={styles} />
      </View>

      <Text style={styles.footer} fixed>
        Document de travail issu d’un jeu, à croiser avec l’entretien. Il ne constitue ni un diagnostic ni une
        évaluation, et ne doit pas être transmis sans l’accord de la personne.
      </Text>
    </Page>
  )
}

const DOCUMENT_PROPS = {
  title: 'Rapport de talents · Pioche ta voix',
  author: 'Pioche ta voix',
  language: 'fr',
}
const SCALES = [1, 0.93, 0.86, 0.8, 0.74, 0.68]

/** Number of pages of a PDF made by react-pdf (its page objects are written in clear) */
async function pageCount(blob: Blob): Promise<number> {
  const text = await blob.text()
  return (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length
}

/** The largest scale at which this page fits on one sheet (the smallest one if none does) */
async function fittingScale(page: (scale: number) => ReactElement): Promise<number> {
  for (const scale of SCALES) {
    const blob = await pdf(<Document {...DOCUMENT_PROPS}>{page(scale)}</Document>).toBlob()
    if ((await pageCount(blob)) <= 1) return scale
  }
  // Very long content: the smallest version, even on two sheets, rather than nothing
  return SCALES[SCALES.length - 1]
}

/** The PDF of the summary: the report, then the technical sheet, each on one A4 page. */
export async function renderReport(summary: Summary): Promise<Blob> {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  // Each page gets its own size: a long technical sheet does not shrink the young person's page
  const talentsScale = await fittingScale((scale) => <TalentsPage summary={summary} date={date} scale={scale} />)
  const technicalScale = await fittingScale((scale) => <TechnicalPage summary={summary} date={date} scale={scale} />)
  return pdf(
    <Document {...DOCUMENT_PROPS}>
      <TalentsPage summary={summary} date={date} scale={talentsScale} />
      <TechnicalPage summary={summary} date={date} scale={technicalScale} />
    </Document>,
  ).toBlob()
}
