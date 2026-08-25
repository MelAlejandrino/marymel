"use client";

import { useEffect, useSyncExternalStore } from "react";

import { findNearest, type Interactable } from "./nearest.ts";

/**
 * Objects register themselves here; the player controller asks what's nearby
 * each frame. Nothing hardcodes "if door then ..." (PLAN §18).
 */
const registry = new Map<string, Interactable>();

let active: Interactable | null = null;
/**
 * What the prompt currently reads. Comparing ids alone was not enough: an
 * object that changes state without moving — a door that opens — kept showing
 * the label it had when you first walked up to it.
 */
let activeSignature = "";
const listeners = new Set<() => void>();

function signatureOf(item: Interactable | null): string {
  return item ? `${item.id}|${item.verb}|${item.label}|${item.enabled}` : "";
}

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Register for the lifetime of a component. */
export function useInteractable(def: Interactable | null) {
  const id = def?.id;

  useEffect(() => {
    if (!def) return;
    registry.set(def.id, def);
    return () => {
      registry.delete(def.id);
      if (active?.id === def.id) {
        active = null;
        activeSignature = "";
        notify();
      }
    };
    // Re-registering on every field change would thrash; the object is
    // re-read from the map on each frame, so only identity matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Keep mutable fields fresh without re-subscribing.
  useEffect(() => {
    if (def) registry.set(def.id, def);
  });
}

/**
 * Recompute the prompt. Called every frame from the player controller, but
 * only notifies React when the answer actually changes — so walking around
 * costs zero re-renders until a prompt appears or disappears.
 */
export function updateNearest(player: { x: number; z: number }) {
  const next = findNearest([...registry.values()], player);
  const signature = signatureOf(next);
  // Compare what the prompt would say, not just which object it points at, so
  // a change of state re-renders while a change of nothing stays free.
  if (signature === activeSignature) return;
  active = next;
  activeSignature = signature;
  notify();
}

/** Fire the active interaction, if any. Returns whether something happened. */
export function triggerActive(): boolean {
  if (!active) return false;
  // Re-read from the registry: `active` may hold a stale closure.
  registry.get(active.id)?.onInteract();
  return true;
}

/** Test seam: the store is module state, so it has to be resettable. */
export function resetRegistry() {
  registry.clear();
  active = null;
  activeSignature = "";
  listeners.clear();
}

export function registerInteractable(def: Interactable) {
  registry.set(def.id, def);
}

export function subscribeToActive(listener: () => void) {
  return subscribe(listener);
}

export function getActive(): Interactable | null {
  return active;
}

const getSnapshot = () => active;
const getServerSnapshot = () => null;

/** Subscribe the HUD to the current prompt. */
export function useActiveInteraction(): Interactable | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export { type Interactable, type InteractionVerb } from "./nearest.ts";
