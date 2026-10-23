import { View } from 'react-native';
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';
import type { Muscle } from '../lib/types';

export type MuscleFills = Partial<Record<Muscle, { color: string; opacity?: number }>>;

const SKIN = '#2A2E36';
const IDLE = '#353A44';

// Shared silhouette (viewBox 0 0 120 230), drawn the same for front and back.
function Silhouette({ skin }: { skin: string }) {
  return (
    <G fill={skin}>
      <Ellipse cx={60} cy={18} rx={11} ry={13} />
      <Rect x={54} y={29} width={12} height={9} rx={3} />
      <Path d="M38 40 Q60 33 82 40 L87 52 Q85 80 79 100 L77 113 Q60 119 43 113 L41 100 Q35 80 33 52 Z" />
      <Path d="M35 43 Q26 45 23 58 L21 82 Q25 87 30 82 L35 62 Z" />
      <Path d="M85 43 Q94 45 97 58 L99 82 Q95 87 90 82 L85 62 Z" />
      <Path d="M21 85 Q17 100 17 116 Q20 121 24 116 L30 87 Z" />
      <Path d="M99 85 Q103 100 103 116 Q100 121 96 116 L90 87 Z" />
      <Path d="M44 110 Q40 140 42 168 L44 214 Q48 221 53 214 L57 168 Q60 140 59 116 Z" />
      <Path d="M76 110 Q80 140 78 168 L76 214 Q72 221 67 214 L63 168 Q60 140 61 116 Z" />
    </G>
  );
}

function fillFor(fills: MuscleFills, m: Muscle, idle: string) {
  const f = fills[m];
  return { fill: f?.color ?? idle, fillOpacity: f?.opacity ?? 1 };
}

function Front({ fills, skin, idle }: { fills: MuscleFills; skin: string; idle: string }) {
  const f = (m: Muscle) => fillFor(fills, m, idle);
  return (
    <>
      <Silhouette skin={skin} />
      <Ellipse cx={37} cy={49} rx={7} ry={8} {...f('shoulders')} />
      <Ellipse cx={83} cy={49} rx={7} ry={8} {...f('shoulders')} />
      <Path d="M59 46 Q48 43 43 50 Q42 60 48 64 Q55 66 59 62 Z" {...f('chest')} />
      <Path d="M61 46 Q72 43 77 50 Q78 60 72 64 Q65 66 61 62 Z" {...f('chest')} />
      <Ellipse cx={29} cy={65} rx={4.5} ry={10} {...f('biceps')} />
      <Ellipse cx={91} cy={65} rx={4.5} ry={10} {...f('biceps')} />
      <Rect x={51} y={68} width={18} height={37} rx={6} {...f('core')} />
      <Ellipse cx={50} cy={141} rx={7} ry={22} {...f('quads')} />
      <Ellipse cx={70} cy={141} rx={7} ry={22} {...f('quads')} />
      <Ellipse cx={49} cy={186} rx={3.5} ry={13} {...f('calves')} />
      <Ellipse cx={71} cy={186} rx={3.5} ry={13} {...f('calves')} />
    </>
  );
}

function Back({ fills, skin, idle }: { fills: MuscleFills; skin: string; idle: string }) {
  const f = (m: Muscle) => fillFor(fills, m, idle);
  return (
    <>
      <Silhouette skin={skin} />
      <Ellipse cx={37} cy={49} rx={7} ry={8} {...f('shoulders')} />
      <Ellipse cx={83} cy={49} rx={7} ry={8} {...f('shoulders')} />
      <Path d="M60 40 Q50 42 45 50 Q49 60 60 62 Q71 60 75 50 Q70 42 60 40 Z" {...f('back')} />
      <Path d="M45 56 Q40 70 46 89 Q54 85 58 66 Z" {...f('back')} />
      <Path d="M75 56 Q80 70 74 89 Q66 85 62 66 Z" {...f('back')} />
      <Ellipse cx={29} cy={65} rx={4.5} ry={10} {...f('triceps')} />
      <Ellipse cx={91} cy={65} rx={4.5} ry={10} {...f('triceps')} />
      <Rect x={53} y={89} width={14} height={14} rx={5} {...f('core')} />
      <Ellipse cx={52} cy={116} rx={8.5} ry={8.5} {...f('glutes')} />
      <Ellipse cx={68} cy={116} rx={8.5} ry={8.5} {...f('glutes')} />
      <Ellipse cx={50} cy={147} rx={6.5} ry={17} {...f('hamstrings')} />
      <Ellipse cx={70} cy={147} rx={6.5} ry={17} {...f('hamstrings')} />
      <Ellipse cx={48.5} cy={183} rx={5.5} ry={13} {...f('calves')} />
      <Ellipse cx={71.5} cy={183} rx={5.5} ry={13} {...f('calves')} />
    </>
  );
}

/** Front and back body side by side, with each muscle filled from `fills`. */
export function BodyMap({
  fills,
  height = 220,
  sides = 'both',
  skin = SKIN,
  idle = IDLE,
  region = 'full',
  label,
}: {
  fills: MuscleFills;
  height?: number;
  sides?: 'both' | 'front' | 'back';
  /** Body color, and the color of muscles with no fill. */
  skin?: string;
  idle?: string;
  /** Zoom to part of the body, for small tiles. */
  region?: 'full' | 'upper' | 'lower';
  /** What the map shows, for VoiceOver. Without one the map is decorative. */
  label?: string;
}) {
  const p = { fills, skin, idle };
  const [y0, h] = region === 'upper' ? [28, 100] : region === 'lower' ? [100, 125] : [0, 230];
  const both = sides === 'both';
  const width = both ? 240 : 120;
  return (
    <View
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    >
      <Svg
        width={(height / h) * (region === 'full' ? width : h)} height={height} viewBox={`${region === 'full' ? 0 : (width - h) / 2} ${y0} ${region === 'full' ? width : h} ${h}`}>
        {(both || sides === 'front') && <Front {...p} />}
        {both && (
          <G x={120}>
            <Back {...p} />
          </G>
        )}
        {sides === 'back' && <Back {...p} />}
      </Svg>
    </View>
  );
}

/** Green when fresh, amber when partly recovered, red when fatigued. */
export function recoveryColor(value: number): string {
  if (value >= 0.85) return colors.success;
  if (value >= 0.6) return colors.warning;
  return colors.danger;
}

export function recoveryFills(recovery: Record<Muscle, number>): MuscleFills {
  const fills: MuscleFills = {};
  for (const m of Object.keys(recovery) as Muscle[]) {
    fills[m] = { color: recoveryColor(recovery[m]), opacity: 0.9 };
  }
  return fills;
}

const BACK_MUSCLES: Muscle[] = ['back', 'triceps', 'glutes', 'hamstrings'];

const LOWER_MUSCLES: Muscle[] = ['quads', 'hamstrings', 'glutes', 'calves'];

/** Which part of the body to zoom to for an exercise's main muscle. */
export function regionFor(primary: Muscle[]): 'upper' | 'lower' {
  return LOWER_MUSCLES.includes(primary[0]) ? 'lower' : 'upper';
}

/** Which side best shows an exercise's main muscle. */
export function sideFor(primary: Muscle[]): 'front' | 'back' {
  return BACK_MUSCLES.includes(primary[0]) ? 'back' : 'front';
}
