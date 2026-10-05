import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { budget, earnings, isShare, money, num, otherPerson, PEOPLE, setShare, toggleShare, uid } from '../lib/model';
import { confirmRemove } from './confirm';
import { AddRow, SetField } from './SetField';
import { Donut } from './BudgetCard';
const MODES = [['spent', 'As spent'], ['fixed', 'Fixed'], ['share', 'Share of left']];
export default function BudgetPage({ D, update }) {
    const b = budget(D);
    const [adding, setAdding] = useState(null);
    const [incName, setIncName] = useState('');
    const [incAmt, setIncAmt] = useState('');
    const [incPerson, setIncPerson] = useState('ella');
    const [catName, setCatName] = useState('');
    const [catTotal, setCatTotal] = useState('');
    const setCat = (id, f) => (v) => {
        if (f === 'name' && !v.trim())
            return;
        update(x => { const c = x.cats.find(c => c.id === id); if (c) {
            if (f === 'name')
                c.name = v.trim();
            else
                c[f] = num(v);
        } });
    };
    const setInc = (id, f) => (v) => {
        if (f === 'name' && !v.trim())
            return;
        update(x => { const z = x.incomes.find(z => z.id === id); if (z) {
            if (f === 'name')
                z.name = v.trim();
            else
                z.amount = num(v);
        } });
    };
    /** Each category fills one of three ways: as you log spends, always full, or from what's left. */
    const setMode = (c, m) => update(x => {
        const z = x.cats.find(z => z.id === c.id);
        if (!z)
            return;
        if (m === 'share') {
            if (!isShare(z))
                toggleShare(x.cats, z.id);
            return;
        }
        if (isShare(z))
            toggleShare(x.cats, z.id, c);
        z.fixed = m === 'fixed';
    });
    const addIncome = () => {
        const n = incName.trim();
        if (!n)
            return;
        const inc = { id: uid(), name: n, person: incPerson, amount: num(incAmt) };
        update(x => { x.incomes.push(inc); });
        setIncName('');
        setIncAmt('');
        setAdding(null);
    };
    const addCat = () => {
        const n = catName.trim();
        if (!n)
            return;
        const half = Math.round(num(catTotal) * 50) / 100;
        const cat = { id: uid(), name: n, ella: half, jackson: half };
        update(x => { x.cats.push(cat); });
        setCatName('');
        setCatTotal('');
        setAdding(null);
    };
    const draftP = PEOPLE[incPerson];
    const shares = b.cats.filter(c => c.pct !== null);
    const ELLA = '#A9477B', JACKSON = '#1B6B56';
    return (_jsxs("div", { className: "budget-page", children: [_jsxs("section", { className: "card budget-hero", children: [_jsxs("div", { className: "hero-person", children: [_jsx("span", { className: "hero-label", children: "Ella has left" }), _jsx("span", { className: "hero-big", style: { color: ELLA }, children: money(b.ellaLeft) }), _jsxs("span", { className: "hero-sub", children: ["of ", money(earnings(D, 'ella')), " income"] })] }), _jsxs("div", { className: "hero-person", children: [_jsx("span", { className: "hero-label", children: "Jackson has left" }), _jsx("span", { className: "hero-big", style: { color: JACKSON }, children: money(b.jacksonLeft) }), _jsxs("span", { className: "hero-sub", children: ["of ", money(earnings(D, 'jackson')), " income"] })] }), _jsxs("div", { className: "hero-stat", children: [_jsx("span", { className: "hero-label", children: "Income" }), _jsx("span", { className: "hero-mid", children: money(b.income) }), _jsx("span", { className: "hero-label", style: { marginTop: 8 }, children: "Committed" }), _jsx("span", { className: "hero-mid", children: money(b.spend) })] }), _jsx("div", { className: "hero-donut", children: _jsxs(Donut, { slices: b.slices, size: 150, hole: 20, children: [_jsx("span", { style: { fontSize: 11 }, className: "muted", children: "Spending" }), _jsx("span", { style: { fontSize: 16, fontWeight: 600 }, children: money(b.spend) })] }) })] }), _jsxs("section", { className: "card", style: { padding: 18 }, children: [_jsxs("div", { className: "card-title", children: ["Income ", _jsx("span", { className: "sub", children: "per week" }), _jsx("span", { className: "card-title-end", children: money(b.income) })] }), _jsxs("div", { className: "list", children: [D.incomes.map(i => {
                                const p = PEOPLE[i.person];
                                return (_jsxs("div", { className: "income-line", children: [_jsx("button", { className: "person-tag", title: "Tap to switch person", style: { height: 'var(--h-xs)', background: p.tint, color: p.ink }, onClick: () => update(x => { const z = x.incomes.find(z => z.id === i.id); if (z)
                                                z.person = otherPerson(z.person); }), children: p.name }), _jsx(SetField, { value: i.name, onCommit: setInc(i.id, 'name'), label: "Income name" }), _jsx(SetField, { value: String(num(i.amount)), display: money(num(i.amount)), onCommit: setInc(i.id, 'amount'), label: i.name + ' per week', numeric: true, align: "right", strong: true }), _jsx("button", { className: "link-btn", onClick: () => { if (confirmRemove('this income'))
                                                update(x => { x.incomes = x.incomes.filter(z => z.id !== i.id); }); }, children: "Remove" })] }, i.id));
                            }), !D.incomes.length && _jsx("p", { className: "empty", style: { margin: '4px 0' }, children: "No income yet." })] }), _jsx(AddRow, { label: "Add income", open: adding === 'income', onOpen: () => setAdding('income'), children: _jsxs("div", { className: "add-open-row", children: [_jsx("button", { className: "person-tag", title: "Switch person", style: { height: 'var(--h-sm)', minWidth: 76, background: draftP.tint, color: draftP.ink }, onClick: () => setIncPerson(otherPerson(incPerson)), children: draftP.name }), _jsx("input", { className: "field-sm compact", style: { flex: '1 1 120px' }, autoFocus: true, value: incName, onChange: e => setIncName(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                        addIncome(); }, placeholder: "e.g. Salary", "aria-label": "Income name" }), _jsx("input", { className: "field-sm compact money", value: incAmt, onChange: e => setIncAmt(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                        addIncome(); }, placeholder: "$ a week", inputMode: "decimal", "aria-label": "Amount per week" }), _jsx("button", { className: "pill-sm dark", onClick: addIncome, children: "Add" }), _jsx("button", { className: "link-btn", onClick: () => setAdding(null), children: "Cancel" })] }) })] }), _jsxs("section", { className: "card", style: { padding: 18 }, children: [_jsxs("div", { className: "card-title", children: ["Spending ", _jsx("span", { className: "sub", children: "per week" }), _jsx("span", { className: "card-title-end", children: money(b.spend) })] }), _jsxs("div", { className: "cat-line cat-head", children: [_jsx("span", { className: "c-name", children: "Category" }), _jsx("span", { className: "c-mode", children: "Fills" }), _jsx("span", { className: "c-ella", style: { color: ELLA }, children: "Ella" }), _jsx("span", { className: "c-jack", style: { color: JACKSON }, children: "Jackson" }), _jsx("span", { className: "c-total", children: "Total" }), _jsx("span", { className: "c-remove" })] }), _jsx("div", { className: "list", children: b.cats.map(c => {
                            const mode = c.fixed ? 'fixed' : c.pct !== null ? 'share' : 'spent';
                            const grocery = /grocer/i.test(c.name);
                            return (_jsxs("div", { className: "cat-line", children: [_jsxs("span", { className: "c-name", children: [_jsx("span", { className: "dot8", style: { background: c.color, flex: 'none' } }), _jsx(SetField, { value: c.name, onCommit: setCat(c.id, 'name'), label: "Category name", strong: true })] }), _jsxs("span", { className: "c-mode", children: [_jsx("select", { className: "section-select", value: mode, "aria-label": 'How ' + c.name + ' fills', onChange: e => setMode(c, e.target.value), children: MODES.filter(([m]) => m !== 'share' || !grocery).map(([m, l]) => _jsx("option", { value: m, children: l }, m)) }), mode === 'share' && shares.length > 1 && (_jsx("span", { style: { width: 52, flex: 'none' }, children: _jsx(SetField, { value: String(Math.round(c.pct * 10) / 10), display: Math.round(c.pct * 10) / 10 + '%', numeric: true, align: "right", label: c.name + ' percentage of what’s left', onCommit: v => { const n = parseFloat(v); if (!isNaN(n))
                                                        update(x => setShare(x.cats, c.id, n)); } }) }))] }), c.pct !== null ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "c-ella budget-calc", style: { color: ELLA }, children: money(c.e) }), _jsx("span", { className: "c-jack budget-calc", style: { color: JACKSON }, children: money(c.j) })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "c-ella", children: _jsx(SetField, { value: String(num(c.ella)), display: money(num(c.ella)), onCommit: setCat(c.id, 'ella'), label: 'Ella, ' + c.name, numeric: true, align: "right", color: ELLA }) }), _jsx("span", { className: "c-jack", children: _jsx(SetField, { value: String(num(c.jackson)), display: money(num(c.jackson)), onCommit: setCat(c.id, 'jackson'), label: 'Jackson, ' + c.name, numeric: true, align: "right", color: JACKSON }) })] })), _jsx("span", { className: "c-total", children: money(c.total) }), _jsx("span", { className: "c-remove", children: _jsx("button", { className: "link-btn", onClick: () => { if (confirmRemove('the “' + c.name + '” category'))
                                                update(x => { x.cats = x.cats.filter(z => z.id !== c.id); }); }, children: "Remove" }) })] }, c.id));
                        }) }), _jsxs(AddRow, { label: "Add category", open: adding === 'category', onOpen: () => setAdding('category'), children: [_jsxs("div", { className: "add-open-row", children: [_jsx("input", { className: "field-sm compact", style: { flex: '1 1 140px' }, autoFocus: true, value: catName, onChange: e => setCatName(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                            addCat(); }, placeholder: "e.g. Internet", "aria-label": "Category name" }), _jsx("input", { className: "field-sm compact money", value: catTotal, onChange: e => setCatTotal(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                            addCat(); }, placeholder: "$ total", inputMode: "decimal", "aria-label": "Total per week" }), _jsx("button", { className: "pill-sm dark", onClick: addCat, children: "Add" }), _jsx("button", { className: "link-btn", onClick: () => setAdding(null), children: "Cancel" })] }), _jsx("span", { className: "note", children: "Split 50/50 between you; change it after." })] }), _jsxs("p", { className: "note", style: { margin: '14px 0 0' }, children: ["Tap anything underlined to change it. ", _jsx("strong", { children: "As spent" }), " fills as you log spends, ", _jsx("strong", { children: "Fixed" }), " is always full, and ", _jsx("strong", { children: "Share of left" }), " splits what\u2019s left", shares.length ? ' (' + listOf(shares.map(c => c.name)) + ')' : '', "."] })] })] }));
}
const listOf = (names) => (names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
