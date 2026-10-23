import Svg, { Circle, Line } from 'react-native-svg';
import type { Shape } from '../lib/figure';

/** Renders figure shapes into an SVG with the given view box. */
export function FigureSvg({
  shapes,
  viewBox,
  width,
  height,
}: {
  shapes: Shape[];
  viewBox: string;
  width: number | string;
  height: number | string;
}) {
  return (
    <Svg width={width} height={height} viewBox={viewBox}>
      {shapes.map((s, i) =>
        s.kind === 'line' ? (
          <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={s.width} strokeLinecap="round" />
        ) : (
          <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeWidth} />
        ),
      )}
    </Svg>
  );
}
