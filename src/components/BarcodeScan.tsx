import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { itemForGrams, normalizeBarcode, type Product } from '../lib/barcode';
import type { FoodItem } from '../lib/nutrition';
import { colors, radius, space, type } from '../lib/theme';
import { BarcodeError, lookupBarcode } from '../services/barcode';
import { Icon } from './Icon';
import { MacroLine } from './Nutrition';
import { Button, Card, Chip } from './ui';

type State =
  | { status: 'scanning' }
  | { status: 'looking'; code: string }
  | { status: 'found'; product: Product }
  | { status: 'missing'; code: string }
  | { status: 'error'; message: string };

/** Scan a packet (or type its barcode) and pick how much you had. */
export function BarcodeScan({ onAdd }: { onAdd: (item: FoodItem) => void }) {
  const db = useSQLiteContext();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ status: 'scanning' });
  const [typed, setTyped] = useState('');
  const [portion, setPortion] = useState<'serving' | '100' | 'custom'>('serving');
  const [grams, setGrams] = useState('');
  // The camera reports the same code many times a second; handle only the first.
  const busy = useRef(false);
  const camera = Platform.OS !== 'web';

  const look = async (raw: string) => {
    const code = normalizeBarcode(raw);
    if (!code) {
      setState({ status: 'error', message: 'That doesn’t look like a full barcode. Check the numbers under the bars.' });
      busy.current = false;
      return;
    }
    setState({ status: 'looking', code });
    try {
      const product = await lookupBarcode(db, code);
      if (product) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPortion(product.servingGrams ? 'serving' : '100');
        setGrams('');
        setState({ status: 'found', product });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setState({ status: 'missing', code });
      }
    } catch (e) {
      setState({ status: 'error', message: e instanceof BarcodeError ? e.message : 'Something went wrong. Try again.' });
    }
  };

  const onScanned = (r: BarcodeScanningResult) => {
    if (busy.current || state.status !== 'scanning') return;
    busy.current = true;
    look(r.data);
  };

  const again = () => {
    busy.current = false;
    setTyped('');
    setState({ status: 'scanning' });
  };

  if (state.status === 'found') {
    const p = state.product;
    const g = portion === 'serving' && p.servingGrams ? p.servingGrams : portion === '100' ? 100 : Number(grams);
    const label = portion === 'serving' && p.servingGrams ? `1 serving (${p.servingLabel ?? `${p.servingGrams} g`})` : undefined;
    const item = g > 0 ? itemForGrams(p, g, label) : null;
    return (
      <Card style={{ marginTop: space.md }}>
        <Text style={type.title}>{p.name}</Text>
        {p.brand && <Text style={styles.muted}>{p.brand}</Text>}
        <Text style={[styles.muted, { marginTop: space.xs }]}>Per 100 g: {p.per100g.calories} kcal</Text>
        <View style={styles.chips}>
          {p.servingGrams && <Chip label={`1 serving · ${p.servingGrams} g`} selected={portion === 'serving'} onPress={() => setPortion('serving')} />}
          <Chip label="100 g" selected={portion === '100'} onPress={() => setPortion('100')} />
          <Chip label="Other amount" selected={portion === 'custom'} onPress={() => setPortion('custom')} />
        </View>
        {portion === 'custom' && (
          <View style={styles.gramsRow}>
            <TextInput
              style={styles.grams}
              value={grams}
              onChangeText={setGrams}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Amount in grams"
              autoFocus
            />
            <Text style={styles.muted}>grams</Text>
          </View>
        )}
        {item && (
          <View style={{ marginTop: space.sm }}>
            <Text style={[type.number, { fontSize: 22 }]}>{item.calories} kcal</Text>
            <MacroLine m={item} />
          </View>
        )}
        <View style={styles.buttons}>
          <Button title="Add to meal" onPress={() => item && (onAdd(item), again())} style={{ flex: 1 }} />
          <Button title="Rescan" variant="secondary" onPress={again} style={{ flex: 1 }} />
        </View>
        <Text style={styles.credit}>Product data from Open Food Facts</Text>
      </Card>
    );
  }

  return (
    <View style={{ marginTop: space.md }}>
      {camera && state.status === 'scanning' && (
        permission?.granted ? (
          <View style={styles.cameraBox}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
              onBarcodeScanned={onScanned}
            />
            <View style={styles.frame} pointerEvents="none" />
            <Text style={styles.hint}>Point at the barcode</Text>
          </View>
        ) : (
          <Card style={{ alignItems: 'center', paddingVertical: space.lg }}>
            <Icon name="barcode" size={32} color={colors.accent} />
            <Text style={[type.title, { marginTop: space.sm, textAlign: 'center' }]}>Scan a packet</Text>
            <Text style={[styles.muted, { textAlign: 'center' }]}>Calories and macros fill in from the barcode.</Text>
            {permission && !permission.canAskAgain ? (
              <Button title="Turn on camera in Settings" variant="secondary" onPress={() => Linking.openSettings()} style={{ marginTop: space.md, alignSelf: 'stretch' }} />
            ) : (
              <Button title="Allow camera" onPress={requestPermission} style={{ marginTop: space.md, alignSelf: 'stretch' }} />
            )}
          </Card>
        )
      )}
      {state.status === 'looking' && (
        <View style={styles.looking} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.lookingText}>Looking up {state.code}…</Text>
        </View>
      )}
      {state.status === 'missing' && (
        <Card style={{ marginTop: space.sm }}>
          <Text style={type.title}>Not found</Text>
          <Text style={styles.muted}>{state.code} isn’t in the food database yet. Add it by hand under Search, using the label on the pack.</Text>
          <Button title="Scan another" variant="secondary" onPress={again} style={{ marginTop: space.md }} />
        </Card>
      )}
      {state.status === 'error' && (
        <Card style={{ marginTop: space.sm }}>
          <Text style={[styles.muted, { color: colors.warning }]}>{state.message}</Text>
          <Button title="Try again" variant="secondary" onPress={again} style={{ marginTop: space.md }} />
        </Card>
      )}
      {(state.status === 'scanning' || state.status === 'error') && (
        <View style={styles.typed}>
          <TextInput
            style={styles.typedInput}
            value={typed}
            onChangeText={setTyped}
            keyboardType="number-pad"
            placeholder={camera ? 'Or type the barcode' : 'Type the barcode'}
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={() => look(typed)}
            accessibilityLabel="Barcode number"
            maxLength={14}
          />
          <Button title="Look up" variant="secondary" onPress={() => look(typed)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 15, lineHeight: 21, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md },
  gramsRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grams: { width: 100, minHeight: 46, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  credit: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: space.md },
  cameraBox: { height: 260, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  frame: { width: '75%', height: 110, borderRadius: radius.md, borderWidth: 3, borderColor: colors.accent },
  hint: { position: 'absolute', bottom: space.md, color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  looking: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  lookingText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  typed: { flexDirection: 'row', gap: space.sm, marginTop: space.md, alignItems: 'center' },
  typedInput: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, fontSize: 17, paddingHorizontal: space.md, letterSpacing: 1 },
});
