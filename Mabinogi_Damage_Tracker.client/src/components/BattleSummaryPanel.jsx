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

async function exportBattleSummaryBlob(node) {
    const { width, height } = node.getBoundingClientRect();
    const clone = node.cloneNode(true);

    clone.querySelectorAll('[data-export-exclude="true"]').forEach((element) => element.remove());
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    clone.style.margin = '0';

    const serialized = new XMLSerializer().serializeToString(clone);
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <foreignObject x="0" y="0" width="100%" height="100%">
                ${serialized}
            </foreignObject>
        </svg>
    `;

    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
        const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = svgUrl;
        });

        const canvas = document.createElement('canvas');
        const pixelRatio = window.devicePixelRatio > 1 ? 2 : 1;
        canvas.width = Math.ceil(width * pixelRatio);
        canvas.height = Math.ceil(height * pixelRatio);

        const context = canvas.getContext('2d');
        context.scale(pixelRatio, pixelRatio);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        const pngBlob = await new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/png');
        });

        if (!pngBlob) {
            throw new Error('Failed to create PNG blob');
        }

        return pngBlob;
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
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
            const pngBlob = await exportBattleSummaryBlob(exportTargetRef.current);
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
                <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" spacing={2}>
                    <Typography variant="h4">{t('analytics.battleSummary')}</Typography>
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
