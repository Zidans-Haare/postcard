const fs = require('fs');

const content = fs.readFileSync('Country+Uni.md', 'utf-8');
const lines = content.split('\n');

const countries = {};
let currentCountry = null;

// List of known countries to identify headers (simplified approach: if line has no tabs and is not a known noise line)
// Actually, looking at the file, countries are lines that don't look like universities or table data.
// A better heuristic:
// - Countries are usually single words or short phrases, no tabs.
// - Universities are followed by "Erasmus" or "Hochschulvereinbarung" or "Fakultätsvereinbarung" on the next lines?
// Let's try to identify countries by exclusion.

const noise = [
    "Erasmus", "Hochschulvereinbarung", "Fakultätsvereinbarung",
    "Fakultät", "Ansprechperson", "Plätze", "Doppelabschluss",
    "Swiss-European Mobility-Programme", "Erasmus-Partner"
];

const isNoise = (line) => {
    if (!line.trim()) return true;
    if (line.includes('\t')) return true; // Table data
    if (noise.some(n => line.includes(n))) return true;
    return false;
};

// Manual list of countries based on file inspection to be safe, or logic?
// The file format seems to be:
// Country Name
// <empty line>
// University Name
// Type (Erasmus etc)
// Table Header
// Table Rows...

// Let's try to detect the "Country" by the fact it's followed by an empty line and then a University?
// Or just hardcode the countries found in the file?
// Let's try to extract everything that looks like a header.

const result = {};
let currentKey = "";

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Heuristic: If line is short and has no tabs, it might be a country or a university.
    // Universities are often followed by "Erasmus" etc.
    // Countries are often followed by an empty line (in the source file, though split might eat it).

    // Let's look at the structure:
    // "Albanien" -> next line empty -> next line "University of Tirana"

    if (isNoise(line)) continue;

    // It's either a country or a university.
    // If it's a university, it's usually followed by "Erasmus", "Hochschulvereinbarung", etc.
    // If it's a country, it's usually followed by a University (after some space).

    // Let's assume the user provided list is consistent.
    // I'll print candidates to debug.
}

// Actually, let's just dump the non-noise lines and see if I can manually structure it or refine the script.
// Better: I will use a list of known countries from the file content I read.
const knownCountries = [
    "Albanien", "Australien", "Belgien", "Brasilien", "Bulgarien", "Chile", "China", "Costa Rica",
    "Estland", "Finnland", "Frankreich", "Georgien", "Ghana", "Griechenland", "Indien", "Irak",
    "Irland", "Israel", "Italien", "Japan", "Jordanien", "Kanada", "Kenia", "Lettland", "Litauen",
    "Malaysia", "Mexiko", "Mongolei", "Namibia", "Neuseeland", "Niederlande", "Österreich", "Peru",
    "Polen", "Portugal", "Republik Korea", "Russische Föderation", "Schweden", "Schweiz", "Slowakei",
    "Slowenien", "Spanien", "Südafrika", "Taiwan", "Trinidad und Tobago", "Tschechische Republik",
    "Türkei", "Ungarn", "Usbekistan", "Vereinigte Staaten", "Vereinigtes Königreich", "Vietnam"
];

let currentC = null;
const map = {};

lines.forEach(line => {
    const l = line.trim();
    if (!l) return;

    if (knownCountries.includes(l)) {
        currentC = l;
        if (!map[currentC]) map[currentC] = [];
    } else if (currentC && !isNoise(l)) {
        // It's likely a university
        // Check if it's not a table row (already checked by isNoise tab check)
        // Check if it's not a header like "Fakultät" (checked by isNoise)
        map[currentC].push(l);
    }
});

console.log(JSON.stringify(map, null, 2));
