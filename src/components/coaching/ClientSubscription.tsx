import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatPrice, subscriptionLabel, type Subscription } from '../../lib/payments';
import { colors, space } from '../../lib/theme';
import { cancelSubscription, resumeSubscription, subscribeToCoach, type CoachOffer } from '../../services/payments';
import { Button } from '../ui';

const TONE = { good: colors.success, warn: colors.warning, muted: colors.textMuted };

/** On the client's coach card: subscribe, or see and manage the subscription. */
export function ClientSubscription({
  offer,
  sub,
  act,
  confirm,
}: {
  offer: CoachOffer | null;
  sub: Subscription;
  act: (work: () => Promise<void>) => void;
  confirm: (title: string, message: string, action: string, onYes: () => void) => void;
}) {
  const subscribed = sub.status === 'active' || sub.status === 'past_due';
  if (!offer && !subscribed) return null;
  const label = subscriptionLabel(sub);

  return (
    <View style={styles.box}>
      {subscribed ? (
        <>
          <Text style={[styles.status, { color: TONE[label.tone] }]}>{label.text}</Text>
          {sub.status === 'past_due' && (
            <Text style={styles.muted}>Stripe will try your card again. Check your email from Stripe to update it.</Text>
          )}
          {sub.ending ? (
            <Pressable onPress={() => act(async () => void (await resumeSubscription()))} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>Keep my subscription</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() =>
                confirm('Cancel subscription?', 'You keep coaching until the end of the month you’ve paid for. Then it stops renewing.', 'Cancel subscription', () =>
                  act(async () => void (await cancelSubscription())),
                )
              }
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.muted}>Cancel subscription</Text>
            </Pressable>
          )}
        </>
      ) : (
        offer && (
          <>
            <Button title={`Subscribe · ${formatPrice(offer.priceCents, offer.currency)} a month`} onPress={() => act(subscribeToCoach)} />
            <Text style={[styles.muted, { marginTop: space.sm }]}>Pay securely with Stripe. Cancel any time.</Text>
          </>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: space.md, gap: space.xs },
  status: { fontSize: 15, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '700' },
});
