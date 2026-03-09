function normalizeDisplayText(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function getPlayerDisplayName(item) {
    const label = normalizeDisplayText(item?.label);
    if (label) {
        return label;
    }

    const name = normalizeDisplayText(item?.name);
    if (name) {
        return name;
    }

    if (item?.id !== null && item?.id !== undefined) {
        return String(item.id);
    }

    if (item?.playerId !== null && item?.playerId !== undefined) {
        return String(item.playerId);
    }

    return 'Unknown';
}
