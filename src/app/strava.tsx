import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

// Strava sign-in returns here. In the web preview this closes the sign-in popup and hands the
// result to the waiting screen; on a phone the browser sheet catches the address before it opens.
WebBrowser.maybeCompleteAuthSession();

export default function StravaReturn() {
  return <Redirect href="/settings" />;
}
