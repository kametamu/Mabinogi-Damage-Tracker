import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DataGrid } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { getPlayerDisplayName } from '../utils/playerDisplay';

const paginationModel = { page: 0, pageSize: 20 };

function resolvePlayersPayload(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (payload && typeof payload === 'object' && Array.isArray(payload.value)) {
        return payload.value;
    }

    return [];
}

export default function PlayersMenu() {
    const { t } = useTranslation();
    const [players, setPlayers] = useState([])

    const columns = [
        { field: 'playerId', headerName: t('players.playerId'), width: 200 },
        { field: 'playerName', headerName: t('players.playerName'), width: 170 },
    ];

    useEffect(() => {
        fetch(`http://${window.location.hostname}:5004/Home/GetAllPlayers`)
            .then(async (response) => {
                if (!response.ok) {
                    return [];
                }

                try {
                    const payload = await response.json();
                    const playersPayload = resolvePlayersPayload(payload);

                    return playersPayload.map((player, index) => {
                        const playerId = player?.playerId ?? player?.id ?? index;
                        return {
                            ...player,
                            id: playerId,
                            playerId,
                            playerName: getPlayerDisplayName({
                                label: player?.label,
                                name: player?.playerName ?? player?.name,
                                id: player?.id,
                                playerId: player?.playerId,
                            }),
                        };
                    });
                } catch {
                    return [];
                }
            })
            .then((mappedPlayers) => {
                setPlayers(mappedPlayers);
            })
            .catch(error => {
                console.error('Error:', error);
                setPlayers([]);
            });
    }, [])

    return (
        <Box>
            <Typography variant="h2" sx={{ marginBottom: '24px' }}>{t('players.title')}</Typography>
            <DataGrid
                rows={players}
                columns={columns}
                initialState={{ pagination: { paginationModel } }}
                pageSizeOptions={[5, 10, 20]}
                disableColumnResize
                sx={{ border: 1, borderColor: 'divider' }}
            />

        </Box >
    );
}
