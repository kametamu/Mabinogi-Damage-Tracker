import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

const LANE_HEIGHT = 64;
const DISPLAY_BUCKET_COUNT = 240;

function getOverlayStyle(interval, hoveredIntervalId, startUt, endUt) {
    const duration = endUt - startUt;
    if (!interval || duration <= 0) return null;

    const leftRatio = (interval.startUt - startUt) / duration;
    const rightRatio = (interval.endUt - startUt) / duration;
    const clampedLeft = Math.min(Math.max(leftRatio, 0), 1);
    const clampedRight = Math.min(Math.max(rightRatio, 0), 1);
    const widthRatio = Math.max(clampedRight - clampedLeft, 0);
    const isHovered = interval.id === hoveredIntervalId;

    return {
        left: `${(clampedLeft * 100).toFixed(4)}%`,
        width: `${(widthRatio * 100).toFixed(4)}%`,
        borderLeft: isHovered ? '2px solid rgba(25, 118, 210, 0.9)' : '1px solid rgba(25, 118, 210, 0.28)',
        borderRight: isHovered ? '2px solid rgba(25, 118, 210, 0.9)' : '1px solid rgba(25, 118, 210, 0.28)',
        backgroundColor: isHovered ? 'rgba(25, 118, 210, 0.20)' : 'rgba(25, 118, 210, 0.10)',
    };
}

export default function ExcludedIntervalSelectionPanel({
    startUt,
    endUt,
    attackTimestamps,
    excludedIntervals,
    hoveredIntervalId,
    onSelectTime,
    title,
}) {
    const densityBars = useMemo(() => {
        if (!Number.isFinite(startUt) || !Number.isFinite(endUt) || endUt <= startUt) {
            return [];
        }

        const buckets = new Array(DISPLAY_BUCKET_COUNT).fill(0);
        const duration = endUt - startUt;

        attackTimestamps.forEach((timestamp) => {
            if (!Number.isFinite(timestamp) || timestamp < startUt || timestamp > endUt) return;
            const bucketIndex = Math.min(
                Math.floor(((timestamp - startUt) / duration) * DISPLAY_BUCKET_COUNT),
                DISPLAY_BUCKET_COUNT - 1,
            );
            buckets[bucketIndex] += 1;
        });

        const maxValue = Math.max(...buckets, 1);
        return buckets.map((value, index) => ({
            id: index,
            value,
            ratio: value / maxValue,
        }));
    }, [attackTimestamps, endUt, startUt]);

    const intervalOverlays = useMemo(() => excludedIntervals
        .map((interval) => ({
            id: interval.id,
            style: getOverlayStyle(interval, hoveredIntervalId, startUt, endUt),
        }))
        .filter((entry) => entry.style != null), [excludedIntervals, hoveredIntervalId, startUt, endUt]);

    const handleClick = (event) => {
        if (typeof onSelectTime !== 'function' || !Number.isFinite(startUt) || !Number.isFinite(endUt) || endUt <= startUt) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const relativeX = event.clientX - rect.left;
        if (relativeX < 0 || relativeX > rect.width) return;

        const ratio = rect.width > 0 ? relativeX / rect.width : 0;
        const clickedTime = startUt + ((endUt - startUt) * ratio);
        onSelectTime(clickedTime);
    };

    return (
        <Paper square={false} sx={{ p: 2 }}>
            <Typography variant="h4" sx={{ mb: 1 }}>{title}</Typography>
            <Box
                onClick={handleClick}
                sx={{
                    position: 'relative',
                    height: LANE_HEIGHT,
                    width: '100%',
                    borderRadius: 1,
                    overflow: 'hidden',
                    cursor: 'crosshair',
                    bgcolor: 'background.default',
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: 'flex-end',
                    px: 0.5,
                    gap: '1px',
                }}
            >
                {densityBars.map((bar) => (
                    <Box
                        key={bar.id}
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            height: `${Math.max(bar.ratio * 100, 3)}%`,
                            backgroundColor: bar.value > 0 ? 'rgba(33, 150, 243, 0.65)' : 'rgba(120, 120, 120, 0.08)',
                            transition: 'height 80ms linear',
                        }}
                    />
                ))}
                <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {intervalOverlays.map((overlay) => (
                        <Box
                            key={overlay.id}
                            sx={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                ...overlay.style,
                            }}
                        />
                    ))}
                </Box>
            </Box>
        </Paper>
    );
}
