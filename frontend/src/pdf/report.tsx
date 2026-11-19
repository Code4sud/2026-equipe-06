// The "Télécharger mon rapport" PDF. Loaded only when the button is pressed (it is a heavy library).
// Not a screen, never hot-reloaded: its PDF components can live next to the function that renders them
/* eslint-disable react-refresh/only-export-components */
//
// A sober, precise one-page A4 report, to keep or to hand to an adviser: not a copy of the three
// playful summary pages. Helvetica is built into PDF readers and has all French accents.
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import type { Summary } from '../types'

const INK = '#1e1633'
const SOFT = '#5f5873'
const LINE = '#d9d4e3'
const ACCENT = '#7a1fd6'

/** Text sizes at scale 1; lowered step by step until the report fits on one page */
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

function Report({ summary, date, scale }: { summary: Summary; date: string; scale: number }) {
  const styles = makeStyles(scale)
  const matches = summary.crossings.filter((c) => c.kind === 'match').map((c) => c.text)
  const gaps = summary.crossings.filter((c) => c.kind === 'gap').map((c) => c.text)

  return (
    <Document title="Rapport de talents · Pioche ta voix" author="Pioche ta voix" language="fr">
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
    </Document>
  )
}

/** Number of pages of a PDF made by react-pdf (its page objects are written in clear) */
async function pageCount(blob: Blob): Promise<number> {
  const text = await blob.text()
  return (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length
}

/** The PDF of the summary, on one A4 page: the text gets smaller until everything fits. */
export async function renderReport(summary: Summary): Promise<Blob> {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  let blob: Blob | null = null
  for (const scale of [1, 0.93, 0.86, 0.8, 0.74, 0.68]) {
    blob = await pdf(<Report summary={summary} date={date} scale={scale} />).toBlob()
    if ((await pageCount(blob)) <= 1) return blob
  }
  // Very long summary: the smallest version, even on two pages, rather than nothing
  return blob as Blob
}
