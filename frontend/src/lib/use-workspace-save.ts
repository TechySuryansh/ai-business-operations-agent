'use client';

import { useEffect, useRef, useState } from 'react';
import { api, RequestError } from './backend-client';

interface PendingSave {
  key: string;
  encoded: string;
  version: number;
}

export function useWorkspaceSave(
  path: string | undefined,
  encoded: string,
  initialVersion: number,
) {
  const version = useRef(initialVersion);
  const saved = useRef(encoded);
  const pending = useRef<PendingSave | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    retryable: boolean;
    encoded: string;
  }>();
  const [attempt, setAttempt] = useState(0);
  const [confirmedVersion, setConfirmedVersion] = useState(initialVersion);

  useEffect(() => {
    if (!path || saving || (!pending.current && saved.current === encoded)) return;
    if (failure) {
      if (!failure.retryable && failure.encoded === encoded) return;
      if (failure.retryable && attempt > 2) return;
    }

    const timer = setTimeout(
      async () => {
        // An ambiguous failure may have committed. Replay the exact request before sending newer edits.
        const request = pending.current ?? {
          key: crypto.randomUUID(),
          encoded,
          version: version.current,
        };
        pending.current = request;
        setSaving(true);
        try {
          const result = await api<{ version: number }>(
            path,
            {
              version: request.version,
              data: JSON.parse(request.encoded),
            },
            request.key,
          );
          if (!Number.isSafeInteger(result?.version) || result.version <= request.version) {
            throw new RequestError('The server did not confirm the settings version. Try again.');
          }
          saved.current = request.encoded;
          version.current = Math.max(version.current, result.version);
          setConfirmedVersion(version.current);
          pending.current = null;
          setFailure(undefined);
          setAttempt(0);
        } catch (error) {
          const limited = error instanceof RequestError && error.status === 429;
          const retryable = error instanceof RequestError && (error.retryable || limited);
          if (!retryable) pending.current = null;
          setFailure({
            message:
              error instanceof RequestError && error.status === 409
                ? 'Settings changed on the server. Your edits are still here. Reopen the workspace to review the latest settings before applying them again.'
                : (error as Error).message,
            retryable,
            encoded: request.encoded,
          });
          if (retryable) setAttempt((value) => (limited ? 3 : value + 1));
        } finally {
          setSaving(false);
        }
      },
      failure?.retryable ? 1000 : 600,
    );
    return () => clearTimeout(timer);
  }, [path, encoded, saving, failure, attempt, confirmedVersion]);

  return {
    saving,
    error: failure?.message,
    retry: failure?.retryable
      ? () => {
          setFailure(undefined);
          setAttempt(0);
        }
      : undefined,
    acceptServerState(serverVersion: number, serverEncoded: string) {
      if (pending.current || saved.current !== encoded || serverVersion < version.current)
        return false;
      version.current = serverVersion;
      saved.current = serverEncoded;
      return true;
    },
  };
}
