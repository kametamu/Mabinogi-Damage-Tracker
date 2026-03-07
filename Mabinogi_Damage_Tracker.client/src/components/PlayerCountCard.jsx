import * as React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography'
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import { useTranslation } from 'react-i18next';


export default function PlayerCountCard({ count }) {
    const { t } = useTranslation();

    return (
        <Paper square={false} sx={{ padding: "32px", gap: "20px", height: "100%", display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <GroupIcon fontSize="large" sx={{ marginBottom: "8%" }} />
            <Box sx={{ display: "flex", flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 2, sm: 4, md: 8 } }}>
                <Box sx={{ gap: "10px", flexGrow: "2" }}>
                    <Typography variant="subtitle1">{t('common.numberOfPlayers')}</Typography>
                    <Typography variant="h3">{count}</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap'}}>
                    {Array.from({ length: count }).map((_, i) => (
                        <PersonIcon key={i} sx={{ color: '#8684BF' }} />
                    ))}
                </Box>
            </Box>
        </Paper>
    );
}
