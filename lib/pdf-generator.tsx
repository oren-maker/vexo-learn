import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer, Link, Image } from "@react-pdf/renderer";

// Register Heebo for Hebrew + Latin. Fetched from Google Fonts at runtime by
// @react-pdf which inlines it into the generated PDF.
Font.register({
  family: "Heebo",
  fonts: [
    { src: "https://fonts.gstatic.com/s/heebo/v28/NGSpv5_NC0k9P_v6ZUCbLRAHxK1EiSyccg.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/heebo/v28/NGSpv5_NC0k9P_v6ZUCbLRAHxK1Euyyccg.ttf", fontWeight: 500 },
    { src: "https://fonts.gstatic.com/s/heebo/v28/NGSpv5_NC0k9P_v6ZUCbLRAHxK1Ebiuccg.ttf", fontWeight: 700 },
    { src: "https://fonts.gstatic.com/s/heebo/v28/NGSpv5_NC0k9P_v6ZUCbLRAHxK1ECSuccg.ttf", fontWeight: 800 },
  ],
});

const PALETTE = {
  ink: "#0f172a",
  text: "#1e293b",
  muted: "#64748b",
  light: "#94a3b8",
  border: "#e2e8f0",
  softBg: "#f8fafc",
  accent: "#0891b2",
  accent2: "#7c3aed",
  amber: "#b45309",
  success: "#047857",
};

