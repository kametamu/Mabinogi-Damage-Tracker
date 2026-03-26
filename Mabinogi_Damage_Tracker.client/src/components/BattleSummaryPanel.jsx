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
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { useTranslation } from 'react-i18next';
import { useContext } from 'react';
import { AppContext } from '../AppContext';

function formatGroupedNumber(num) {
    const numericValue = Number(num ?? 0);
    if (!Number.isFinite(numericValue)) return '0';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(numericValue));
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

function getRankDisplay(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return String(rank);
}

async function exportBattleSummaryBlob({
    mode,
    t,
    totalDamage,
    effectiveAnalyzedDuration,
    participants,
    highestHit,
    topBurst,
    players,
}) {
    const lightPalette = {
        background: '#ffffff',
        surface: '#f5f7fb',
        surfaceAlt: '#eef2f7',
        stripe: '#f8fafc',
        textPrimary: '#111827',
        textSecondary: '#6b7280',
    };
    const darkPalette = {
        background: '#0f172a',
        surface: '#1e293b',
        surfaceAlt: '#233147',
        stripe: '#172135',
        textPrimary: '#f8fafc',
        textSecondary: '#cbd5e1',
    };
    const exportPalette = mode === 'dark' ? darkPalette : lightPalette;

    const exportScale = 2;
    const rowHeight = 38;
    const logicalWidth = 1360;
    const logicalHeight = 320 + players.length * rowHeight;
    const canvas = document.createElement('canvas');
    canvas.width = logicalWidth * exportScale;
    canvas.height = logicalHeight * exportScale;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to create canvas context');
    }
    context.scale(exportScale, exportScale);
    context.fillStyle = exportPalette.background;
    context.fillRect(0, 0, logicalWidth, logicalHeight);

    context.fillStyle = exportPalette.textPrimary;
    context.font = '700 34px sans-serif';
    context.fillText(t('analytics.battleSummary'), 40, 54);

    const partyDps = effectiveAnalyzedDuration > 0 ? totalDamage / effectiveAnalyzedDuration : 0;
    const stats = [
        [t('analytics.partyDps'), formatGroupedNumber(partyDps)],
        [t('common.totalDamage'), formatGroupedNumber(totalDamage)],
        [t('analytics.fightDuration'), formatDuration(effectiveAnalyzedDuration)],
        [t('analytics.participants'), String(participants)],
    ];

    const statCardY = 82;
    const statCardWidth = 300;
    stats.forEach(([label, value], index) => {
        const x = 40 + (index * (statCardWidth + 20));
        context.fillStyle = exportPalette.surface;
        context.fillRect(x, statCardY, statCardWidth, 90);
        context.fillStyle = exportPalette.textSecondary;
        context.font = '600 18px sans-serif';
        context.fillText(label, x + 16, statCardY + 30);
        context.fillStyle = exportPalette.textPrimary;
        context.font = '700 28px sans-serif';
        context.fillText(value, x + 16, statCardY + 68);
    });

    const highlights = [
        [t('analytics.highestHit'), formatGroupedNumber(highestHit?.damage ?? 0), highestHit?.player_name || '-'],
        [t('analytics.topBurst15s'), topBurst ? formatGroupedNumber(topBurst.damage) : '-', topBurst?.player_name || '-'],
    ];
    const highlightY = 192;
    highlights.forEach(([label, value, player], index) => {
        const x = 40 + (index * 650);
        context.fillStyle = exportPalette.surfaceAlt;
        context.fillRect(x, highlightY, 630, 84);
        context.fillStyle = exportPalette.textSecondary;
        context.font = '600 17px sans-serif';
        context.fillText(label, x + 16, highlightY + 28);
        context.fillStyle = exportPalette.textPrimary;
        context.font = '700 25px sans-serif';
        context.fillText(value, x + 16, highlightY + 58);
        context.fillStyle = exportPalette.textSecondary;
        context.font = '500 16px sans-serif';
        context.fillText(player, x + 340, highlightY + 58);
    });

    const tableY = 300;
    const columns = [
        { label: t('analytics.rank'), x: 40, width: 120, align: 'left' },
        { label: t('players.playerName'), x: 180, width: 360, align: 'left' },
        { label: t('common.totalDamage'), x: 560, width: 270, align: 'right' },
        { label: t('live.dps'), x: 850, width: 220, align: 'right' },
        { label: t('analytics.contribution'), x: 1090, width: 230, align: 'right' },
    ];

    context.fillStyle = exportPalette.textPrimary;
    context.font = '700 17px sans-serif';
    columns.forEach((column) => {
        const textX = column.align === 'right' ? column.x + column.width : column.x;
        context.textAlign = column.align;
        context.fillText(column.label, textX, tableY);
    });

    players.forEach((player, index) => {
        const rowY = tableY + 34 + (index * rowHeight);
        if (index % 2 === 0) {
            context.fillStyle = exportPalette.stripe;
            context.fillRect(36, rowY - 24, 1288, rowHeight);
        }

        context.fillStyle = exportPalette.textPrimary;
        context.textAlign = 'left';
        context.font = '600 16px sans-serif';
        context.fillText(getRankDisplay(index + 1), 40, rowY);
        context.fillText(player.playerName, 180, rowY);

        context.textAlign = 'right';
        context.fillText(formatGroupedNumber(player.totalDamage), 830, rowY);
        context.fillText(formatGroupedNumber(player.dps), 1070, rowY);
        context.fillText(`${player.contribution.toFixed(1)}%`, 1320, rowY);
    });

    const pngBlob = await new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
    });

    if (!pngBlob) {
        throw new Error('Failed to create PNG blob');
    }

    return pngBlob;
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
    const { mode } = useContext(AppContext);
    const exportTargetRef = React.useRef(null);
    const [feedbackMessage, setFeedbackMessage] = React.useState('');
    const [feedbackSeverity, setFeedbackSeverity] = React.useState('success');
    const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false);
    const partyDps = effectiveAnalyzedDuration > 0 ? totalDamage / effectiveAnalyzedDuration : 0;

    const setExportRefs = React.useCallback((node) => {
        exportTargetRef.current = node;
        if (typeof ref === 'function') {
            ref(node);
        } else if (ref) {
            ref.current = node;
        }
    }, [ref]);

    const showFeedback = (message, severity = 'success') => {
        setFeedbackMessage(message);
        setFeedbackSeverity(severity);
        setIsFeedbackOpen(true);
    };

    const handleSavePng = async () => {
        if (!exportTargetRef.current) return;

        try {
            const pngBlob = await exportBattleSummaryBlob({
                mode,
                t,
                totalDamage,
                effectiveAnalyzedDuration,
                participants,
                highestHit,
                topBurst,
                players,
            });
            const downloadUrl = URL.createObjectURL(pngBlob);
            const anchor = document.createElement('a');
            anchor.href = downloadUrl;
            anchor.download = 'battle-summary.png';
            anchor.click();
            URL.revokeObjectURL(downloadUrl);
            showFeedback(t('analytics.savedBattleSummaryImage'));
        } catch (error) {
            console.error('Failed to save battle summary image:', error);
            showFeedback(t('analytics.exportFailed'), 'error');
        }
    };

    return (
        <>
            <Paper ref={setExportRefs} square={false} sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="flex-end">
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} data-export-exclude="true">
                        <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={handleSavePng}>
                            {t('analytics.saveAsPng')}
                        </Button>
                    </Stack>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} divider={<Divider orientation="vertical" flexItem />}>
                    <Box sx={{ minWidth: 170 }}>
                        <Typography variant="subtitle2" color="text.secondary">{t('analytics.partyDps')}</Typography>
                        <Typography variant="h4">{formatGroupedNumber(partyDps)}</Typography>
                    </Box>
                    <Box sx={{ minWidth: 170 }}>
                        <Typography variant="subtitle2" color="text.secondary">{t('common.totalDamage')}</Typography>
                        <Typography variant="h4">{formatGroupedNumber(totalDamage)}</Typography>
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
                        <Typography variant="h5">{formatGroupedNumber(highestHit?.damage ?? 0)}</Typography>
                        <Typography variant="body2">{highestHit?.player_name || '-'}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">{t('analytics.topBurst15s')}</Typography>
                        <Typography variant="h5">{topBurst ? formatGroupedNumber(topBurst.damage) : '-'}</Typography>
                        <Typography variant="body2">{topBurst?.player_name || '-'}</Typography>
                    </Box>
                </Stack>

                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell width={80}>{t('analytics.rank')}</TableCell>
                                <TableCell>{t('players.playerName')}</TableCell>
                                <TableCell align="right">{t('common.totalDamage')}</TableCell>
                                <TableCell align="right">{t('live.dps')}</TableCell>
                                <TableCell align="right">{t('analytics.contribution')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {players.map((player, index) => {
                                const rank = index + 1;
                                return (
                                    <TableRow key={player.playerName}>
                                        <TableCell>{getRankDisplay(rank)}</TableCell>
                                        <TableCell>{player.playerName}</TableCell>
                                        <TableCell align="right">{formatGroupedNumber(player.totalDamage)}</TableCell>
                                        <TableCell align="right">{formatGroupedNumber(player.dps)}</TableCell>
                                        <TableCell align="right">{`${player.contribution.toFixed(1)}%`}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
            <Snackbar open={isFeedbackOpen} autoHideDuration={3500} onClose={() => setIsFeedbackOpen(false)} data-export-exclude="true">
                <Alert severity={feedbackSeverity} variant="filled" onClose={() => setIsFeedbackOpen(false)} sx={{ width: '100%' }}>
                    {feedbackMessage}
                </Alert>
            </Snackbar>
        </>
    );
});

export default BattleSummaryPanel;
