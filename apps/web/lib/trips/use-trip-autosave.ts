"use client";
import { useEffect, useRef, useState } from "react";
import { AutosaveQueue } from "./autosave-queue";
import {
  accountTripAdapter,
  AccountError,
  SignInRequired,
} from "./account-adapter";
import { mockTripAdapter, guestTripAdapter, type Trip } from "./adapter";
export type AccountReference = {
  id: string;
  tripEtag: string;
  versionEtag: string;
};
type Props = {
  trip: Trip;
  dirty: boolean;
  ready: boolean;
  signedIn: boolean;
  generation: number;
  account: AccountReference | null;
  onSaved: (
    trip: Trip,
    account: AccountReference | null,
    synced: boolean,
  ) => void;
};
type Result = { account: AccountReference | null; localOnly: boolean };
export function useTripAutosave(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const queue = useRef<AutosaveQueue<Trip, Result> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState("Saved on this device");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  useEffect(() => {
    if (!props.ready) return;
    let target = latest.current.account;
    const q = new AutosaveQueue<Trip, Result>(
      async (snapshot) => {
        await (
          latest.current.signedIn ? mockTripAdapter : guestTripAdapter
        ).save(snapshot);
        if (
          !latest.current.signedIn ||
          (!target &&
            !snapshot.origin.trim() &&
            !snapshot.title.trim() &&
            !snapshot.stops.length)
        )
          return { account: null, localOnly: true };
        // An unfinished date field may be saved locally until the API settings are valid.
        if (
          (snapshot.mode === "exact" && !snapshot.start) ||
          (snapshot.mode === "window" && (!snapshot.start || !snapshot.end))
        )
          return { account: target, localOnly: true };
        const saved = target
          ? await accountTripAdapter.save(snapshot, target)
          : await accountTripAdapter.create(snapshot);
        target = {
          id: saved.id,
          tripEtag: saved.tripEtag,
          versionEtag: saved.versionEtag,
        };
        return { account: target, localOnly: false };
      },
      {
        start: () => {
          setSaving(true);
          setStatus("Saving…");
          setError("");
        },
        saved: (snapshot, result) => {
          latest.current.onSaved(snapshot, result.account, !result.localOnly);
          const current =
            JSON.stringify(snapshot) === JSON.stringify(latest.current.trip);
          setStatus(
            current
              ? result.localOnly
                ? "Saved on this device"
                : "Saved to your account"
              : "Saving…",
          );
          setSaving(!current);
        },
        error: (failure) => {
          setSaving(false);
          setNeedsSignIn(failure instanceof SignInRequired);
          setStatus("Not synced");
          setConflict(
            failure instanceof AccountError && failure.status === 412,
          );
          setError(
            failure instanceof SignInRequired
              ? "Sign in again to sync. A copy is kept on this device."
              : failure instanceof Error
                ? failure.message
                : "Could not sync. Your edits remain here.",
          );
        },
      },
    );
    queue.current = q;
    setError("");
    setNeedsSignIn(false);
    setConflict(false);
    setSaving(false);
    setStatus(
      latest.current.signedIn && target
        ? "Saved to your account"
        : "Saved on this device",
    );
    return () => {
      q.dispose();
      if (timer.current) clearTimeout(timer.current);
      queue.current = null;
    };
  }, [props.ready, props.generation, props.signedIn]);
  useEffect(() => {
    if (!props.ready || !props.dirty || !queue.current) return;
    if (conflict) {
      void mockTripAdapter.save(props.trip).catch(() => {});
      return;
    }
    setStatus("Saving…");
    timer.current = setTimeout(() => {
      const currentQueue = queue.current;
      // Back up the latest edit even while an older network write is in flight.
      void (props.signedIn ? mockTripAdapter : guestTripAdapter)
        .save(props.trip)
        .then(() => {
          void currentQueue?.enqueue(props.trip);
          if (error && !conflict) void currentQueue?.retry();
        })
        .catch((failure) => {
          setSaving(false);
          setStatus("Not saved");
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not keep a device copy. Keep this page open and retry.",
          );
        });
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [props.trip, props.dirty, props.ready, props.signedIn, props.generation]);
  return {
    status,
    error,
    conflict,
    saving,
    needsSignIn,
    retry: () => void queue.current?.retry(),
    flush: async () => {
      if (timer.current) clearTimeout(timer.current);
      if (latest.current.dirty)
        await queue.current?.enqueue(latest.current.trip);
      await queue.current?.flush();
    },
  };
}
