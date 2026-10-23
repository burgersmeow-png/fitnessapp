import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirm } from '../components/confirm';
import { Button, Card, Loading } from '../components/ui';
import { decodePlan, planUrl, samePlan, type PlanLink } from '../lib/planLink';
import { colors, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import { loadPlan, startFollowing, stopFollowing } from '../services/plan';
import { loadProgram, stopProgram } from '../services/programs';
import { linkWithMyCode } from '../services/creatorCode';
import { SITE_URL } from '../services/server';
import { useLinkCredit } from '../components/useLinkCredit';
import { shareLink } from '../services/shareLink';
import { ShareCardSheet } from '../components/ShareCardSheet';
import { planCardContent, type CardContent } from '../lib/shareCard';

/** A plan opened from a link (liftlab://plan?p=…), or the one you follow. */
export default function PlanScreen() {
  const { p, code } = useLocalSearchParams<{ p?: string; code?: string }>();
  const creator = useLinkCredit(code);
  const db = useSQLiteContext();
  const [status, setStatus] = useState<string | null>(null);
  const [card, setCard] = useState<CardContent | null>(null);
  const [data, reload] = useFocusData(async () => {
    const [followed, program] = await Promise.all([loadPlan(db), loadProgram(db)]);
    return { followed, program, shared: decodePlan(p) };
  }, [p]);
  if (!data) return <Loading />;
  const { followed, program, shared } = data;
  const plan: PlanLink | null = shared ?? followed;
  const following = !!followed && !!plan && samePlan(followed, plan);

  if (!plan) {
    return (
      <View style={[styles.screen, { padding: space.xl, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={type.title}>{p ? 'This link doesn’t work' : 'No plan yet'}</Text>
        <Text style={[styles.sub, { textAlign: 'center' }]}>
          {p ? 'It may have been cut off when it was copied. Ask for the link again.' : 'Open a creator’s plan link, or make your own from your workouts.'}
        </Text>
        <Button title={p ? 'Go to LiftLab' : 'Make a plan'} onPress={() => router.replace(p ? '/' : '/plan-new')} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />
      </View>
    );
  }

  const follow = () => {
    const run = async () => {
      // A plan replaces a built-in program, since both decide what you train next.
      if (program) await stopProgram(db);
      await startFollowing(db, plan);
      router.replace('/');
    };
    const replacing = followed ? `You’ll stop following ${followed.title}.` : program ? 'You’ll stop your current program.' : null;
    if (replacing) confirm(`Follow ${plan.title}?`, `${replacing} Your workouts stay in History.`, 'Follow', run);
    else run();
  };
  const stop = () =>
    confirm('Stop following this plan?', 'Today goes back to picking whatever is most recovered.', 'Stop', async () => {
      await stopFollowing(db);
      reload();
    }, true);
  const share = async () => {
    setStatus(null);
    try {
      const r = await shareLink(`Follow my LiftLab plan "${plan.title}":`, await linkWithMyCode(db, planUrl(SITE_URL, plan)));
      if (r === 'copied') setStatus('Link copied. Paste it in your bio, story or a message.');
    } catch {
      setStatus('Could not share the link.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
      <Text style={type.label}>{following ? 'YOUR PLAN' : creator ? `${creator.toUpperCase()}’S PLAN` : 'SHARED PLAN'}</Text>
      <Text style={[type.hero, { marginTop: space.xs }]}>{plan.title}</Text>
      <Text style={styles.sub}>
        {plan.days.length} {plan.days.length === 1 ? 'day' : 'days'}, done in order, one per session.
        {following && followed ? ` ${followed.done} ${followed.done === 1 ? 'session' : 'sessions'} in.` : ' Weights come from your own history.'}
      </Text>

      {following ? (
        <View style={styles.row}>
          <Button title="Share plan" variant="secondary" onPress={share} style={{ flex: 1 }} />
          <Button title="Story image" variant="secondary" onPress={() => setCard(planCardContent(plan))} style={{ flex: 1 }} />
        </View>
      ) : (
        <Button title="Follow this plan" onPress={follow} style={{ marginTop: space.md }} />
      )}
      {status && <Text style={styles.status}>{status}</Text>}

      {plan.days.map((d, i) => {
        const next = following && followed?.next === i;
        return (
          <Card key={i} style={[styles.day, next && styles.next]}>
            <View style={styles.dayHead}>
              <Text style={styles.dayTitle} numberOfLines={1}>
                {d.title}
              </Text>
              {next && <Text style={styles.nextTag}>UP NEXT</Text>}
            </View>
            {d.lifts.map((l, j) => (
              <View key={j} style={styles.lift}>
                <Text style={styles.liftName} numberOfLines={1}>{l.name}</Text>
                <Text style={styles.liftSets}>
                  {l.sets} × {l.reps}
                </Text>
              </View>
            ))}
          </Card>
        );
      })}
      {following && (
        <Pressable onPress={stop} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.lg }}>
          <Text style={styles.notNow}>Stop following this plan</Text>
        </Pressable>
      )}
      <ShareCardSheet content={card} onClose={() => setCard(null)} title="Post it to your story" fileName="liftlab-plan.png" />
      {!following && !router.canGoBack() && (
        <Pressable onPress={() => router.replace('/')} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.sm }}>
          <Text style={styles.notNow}>Not now</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  sub: { color: colors.textMuted, fontSize: 15, marginTop: space.sm },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  status: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: space.sm },
  day: { marginTop: space.md },
  next: { borderColor: colors.accent, borderWidth: 2 },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs },
  dayTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '800' },
  nextTag: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  lift: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 6 },
  liftName: { flex: 1, color: colors.text, fontSize: 15 },
  liftSets: { color: colors.textMuted, fontSize: 15, fontVariant: ['tabular-nums'] },
  notNow: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
