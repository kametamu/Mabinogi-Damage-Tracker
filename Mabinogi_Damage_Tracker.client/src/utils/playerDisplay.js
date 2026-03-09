export function getPlayerDisplayName(player) {
    if (!player || typeof player !== 'object') {
        return 'Unknown';
    }

    const label = typeof player.label === 'string' ? player.label.trim() : '';
    if (label) {
        return label;
    }

    const name = typeof player.name === 'string' ? player.name.trim() : '';
    if (name) {
        return name;
    }

    if (player.id !== null && player.id !== undefined) {
        return String(player.id);
    }

    if (player.playerId !== null && player.playerId !== undefined) {
        return String(player.playerId);
    }

    return 'Unknown';
}
