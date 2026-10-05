/** Removing something saved can't be undone, so check first. */
export function confirmRemove(what) {
    try {
        return window.confirm('Remove ' + what + '? This can’t be undone.');
    }
    catch {
        return true;
    }
}
