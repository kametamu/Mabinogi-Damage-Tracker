import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DataGrid } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const paginationModel = { page: 0, pageSize: 20 };

export default function PlayersMenu() {
    const { t } = useTranslation();
    const [players, setPlayers] = useState([])

    const columns = [
        { field: 'playerId', headerName: t('players.playerId'), width: 200 },
        { field: 'playerName', headerName: t('players.playerName'), width: 170 },
    ];

    useEffect(() => {
        fetch(`http://${window.location.hostname}:5004/Home/GetAllPlayers`)
            .then(response => response.json())
            .then(data => {
                setPlayers(data.value)
            })
            .catch(error => console.error('Error:', error));
    }, [])

    return (
        <Box>
            <Typography variant="h2" sx={{ marginBottom: "24px" }}>{t('players.title')}</Typography>
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
