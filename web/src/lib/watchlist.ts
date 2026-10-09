// Lakes this browser watches. The subscription itself lives on the server (DynamoDB +
// SNS email); this list only remembers which lakes and address were used here.

export type Watched = { lake: string; name: string; email: string; since: string };

const KEY = "jalrekha.watchlist";

export function readWatchlist(): Watched[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Watched[];
  } catch {
    return [];
  }
}

export function writeWatchlist(items: Watched[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage unavailable (private mode): the server-side subscription still works
  }
}

export function addWatched(item: Watched) {
  writeWatchlist([...readWatchlist().filter((w) => !(w.lake === item.lake && w.email === item.email)), item]);
}

export function removeWatched(lake: string, email: string) {
  writeWatchlist(readWatchlist().filter((w) => !(w.lake === lake && w.email === email)));
}
