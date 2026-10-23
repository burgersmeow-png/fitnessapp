import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { creditFromLink } from '../services/creatorCode';

/** Credits the creator whose code came on the link this screen was opened from. Their name, once it is set. */
export function useLinkCredit(code: string | undefined): string | null {
  const db = useSQLiteContext();
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    creditFromLink(db, code).then(setName);
  }, [db, code]);
  return name;
}
