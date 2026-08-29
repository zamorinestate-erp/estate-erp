# ZAMORIN CAFÉ ERP — FRONTEND LARGE DATASET OPTIMIZATIONS

> **Target UX**: 1,000-Outlet Selector / 50,000 Employees / 100,000 Devices UI  
> **Confidence Status**: **VERIFIED_LOCAL**  

---

## 1. 1,000-Outlet Global Scope Selector

Rendering 1,000 `<option>` tags inside a standard unvirtualized dropdown causes browser UI thread stutter.

### Optimizations
- **Searchable Typeahead Input**: Debounced filter querying café records dynamically.
- **Grouped Hierarchical Display**: Outlets grouped by City / Region (`Kozhikode`, `Kochi`, `Bengaluru`).
- **Bounded Result Rendering**: Top 50 matching outlets rendered in dropdown, with virtual scrolling for complete list navigation.

---

## 2. 50,000-Employee & 100,000-Device UI Tables

- **Zero Client-Side Full Dump**: Table never requests 50,000 rows simultaneously.
- **Server-Side Pagination Controls**: Requests strict 50-row chunks with total page count meta.
- **DOM Node Budget**: Maximum 100 table rows rendered in DOM at any instant.
- **Debounced Universal Search**: 300ms debounce before executing server-side `$regex` indexed query.
