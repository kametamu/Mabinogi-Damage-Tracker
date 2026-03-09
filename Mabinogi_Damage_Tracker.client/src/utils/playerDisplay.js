export function getPlayerDisplayName(item) {
    return item?.label
        ?? item?.name
        ?? String(item?.id ?? item?.playerId ?? 'Unknown');
}

