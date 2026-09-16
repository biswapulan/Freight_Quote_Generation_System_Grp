import { useId } from "react";
import { Search } from "lucide-react";
import "./ListFilterBar.css";

/**
 * The list toolbar every desk shares: a search box, dropdown filters, Clear and
 * a count of what is currently on screen.
 *
 * Purely presentational. It holds no rows and matches nothing itself — the page
 * keeps the rows and decides which of them are visible, so each desk can search
 * the fields it actually displays while every desk's toolbar looks and behaves
 * the same. This is the toolbar that used to be hand-written inside
 * RetailShipmentsHistory; its markup, classes and styling are copied here so
 * the two cannot drift apart.
 *
 * `filters` entries are `{ key, label, value, options }`, where `label` doubles
 * as the "everything" option ("All lanes") and `options` are the real choices
 * as `{ value, label }`. `ariaLabel` renames the control for screen readers
 * when the visible wording would not describe it ("All Time"). `onFilterChange
 * (key, value)` is told which dropdown moved so the page can keep one piece of
 * state per filter.
 *
 * Any `children` (a table, a card list) render inside the same card, below the
 * controls.
 */
export default function ListFilterBar({
  search = "",
  onSearch,
  searchPlaceholder = "Search...",
  searchLabel = "Search this list",
  filters = [],
  onFilterChange,
  onClear,
  resultCount,
  resultNoun = "results",
  children,
}) {
  // useId keeps the label/control pairing unique when several bars are on one
  // page — the customs desk renders one per tab.
  const id = useId();
  const searchId = `${id}-search`;

  return (
    <div className={`filter-card list-filter-bar${children ? " list-filter-bar--has-body" : ""}`}>
      <div className={`filter-controls${children ? " filter-controls--stacked" : ""}`}>
        <div className="search-input-wrap">
          <Search aria-hidden="true" />
          <label className="list-filter-label" htmlFor={searchId}>
            {searchLabel}
          </label>
          <input
            id={searchId}
            type="text"
            className="form-input"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>

        {filters.map((filter) => {
          const selectId = `${id}-${filter.key}`;
          return (
            <span key={filter.key} className="list-filter-field">
              {/* `label` is what the closed dropdown reads ("All Time"), so a
                  filter whose wording does not describe itself can name itself
                  for screen readers separately. */}
              <label className="list-filter-label" htmlFor={selectId}>
                {filter.ariaLabel || filter.label}
              </label>
              <select
                id={selectId}
                className="form-select"
                style={{ width: "auto" }}
                value={filter.value ?? "all"}
                onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
              >
                <option value="all">{filter.label}</option>
                {(filter.options || []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
          );
        })}

        <button type="button" className="btn-secondary-light" onClick={onClear}>
          Clear
        </button>

        {typeof resultCount === "number" && (
          <span className="results-count">
            {resultCount} {resultNoun}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}
