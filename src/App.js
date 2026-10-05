import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useSyncExternalStore } from 'react';
import { householdKey, rememberHouseholdKey, supabase, supabaseBackend } from './lib/supabase';
import { HouseholdStore } from './lib/store';
import Household from './Household';
import { Logo } from './views/Logo';
function Message({ children }) {
    return (_jsxs("div", { className: "app", children: [_jsx("header", { className: "header", children: _jsx(Logo, {}) }), _jsx("p", { className: "empty", children: children })] }));
}
/** Asks for the household link, e.g. the first time the home-screen app opens on an iPhone. */
function LinkForm({ onKey, wrong }) {
    const [text, setText] = useState('');
    const [error, setError] = useState('');
    const submit = () => {
        const k = rememberHouseholdKey(text);
        if (k)
            onKey(k);
        else
            setError('That doesn’t look like a household link. Copy the whole link, including the part after #.');
    };
    return (_jsxs("div", { className: "app", children: [_jsx("header", { className: "header", children: _jsx(Logo, {}) }), _jsxs("section", { className: "card", style: { maxWidth: 440, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsx("div", { style: { fontWeight: 600 }, children: wrong ? 'This household link isn’t right' : 'Open your household' }), _jsx("div", { style: { fontSize: 13 }, className: "muted", children: wrong ? 'Check you copied the whole link, then paste it again.' : 'Paste your household link (the one you were sent) to get started. You only need to do this once on each device.' }), _jsx("input", { className: "field", value: text, onChange: e => { setText(e.target.value); setError(''); }, onKeyDown: e => { if (e.key === 'Enter')
                            submit(); }, placeholder: "https://\u2026/#\u2026", autoCapitalize: "off", autoCorrect: "off", spellCheck: false, inputMode: "url", "aria-label": "Household link" }), _jsx("button", { className: "pill dark", onClick: submit, children: "Open household" }), error && _jsx("div", { style: { fontSize: 13, color: '#A9477B' }, children: error })] })] }));
}
export default function App() {
    const [key, setKey] = useState(householdKey);
    const [wrong, setWrong] = useState(false);
    if (supabase && (!key || wrong))
        return _jsx(LinkForm, { wrong: wrong, onKey: k => { setWrong(false); setKey(k); } });
    return _jsx(Synced, { householdKey: key, onInvalid: () => setWrong(true) }, key ?? 'local');
}
function Synced({ householdKey: key, onInvalid }) {
    const [store] = useState(() => new HouseholdStore(supabase && key ? supabaseBackend(supabase, key) : null));
    useEffect(() => { store.start(); return () => store.stop(); }, [store]);
    const { data, status } = useSyncExternalStore(store.subscribe, store.getState);
    useEffect(() => { if (status === 'invalid')
        onInvalid(); }, [status, onInvalid]);
    if (status === 'invalid')
        return _jsx(Message, { children: "Checking your household link\u2026" });
    if (!data && (status === 'offline' || status === 'retrying'))
        return _jsx(Message, { children: "Can\u2019t reach your household right now. Check your internet connection; it\u2019ll load as soon as you\u2019re back online." });
    if (!data)
        return _jsx(Message, { children: "Loading\u2026" });
    return _jsx(Household, { data: data, update: m => store.update(m), status: status });
}
