'use client';

import { useEffect } from 'react';

// Every plain table of the app gets clickable headers with the up / down arrow (click: A to Z, click again: Z to A).
// It works on the page itself, so no table needs its own code. A table is left alone when sorting would break it:
// it already has its own sort (a button or arrow in the header), it has more than one header row, its rows are joined (rowSpan)
// or hold an opened detail row, or it is part of a PDF / printed document (data-no-sort, #invoice-pdf-container, data-pdf-block).

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, agt: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11 };
const DIM = '#5b6f9a';
const LIT = '#f5d77f';

type Key = { n: number | null; s: string };

/** "Rp 1.234.567", "1.234,5", "12x", "5%", "-Rp 20.000", "05 Nov 2026", "2026-11-05" -> a number to compare; text stays text. */
export function keyOf(cell: Element | undefined): Key {
  if (!cell) return { n: null, s: '' };
  const raw = (cell.textContent || '').replace(/\s+/g, ' ').trim();
  if (!raw) {
    // an icon column (green check / amber draft / empty circle)
    const html = (cell as HTMLElement).innerHTML || '';
    return { n: /emerald|green/.test(html) ? 2 : /amber|yellow/.test(html) ? 1 : 0, s: '' };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return { n: Date.UTC(+iso[1], +iso[2] - 1, +iso[3]), s: raw };
  const dmy = /^(\d{1,2})[\s/-]([A-Za-z]{3,})[a-z]*[\s,/-]*(\d{4})/.exec(raw);
  if (dmy && MONTHS[dmy[2].toLowerCase().slice(0, 3)] !== undefined) return { n: Date.UTC(+dmy[3], MONTHS[dmy[2].toLowerCase().slice(0, 3)], +dmy[1]), s: raw };
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw);
  if (slash) return { n: Date.UTC(+slash[3], +slash[2] - 1, +slash[1]), s: raw };
  const neg = /^[-−(]/.test(raw) || /^[+]?\s*-/.test(raw.replace(/^Rp\s*/i, ''));
  const body = raw.replace(/Rp|IDR|[$%x×+\-−()]/gi, '').replace(/\s/g, '');
  if (/^[\d.,]+$/.test(body) && /\d/.test(body)) {
    let t = body;
    const dot = t.lastIndexOf('.');
    const comma = t.lastIndexOf(',');
    if (dot >= 0 && comma >= 0) t = dot > comma ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.');
    else if (comma >= 0) t = /,\d{1,2}$/.test(t) && t.split(',').length === 2 ? t.replace(',', '.') : t.replace(/,/g, '');
    else if (dot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // "1.234.567" is thousands; "7.77" stays a decimal
    const v = Number(t);
    if (Number.isFinite(v)) return { n: neg ? -v : v, s: raw };
  }
  return { n: null, s: raw.toLowerCase() };
}

export const compare = (a: Key, b: Key) => {
  if (a.n !== null && b.n !== null) return a.n - b.n;
  if (a.n !== null) return -1; // numbers before text
  if (b.n !== null) return 1;
  return a.s.localeCompare(b.s, 'id', { numeric: true, sensitivity: 'base' });
};

const skipped = (t: HTMLTableElement) =>
  !!t.closest('[data-no-sort], #invoice-pdf-container, [data-pdf-block], [data-report-all]') || !t.tHead || t.tHead.rows.length !== 1;

/** Which header cells can sort: they have text and nothing interactive of their own. */
function sortableHeads(t: HTMLTableElement): HTMLTableCellElement[] {
  const cells = Array.from(t.tHead!.rows[0].cells);
  if (cells.length < 2) return [];
  if (cells.some((c) => c.colSpan > 1 || c.querySelector('button, a, input, select, svg:not([data-auto-sort])'))) return [];
  return cells;
}

/** Sorting would break a table whose rows are joined or have an opened detail row. */
function sortable(t: HTMLTableElement): boolean {
  const body = t.tBodies[0];
  if (!body) return false;
  const rows = Array.from(body.rows);
  if (rows.length < 2) return false;
  const n = t.tHead!.rows[0].cells.length;
  return rows.every((r) => r.cells.length === n && Array.from(r.cells).every((c) => c.rowSpan <= 1 && c.colSpan <= 1));
}

export function AutoSortTables() {
  useEffect(() => {
    const state = new WeakMap<HTMLTableElement, { col: number; asc: boolean } | null>();
    const enhanced = new WeakSet<HTMLTableElement>();

    const paint = (t: HTMLTableElement) => {
      const cur = state.get(t) || null;
      Array.from(t.tHead!.rows[0].cells).forEach((th, i) => {
        const svg = th.querySelector('svg[data-auto-sort]');
        if (!svg) return;
        (svg.querySelector('.up') as SVGElement | null)?.setAttribute('fill', cur?.col === i && cur.asc ? LIT : DIM);
        (svg.querySelector('.dn') as SVGElement | null)?.setAttribute('fill', cur?.col === i && !cur.asc ? LIT : DIM);
      });
    };

    const apply = (t: HTMLTableElement) => {
      const cur = state.get(t);
      const body = t.tBodies[0];
      if (!cur || !body || !sortable(t)) return;
      const rows = Array.from(body.rows);
      const keyed = rows.map((r, i) => ({ r, i, k: keyOf(r.cells[cur.col]) }));
      // equal values keep the order they are in (not reversed with the direction), or every re-check would flip them again and the table would flicker
      keyed.sort((x, y) => compare(x.k, y.k) * (cur.asc ? 1 : -1) || x.i - y.i);
      // only touch the DOM when the order really changes (the page may be re-rendering the rows)
      if (keyed.every((x, i) => x.r === rows[i])) return;
      keyed.forEach((x) => body.appendChild(x.r));
    };

    const enhance = (t: HTMLTableElement) => {
      if (skipped(t)) return;
      const heads = sortableHeads(t);
      if (!heads.length || !sortable(t)) return;
      heads.forEach((th, i) => {
        const label = (th.textContent || '').trim();
        if (!label || /^(actions?|aksi|#)$/i.test(label) || th.querySelector('svg[data-auto-sort]')) return;
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        th.title = th.title || 'Click to sort';
        const wrap = document.createElement('span');
        wrap.style.cssText = 'display:inline-flex;margin-left:6px;vertical-align:middle';
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', '9'); svg.setAttribute('height', '14'); svg.setAttribute('viewBox', '0 0 9 14'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('data-auto-sort', '1');
        svg.style.flex = 'none';
        for (const [cls, d] of [['up', 'M4.5 0.5 L8.5 5.5 L0.5 5.5 Z'], ['dn', 'M4.5 13.5 L0.5 8.5 L8.5 8.5 Z']]) {
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('class', cls); p.setAttribute('d', d); p.setAttribute('fill', DIM);
          svg.appendChild(p);
        }
        wrap.appendChild(svg);
        th.appendChild(wrap);
        th.addEventListener('click', () => {
          if (!sortable(t)) return;
          const cur = state.get(t);
          state.set(t, { col: i, asc: cur?.col === i ? !cur.asc : true });
          apply(t);
          paint(t);
        });
      });
      enhanced.add(t);
      state.set(t, state.get(t) || null);
    };

    let frame = 0;
    let working = false;
    const scan = () => {
      frame = 0;
      working = true;
      document.querySelectorAll('table').forEach((t) => {
        if (enhanced.has(t)) { apply(t); paint(t); } else enhance(t);
      });
      working = false;
    };
    const schedule = () => { if (!working && !frame) frame = requestAnimationFrame(scan); };

    scan();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return null;
}
