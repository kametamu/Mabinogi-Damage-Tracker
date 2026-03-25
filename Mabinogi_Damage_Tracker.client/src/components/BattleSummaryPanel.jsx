import * as React from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useTranslation } from 'react-i18next';

function formatLargeNumber(num) {
    if (num === null || num === undefined || Number.isNaN(num)) return '0';

    const absNum = Math.abs(num);
    let formatted;

    if (absNum >= 1e12) {
        formatted = (num / 1e12).toFixed(1) + 'T';
    } else if (absNum >= 1e9) {
        formatted = (num / 1e9).toFixed(1) + 'B';
    } else if (absNum >= 1e6) {
        formatted = (num / 1e6).toFixed(1) + 'M';
    } else if (absNum >= 1e3) {
        formatted = (num / 1e3).toFixed(1) + 'K';
    } else {
        formatted = num.toFixed(0);
    }

    return formatted.replace(/\.0(?=[A-Z])/, '');
}

function formatDuration(lengthUt) {
    if (lengthUt === null || lengthUt === undefined || lengthUt < 0 || Number.isNaN(lengthUt)) return '0s';

    const totalSeconds = Math.floor(lengthUt);
    const numberOfHours = Math.floor(totalSeconds / (60 * 60));
    const numberOfMinutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const numberOfSeconds = totalSeconds % 60;

    const parts = [];
    if (numberOfHours > 0) parts.push(`${numberOfHours}h`);
    if (numberOfMinutes > 0 || numberOfHours > 0) parts.push(`${numberOfMinutes}m`);
    parts.push(`${numberOfSeconds}s`);

    return parts.join('');
}

const BattleSummaryPanel = React.forwardRef(function BattleSummaryPanel({
    totalDamage,
    effectiveAnalyzedDuration,
    participants,
    highestHit,
    topBurst,
    players,
}, ref) {
    const { t } = useTranslation();
    const partyDps = effectiveAnalyzedDuration > 0 ? totalDamage / effectiveAnalyzedDuration : 0;

    return (
        <Paper ref={ref} square={false} sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h4">{t('analytics.battleSummary')}</Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} divider={<Divider orientation="vertical" flexItem />}>
                <Box sx={{ minWidth: 170 }}>
                    <Typography variant="subtitle2" color="text.secondary">{t('analytics.partyDps')}</Typography>
                    <Typography variant="h4">{formatLargeNumber(partyDps)}</Typography>
                </Box>
                <Box sx={{ minWidth: 170 }}>
                    <Typography variant="subtitle2" color="text.secondary">{t('common.totalDamage')}</Typography>
                    <Typography variant="h4">{formatLargeNumber(totalDamage)}</Typography>
                </Box>
                <Box sx={{ minWidth: 170 }}>
                    <Typography variant="subtitle2" color="text.secondary">{t('analytics.fightDuration')}</Typography>
                    <Typography variant="h4">{formatDuration(effectiveAnalyzedDuration)}</Typography>
                </Box>
                <Box sx={{ minWidth: 170 }}>
                    <Typography variant="subtitle2" color="text.secondary">{t('analytics.participants')}</Typography>
                    <Typography variant="h4">{participants}</Typography>
                </Box>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box sx={{ flex: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">{t('analytics.highestHit')}</Typography>
                    <Typography variant="h5">{formatLargeNumber(highestHit?.damage ?? 0)}</Typography>
                    <Typography variant="body2">{highestHit?.player_name || '-'}</Typography>
                </Box>
                <Box sx={{ flex: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">{t('analytics.topBurst15s')}</Typography>
                    <Typography variant="h5">{topBurst ? formatLargeNumber(topBurst.damage) : '-'}</Typography>
                    <Typography variant="body2">{topBurst?.player_name || '-'}</Typography>
                </Box>
            </Stack>

            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('players.playerName')}</TableCell>
                            <TableCell align="right">{t('common.totalDamage')}</TableCell>
                            <TableCell align="right">{t('live.dps')}</TableCell>
                            <TableCell align="right">{t('analytics.contribution')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {players.map((player) => (
                            <TableRow key={player.playerName}>
                                <TableCell>{player.playerName}</TableCell>
                                <TableCell align="right">{formatLargeNumber(player.totalDamage)}</TableCell>
                                <TableCell align="right">{formatLargeNumber(player.dps)}</TableCell>
                                <TableCell align="right">{`${player.contribution.toFixed(1)}%`}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
});

export default BattleSummaryPanel;