const styles = StyleSheet.create({
  page: {
    padding: 48,
    paddingHorizontal: 56,
    fontFamily: "Heebo",
    fontSize: 10,
    color: PALETTE.text,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    paddingBottom: 10,
    borderBottom: `1 solid ${PALETTE.border}`,
  },
  brand: {
    fontSize: 9,
    color: PALETTE.accent,
    fontWeight: 700,
    letterSpacing: 1.5,
  },
  dateText: {
    fontSize: 8,
    color: PALETTE.light,
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    color: PALETTE.ink,
    marginBottom: 6,
    lineHeight: 1.2,
  },
  url: {
    fontSize: 8,
    color: PALETTE.accent,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  metaPill: {
    fontSize: 8,
    backgroundColor: PALETTE.softBg,
    color: PALETTE.text,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    border: `1 solid ${PALETTE.border}`,
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: PALETTE.accent,
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.55,
    color: PALETTE.text,
  },
  bodyTextRtl: {
    fontSize: 10,
    lineHeight: 1.7,
    color: PALETTE.text,
    direction: "rtl",
    textAlign: "right",
  },
  promptBox: {
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    padding: 14,
    borderRadius: 4,
    fontFamily: "Courier",
    fontSize: 9,
    lineHeight: 1.5,
  },
  captionBox: {
    backgroundColor: "#fef3c7",
    padding: 10,
    borderRadius: 4,
    border: `1 solid #fde68a`,
    fontSize: 10,
    lineHeight: 1.6,
  },
  techRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  techChip: {
    backgroundColor: "#ecfeff",
    color: PALETTE.accent,
    fontSize: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 3,
    border: `1 solid #a5f3fc`,
  },
  tagChip: {
    backgroundColor: "#f1f5f9",
    color: PALETTE.muted,
    fontSize: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
  },
  insightItem: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  insightBullet: {
    color: PALETTE.accent2,
    fontSize: 10,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 24,
    borderTop: `1 solid ${PALETTE.border}`,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: PALETTE.light,
  },
  pageNumber: {
    fontSize: 7,
    color: PALETTE.light,
  },
});

export type PdfSourceData = {
  id: string;
  title: string | null;
  url: string | null;
  prompt: string;
  addedBy: string | null;
  createdAt: Date;
  thumbnail: string | null;
  analysis: {
    description: string | null;
    style: string | null;
    mood: string | null;
    difficulty: string | null;
    techniques: string[];
    tags: string[];
    howTo: string[];
    insights: string[];
  } | null;
  generatedImages?: Array<{ blobUrl: string; model: string; usdCost: number; createdAt: Date }>;
};

function PdfDoc({ s }: { s: PdfSourceData }) {
  const a = s.analysis;
  const createdStr = new Date(s.createdAt).toLocaleDateString("he-IL");
  const promptLines = s.prompt.split("\n");

  return (
    <Document title={s.title || "VEXO Learn Prompt"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>VEXO LEARN · DIRECTOR TRAINING</Text>
          <Text style={styles.dateText}>{createdStr} · ID {s.id.slice(-8)}</Text>
        </View>

        <Text style={styles.title}>{s.title || "Untitled Prompt"}</Text>

        {s.url && (
          <Link src={s.url} style={styles.url}>
            {s.url}
          </Link>
        )}

        {s.thumbnail && (
          <View style={{ marginBottom: 14, marginTop: 4 }}>
            <Image
              src={s.thumbnail}
              style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 4 }}
            />
          </View>
        )}

        <View style={styles.metaRow}>
          {a?.style && <Text style={styles.metaPill}>Style: {a.style}</Text>}
          {a?.mood && <Text style={styles.metaPill}>Mood: {a.mood}</Text>}
          {a?.difficulty && <Text style={styles.metaPill}>Level: {a.difficulty}</Text>}
          {s.addedBy && <Text style={styles.metaPill}>Source: {s.addedBy}</Text>}
          <Text style={styles.metaPill}>Techniques: {a?.techniques.length || 0}</Text>
        </View>

        {a?.description && (
          <>
            <Text style={styles.sectionLabel}>תקציר · SUMMARY</Text>
            <Text style={styles.bodyText}>{a.description}</Text>
          </>
        )}

        <Text style={styles.sectionLabel}>PROMPT</Text>
        <View style={styles.promptBox}>
          {promptLines.map((line, i) => (
            <Text key={i}>{line || " "}</Text>
          ))}
        </View>

        {a && a.techniques.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>טכניקות · TECHNIQUES</Text>
            <View style={styles.techRow}>
              {a.techniques.map((t, i) => (
                <Text key={i} style={styles.techChip}>{t}</Text>
              ))}
            </View>
          </>
        )}

        {a && a.howTo.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>HOW TO RECREATE</Text>
            <View>
              {a.howTo.map((h, i) => (
                <View key={i} style={styles.insightItem}>
                  <Text style={styles.insightBullet}>{i + 1}.</Text>
                  <Text style={[styles.bodyText, { flex: 1 }]}>{h}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {a && a.insights.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>תובנות · INSIGHTS</Text>
            <View>
              {a.insights.map((h, i) => (
                <View key={i} style={styles.insightItem}>
                  <Text style={styles.insightBullet}>•</Text>
                  <Text style={[styles.bodyText, { flex: 1 }]}>{h}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {a && a.tags.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>תגיות · TAGS</Text>
            <View style={styles.techRow}>
              {a.tags.map((t, i) => (
                <Text key={i} style={styles.tagChip}>#{t}</Text>
              ))}
            </View>
          </>
        )}

        {s.generatedImages && s.generatedImages.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>
              תמונות שחוללו · GENERATED IMAGES ({s.generatedImages.length})
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {s.generatedImages.map((img, i) => (
                <View
                  key={i}
                  style={{
                    width: "48%",
                    border: `1 solid ${PALETTE.border}`,
                    borderRadius: 4,
                    padding: 4,
                    marginBottom: 8,
                  }}
                >
                  <Image
                    src={img.blobUrl}
                    style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 3 }}
                  />
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                    <Text style={{ fontSize: 7, color: PALETTE.accent }}>{img.model}</Text>
                    <Text style={{ fontSize: 7, color: PALETTE.amber, fontWeight: 700 }}>
                      ${img.usdCost.toFixed(4)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 6, color: PALETTE.light, marginTop: 2 }}>
                    {new Date(img.createdAt).toLocaleDateString("he-IL")}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text>vexo-learn.vercel.app</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function generatePdfBuffer(s: PdfSourceData): Promise<Buffer> {
  const doc = <PdfDoc s={s} />;
  return renderToBuffer(doc);
}
