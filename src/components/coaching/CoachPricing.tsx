import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { formatPrice, parsePrice } from '../../lib/payments';
import { colors, radius, space } from '../../lib/theme';
import { setUpPayouts, savePrice, type Payouts } from '../../services/payments';
import { Button, Card } from '../ui';

/** A coach's monthly price and Stripe payout setup. Coaching stays free until both are done. */
export function CoachPricing({ payouts, act, onNote }: { payouts: Payouts; act: (work: () => Promise<void>) => void; onNote: (note: string) => void }) {
  const [text, setText] = useState(payouts.priceCents ? String(payouts.priceCents / 100) : '');
  const price = payouts.priceCents;
  const live = price != null && payouts.chargesEnabled;

  const save = () => {
    if (!text.trim()) return act(() => savePrice(null));
    const cents = parsePrice(text);
    if (cents == null) return onNote('Enter a monthly price between $1 and $1,000.');
    act(() => savePrice(cents));
  };

  return (
    <Card style={{ marginBottom: space.md }}>
      <Text style={styles.title}>Paid coaching</Text>
      <Text style={styles.muted}>
        {live
          ? `Clients can subscribe for ${formatPrice(price, payouts.currency)} a month. Money goes to your bank through Stripe.`
          : 'Charge clients monthly. They pay on Stripe’s secure checkout and the money goes to your bank. Free until you set a price and payouts.'}
      </Text>
      <View style={styles.row}>
        <Text style={styles.currency}>$</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Free"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          accessibilityLabel="Monthly price in dollars. Leave empty to coach for free."
          maxFontSizeMultiplier={1.4}
        />
        <Text style={styles.muted}>/ month</Text>
        <Button title="Save" variant="secondary" onPress={save} style={{ flex: 1 }} />
      </View>
      {!payouts.chargesEnabled && (
        <>
          <Button
            title={payouts.connected ? 'Finish payout setup' : 'Set up payouts'}
            onPress={() => act(setUpPayouts)}
            style={{ marginTop: space.md }}
          />
          <Text style={[styles.muted, { marginTop: space.sm }]}>
            {payouts.connected
              ? 'Stripe still needs a few details before you can be paid.'
              : 'Opens Stripe to add your bank details. Takes about 5 minutes.'}
          </Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: space.xs },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  currency: { color: colors.text, fontSize: 22, fontWeight: '700' },
  input: {
    width: 96,
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
});
