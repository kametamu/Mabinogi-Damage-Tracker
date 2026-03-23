import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography'
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';

function formatTimeLength(length_ut) {
    if (length_ut === null || length_ut === undefined || length_ut < 0 || Number.isNaN(length_ut)) return '0';

    const numberOfHours = Math.floor(length_ut / (60 * 60));
    const numberOfMinutes = Math.floor((length_ut % (60 * 60)) / 60);
    const numberOfSeconds = Math.floor(length_ut % 60);

    const parts = [];
    if (numberOfHours > 0) parts.push(`${numberOfHours}h`);
    if (numberOfMinutes > 0 || numberOfHours > 0) parts.push(`${numberOfMinutes}m`);
    parts.push(`${numberOfSeconds}s`);

    return parts.join('');
}

export default function TimeCard({ length_ut, original_length_ut = null, excluded_length_ut = null }) {
    const { t } = useTranslation();
    const showExcludedSummary = original_length_ut !== null || excluded_length_ut !== null;

    return (
        <Paper square={false} sx={{ padding: '32px', gap: '20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <AccessTimeIcon fontSize="large" sx={{ marginBottom: '5%' }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ gap: '0px', flexGrow: '1' }}>
                    <Typography variant="subtitle1">{showExcludedSummary ? t('analytics.analyzedDuration') : t('recordings.recordingLength')}</Typography>
                    <Typography variant="h3">{formatTimeLength(length_ut)}</Typography>
                </Box>
                {showExcludedSummary ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box>
                            <Typography variant="subtitle2">{t('analytics.elapsedDuration')}</Typography>
                            <Typography variant="body1">{formatTimeLength(original_length_ut ?? length_ut)}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2">{t('analytics.excludedDuration')}</Typography>
                            <Typography variant="body1">{formatTimeLength(excluded_length_ut ?? 0)}</Typography>
                        </Box>
                    </Box>
                ) : null}
            </Box>
        </Paper>
    );
}
