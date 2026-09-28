export type WordlistKind = "table" | "bucket" | "function"

export type SavedWordlist = {
  name: string
  words: string[]
  kind: WordlistKind
}

function storageKey(kind: WordlistKind): string {
  return `supasec-wordlists-${kind}`
}

export function loadWordlists(kind: WordlistKind): SavedWordlist[] {
  try {
    const raw = localStorage.getItem(storageKey(kind))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (w: unknown): w is SavedWordlist =>
        typeof w === "object" &&
        w !== null &&
        "name" in w &&
        "words" in w &&
        typeof (w as SavedWordlist).name === "string" &&
        Array.isArray((w as SavedWordlist).words),
    )
  } catch {
    return []
  }
}

export function saveWordlist(wl: SavedWordlist): void {
  try {
    const existing = loadWordlists(wl.kind)
    const idx = existing.findIndex((w) => w.name === wl.name)
    if (idx >= 0) {
      existing[idx] = wl
    } else {
      existing.push(wl)
    }
    localStorage.setItem(storageKey(wl.kind), JSON.stringify(existing))
  } catch {
    // storage full or unavailable
  }
}

export function deleteWordlist(kind: WordlistKind, name: string): void {
  try {
    const existing = loadWordlists(kind)
    const filtered = existing.filter((w) => w.name !== name)
    localStorage.setItem(storageKey(kind), JSON.stringify(filtered))
  } catch {
    // ignore
  }
}
