// Each feature keeps its own dictionary so pages can be translated independently.
// Keys must be identical in `en` and `fr`.
export interface LocaleDictionary {
  en: Record<string, string>;
  fr: Record<string, string>;
}
