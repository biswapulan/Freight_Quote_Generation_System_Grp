/**
 * The matching rules behind the list toolbars.
 *
 * Every desk filters client-side over the rows it already holds, and they all
 * have to agree on two things: an empty search shows everything, and a dropdown
 * left on "all" excludes nothing. Those rules live here as plain functions so
 * they can be reasoned about (and checked) without rendering a page.
 */

/** Any cell value as a comparable lowercase string; objects and blanks read as "". */
export function searchableText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return String(value).toLowerCase();
  if (Array.isArray(value)) return value.map(searchableText).join(" ");
  return "";
}

function readField(field, row) {
  return typeof field === "function" ? field(row) : row?.[field];
}

/**
 * Does one row match what was typed?
 *
 * `fields` are the columns the page shows — a name or a `row => value` getter.
 * A blank or whitespace-only search matches every row, so clearing the box
 * shows the whole list again.
 */
export function rowMatchesSearch(row, query, fields = []) {
  const term = (query || "").trim().toLowerCase();
  if (!term) return true;
  if (!fields.length) return false;
  return fields.some((field) => searchableText(readField(field, row)).includes(term));
}

/**
 * Does one row survive the dropdowns?
 *
 * Each entry is `{ value, matches }` where `matches(row, value)` answers for
 * that dropdown. "all" (or no value at all) accepts every row.
 */
export function rowMatchesFilters(row, filters = []) {
  return filters.every((filter) => {
    if (!filter) return true;
    const { value, matches } = filter;
    if (value === undefined || value === null || value === "" || value === "all") return true;
    return matches ? Boolean(matches(row, value)) : true;
  });
}

/** Search plus dropdowns over a list of rows. Never adds or drops rows by itself. */
export function filterRows(rows, { search = "", fields = [], filters = [] } = {}) {
  return rows.filter(
    (row) => rowMatchesSearch(row, search, fields) && rowMatchesFilters(row, filters),
  );
}

/**
 * Distinct values of `get(row)` as dropdown options.
 *
 * Used for lanes and modes, which vary per desk and are not worth hard-coding.
 * `labelOf` relabels a value for display (e.g. "ocean" -> "Ocean Freight");
 * callers that want an "All ..." entry get it from the filter's own `label`.
 */
export function optionsFrom(rows, get, labelOf) {
  const seen = new Map();
  rows.forEach((row) => {
    const value = get(row);
    if (value === undefined || value === null || value === "") return;
    if (!seen.has(value)) seen.set(value, labelOf ? labelOf(value) : String(value));
  });
  return Array.from(seen, ([value, label]) => ({ value, label })).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}
