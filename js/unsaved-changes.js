// Unsaved changes: a toast at the top of the screen while a form on the page itself has been edited but not saved,
// with the edited fields outlined. Covers My Predictions and the admin screens. Pop-ups (modals) are not tracked:
// they ask for an explicit Save or Cancel in front of you, so there is nothing to forget.
// Classic script (shared global scope); load order is set in index.html.

// Each area is an in-page form with its own Save / Add button. `saves` are the global functions that save it.
const UNSAVED_AREAS = [
    { id: 'rulesTab', label: 'Guesser rules', saves: {} },
    { id: 'prizeFundTab', label: 'Prize fund', saves: {} },
    { id: 'competitorsTab', label: 'Competitors', saves: { addCompetitor: () => 'new-competitor-card' } },
    { id: 'yearsTab', label: 'Years', saves: { addYearFromAdmin: () => 'yearsTab' } }
];

// Fields that are not "edits waiting for Save": chooser drop downs and toggles that save as soon as they change
const UNSAVED_IGNORE = '#adminPredictionUserSelect, [id^="link-account-"], .cc-toggle input, [data-no-unsaved], input[type="hidden"], input[type="button"], input[type="submit"], input[type="file"]';

function unsavedFieldValue(el) {
    return el.type === 'checkbox' || el.type === 'radio' ? String(el.checked) : String(el.value);
}

function unsavedAreaOf(el) {
    return UNSAVED_AREAS.find(area => { const root = document.getElementById(area.id); return root && root.contains(el); }) || null;
}

function unsavedIsField(el) {
    return !!el && el.matches && el.matches('input, select, textarea') && !el.matches(UNSAVED_IGNORE);
}

// Forget what was "saved" for the fields inside `root` (after a save, or when a modal opens or closes)
function clearUnsavedBaselines(root) {
    if (!root) return;
    root.querySelectorAll('[data-unsaved-base]').forEach(el => { delete el.dataset.unsavedBase; el.classList.remove('unsaved-field'); });
    updateUnsavedToast();
}

function unsavedDirtyAreas() {
    const dirty = [];
    UNSAVED_AREAS.forEach(area => {
        const root = document.getElementById(area.id);
        if (!root) return;
        let any = false;
        root.querySelectorAll('[data-unsaved-base]').forEach(el => {
            const changed = unsavedFieldValue(el) !== el.dataset.unsavedBase;
            el.classList.toggle('unsaved-field', changed);
            if (changed) any = true;
        });
        if (any) dirty.push(area.label);
    });
    return dirty;
}

function updateUnsavedToast() {
    const toast = document.getElementById('unsavedToast');
    if (!toast) return;
    const dirty = unsavedDirtyAreas();
    window.__hasUnsavedChanges = dirty.length > 0;
    toast.classList.toggle('hidden', dirty.length === 0);
    const text = document.getElementById('unsavedToastText');
    if (text && dirty.length) text.textContent = `Unsaved changes: ${dirty.join(', ')}`;
}

// Wrap a save function: when it finishes without an error message, what is on screen counts as saved
function wrapUnsavedSave(name, scopeFor) {
    const original = window[name];
    if (typeof original !== 'function' || original.__unsavedWrapped) return;
    const wrapped = async function (...args) {
        const realAlert = window.alert;
        let failed = false;
        window.alert = (message) => {
            if (!/success|saved|updated|added|created/i.test(String(message))) failed = true;
            return realAlert.call(window, message);
        };
        let result;
        try {
            result = await original.apply(this, args);
        } finally {
            window.alert = realAlert;
        }
        if (!failed) clearUnsavedBaselines(document.getElementById(scopeFor(...args)) || document.body);
        else updateUnsavedToast();
        return result;
    };
    wrapped.__unsavedWrapped = true;
    window[name] = wrapped;
}

document.addEventListener('DOMContentLoaded', () => {
    // First time a field is focused, remember its value: that is the saved value
    document.addEventListener('focusin', (event) => {
        const el = event.target;
        if (unsavedIsField(el) && unsavedAreaOf(el) && el.dataset.unsavedBase === undefined) el.dataset.unsavedBase = unsavedFieldValue(el);
    }, true);
    ['input', 'change'].forEach(type => document.addEventListener(type, (event) => {
        const el = event.target;
        if (!unsavedIsField(el) || !unsavedAreaOf(el)) return;
        if (el.dataset.unsavedBase === undefined) el.dataset.unsavedBase = unsavedFieldValue(el);
        updateUnsavedToast();
    }, true));

    // Screens that re-draw themselves after a save drop their old fields
    let redrawTimer = null;
    UNSAVED_AREAS.forEach(area => {
        const root = document.getElementById(area.id);
        if (root) new MutationObserver(() => { clearTimeout(redrawTimer); redrawTimer = setTimeout(updateUnsavedToast, 50); }).observe(root, { childList: true, subtree: true });
    });

    UNSAVED_AREAS.forEach(area => Object.keys(area.saves).forEach(name => wrapUnsavedSave(name, area.saves[name])));
    wrapUnsavedSave('saveUpdatedRules', (kind) => (kind === 'prize' ? 'prizeFundTab' : 'rulesTab'));
    wrapUnsavedSave('saveUserChanges', (username) => `user-row-${username}`);

    window.addEventListener('beforeunload', (event) => {
        if (window.__hasUnsavedChanges) { event.preventDefault(); event.returnValue = ''; }
    });
});
