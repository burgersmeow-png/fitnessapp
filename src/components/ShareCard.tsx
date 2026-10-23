import { forwardRef } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, RadialGradient, Rect, Stop, Text } from 'react-native-svg';
import type { CardContent } from '../lib/shareCard';
import { colors } from '../lib/theme';

export const CARD_W = 1080;
export const CARD_H = 1920;
const X = 90;
const FONT = 'Inter, -apple-system, Helvetica Neue, Helvetica, Arial, sans-serif';

/** Big as fits: heavy caps run about 0.7 of the font size per letter. */
export const headlineSize = (s: string) => Math.min(136, Math.floor((CARD_W - 2 * X) / (s.length * 0.7)));

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * The story-sized (9:16) image people post after a workout. Drawn in SVG so it can be saved
 * as a PNG on the phone and in the browser without extra libraries.
 */
export const ShareCard = forwardRef<Svg, { content: CardContent; width: number }>(function ShareCard({ content, width }, ref) {
  const statW = (CARD_W - 2 * X - 2 * 30) / 3;
  const listTop = 960;
  return (
    <Svg ref={ref} width={width} height={(width * CARD_H) / CARD_W} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.surface} />
          <Stop offset="1" stopColor={colors.background} />
        </LinearGradient>
        <RadialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={colors.accent} stopOpacity="0.55" />
          <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={CARD_W} height={CARD_H} fill="url(#bg)" />
      <Circle cx={CARD_W - 80} cy={160} r={520} fill="url(#glow)" />

      <Rect x={X} y={120} width={64} height={64} rx={16} fill={colors.accent} />
      <Text x={X + 32} y={168} fontSize={44} fontWeight="900" fill={colors.accentText} textAnchor="middle" fontFamily={FONT}>L</Text>
      <Text x={X + 90} y={168} fontSize={48} fontWeight="900" fill={colors.text} letterSpacing={6} fontFamily={FONT}>LIFTLAB</Text>

      <Text x={X} y={340} fontSize={38} fontWeight="700" fill={colors.textMuted} letterSpacing={4} fontFamily={FONT}>{content.eyebrow}</Text>
      <Text x={X} y={480} fontSize={headlineSize(content.headline)} fontWeight="900" fill={colors.text} fontFamily={FONT}>{content.headline}</Text>
      <Rect x={X} y={530} width={140} height={14} rx={7} fill={colors.accent} />

      {content.stats.map((s, i) => {
        const x = X + i * (statW + 30);
        return (
          <G key={s.label}>
            <Rect x={x} y={620} width={statW} height={250} rx={36} fill={colors.surfaceRaised} />
            <Text x={x + 40} y={770} fontSize={s.value.length > 4 ? 70 : s.value.length > 3 ? 80 : 92} fontWeight="800" fill={colors.text} fontFamily={FONT}>{s.value}</Text>
            <Text x={x + 40} y={830} fontSize={28} fontWeight="700" fill={colors.textMuted} letterSpacing={2} fontFamily={FONT}>{s.label}</Text>
          </G>
        );
      })}

      {content.lines.map((l, i) => {
        const y = listTop + i * 150;
        return (
          <G key={`${l.name}-${i}`}>
            {i > 0 && <Rect x={X} y={y - 30} width={CARD_W - 2 * X} height={2} fill={colors.border} />}
            <Text x={X} y={y + 50} fontSize={50} fontWeight="700" fill={colors.text} fontFamily={FONT}>{clip(l.name, l.pr ? 22 : 26)}</Text>
            <Text x={X} y={y + 106} fontSize={40} fill={colors.textMuted} fontFamily={FONT}>{l.detail}</Text>
            {l.pr && (
              <G>
                <Rect x={CARD_W - X - 150} y={y + 6} width={150} height={66} rx={33} fill={colors.success} />
                <Text x={CARD_W - X - 75} y={y + 52} fontSize={34} fontWeight="900" fill={colors.background} textAnchor="middle" fontFamily={FONT}>PR</Text>
              </G>
            )}
          </G>
        );
      })}
      {content.more > 0 && (
        <Text x={X} y={listTop + content.lines.length * 150 + 40} fontSize={38} fill={colors.textMuted} fontFamily={FONT}>
          {`+ ${content.more} more lift${content.more > 1 ? 's' : ''}`}
        </Text>
      )}

      <Rect x={X} y={1750} width={CARD_W - 2 * X} height={2} fill={colors.border} />
      <Text x={X} y={1830} fontSize={36} fontWeight="600" fill={colors.textMuted} fontFamily={FONT}>{content.footer}</Text>
    </Svg>
  );
});
