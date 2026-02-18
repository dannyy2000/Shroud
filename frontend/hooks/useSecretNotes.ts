"use client";

import { useState, useEffect, useCallback } from "react";

export interface SecretNote {
  id: string;
  secret: string;
  nullifier: string;
  commitment: string;
  tier: number;
  leafIndex: number;
  timestamp: number;
  used: boolean; // marked true after betting
  marketId?: number; // which market it was used on
  betCommitment?: string; // the bet commitment if used
}

const STORAGE_KEY = "shroud_secret_notes";

function loadNotes(): SecretNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: SecretNote[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function useSecretNotes() {
  const [notes, setNotes] = useState<SecretNote[]>([]);

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  const addNote = useCallback((note: SecretNote) => {
    setNotes((prev) => {
      const next = [...prev, note];
      saveNotes(next);
      return next;
    });
  }, []);

  const markUsed = useCallback(
    (noteId: string, marketId: number, betCommitment: string) => {
      setNotes((prev) => {
        const next = prev.map((n) =>
          n.id === noteId ? { ...n, used: true, marketId, betCommitment } : n,
        );
        saveNotes(next);
        return next;
      });
    },
    [],
  );

  const removeNote = useCallback((noteId: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== noteId);
      saveNotes(next);
      return next;
    });
  }, []);

  const exportNotes = useCallback(() => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shroud-secrets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [notes]);

  const unusedNotes = notes.filter((n) => !n.used);
  const usedNotes = notes.filter((n) => n.used);

  return { notes, unusedNotes, usedNotes, addNote, markUsed, removeNote, exportNotes };
}
