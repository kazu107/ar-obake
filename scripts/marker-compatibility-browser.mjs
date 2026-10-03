// Reuse the complete production AR game path with the previously printed cards.
process.argv.push('--hiragana-markers');
await import('./game-real-ar.mjs');
