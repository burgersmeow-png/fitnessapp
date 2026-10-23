import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { checkUsername } from '../../lib/social';
import { colors, radius, space, type } from '../../lib/theme';
import { createProfile, signIn, signUp, SocialError } from '../../services/social';
import { Button } from '../ui';

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ marginTop: space.md }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput placeholderTextColor={colors.textMuted} {...props} style={styles.input} accessibilityLabel={props.label} />
    </View>
  );
}

const message = (e: unknown) => (e instanceof SocialError ? e.message : 'Something went wrong. Try again.');

/** Sign in or create an account. */
export function SignInForm() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const submit = async () => {
    if (!email.includes('@')) return setNote('Enter your email.');
    if (password.length < 8) return setNote('Use a password of at least 8 characters.');
    setBusy(true);
    setNote(null);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else if ((await signUp(email, password)) === 'checkEmail') setNote('Check your email for a link to confirm your account, then sign in.');
    } catch (e) {
      setNote(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Text style={type.hero}>Train with friends</Text>
        <Text style={styles.lead}>
          See your friends’ workouts, give high-fives, and keep each other going with a weekly leaderboard. Only friends you accept see what you share.
        </Text>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.com" />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
          placeholder="At least 8 characters"
          onSubmitEditing={submit}
        />
        {note && <Text style={styles.note}>{note}</Text>}
        <Button title={busy ? 'One moment…' : mode === 'signUp' ? 'Create account' : 'Sign in'} onPress={submit} style={{ marginTop: space.lg }} />
        <Pressable onPress={() => { setMode(mode === 'signUp' ? 'signIn' : 'signUp'); setNote(null); }} accessibilityRole="button" style={styles.switch}>
          <Text style={styles.switchText}>{mode === 'signUp' ? 'Already have an account? Sign in' : 'New here? Create an account'}</Text>
        </Pressable>
        <Text style={styles.small}>Your workouts stay on your phone. Sharing only sends a summary of each finished session.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** First sign-in: pick how friends find you. */
export function UsernameForm({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const submit = async () => {
    const check = checkUsername(username);
    if (!check.ok) return setNote(check.reason);
    setBusy(true);
    setNote(null);
    try {
      await createProfile(check.username, name || check.username);
      onDone();
    } catch (e) {
      setNote(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={type.hero}>Pick a username</Text>
      <Text style={styles.lead}>Friends search for this to add you.</Text>
      <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="sam_lifts" />
      <Field label="Your name" value={name} onChangeText={setName} placeholder="Sam" textContentType="givenName" onSubmitEditing={submit} />
      {note && <Text style={styles.note}>{note}</Text>}
      <Button title={busy ? 'Saving…' : 'Continue'} onPress={submit} style={{ marginTop: space.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.md, paddingTop: space.lg },
  lead: { color: colors.textMuted, fontSize: 16, lineHeight: 22, marginTop: space.sm },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: {
    minHeight: 50,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: space.md,
  },
  note: { color: colors.warning, fontSize: 15, marginTop: space.md },
  switch: { alignSelf: 'center', padding: space.md },
  switchText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  small: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: space.sm },
});
