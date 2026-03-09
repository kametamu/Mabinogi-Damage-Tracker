import { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../AppContext'
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import DamageCard from './DamageCard';
import PlayerCountCard from './PlayerCountCard';
import TimeCard from './TimeCard';
import TrimLineGraph from './TrimLineGraph';
import PlayerDamagePieChart from './PlayerDamagePieChart';
import DecoratedDamageOverTimeLineGraph from './DecoratedDamageOverTimeLineGraph';
import DamageScatterPlot from './DamageScatterPlot';
import LargestHitCard from './LargestHitCard';
import BurstCard from './BurstCard';
import HealingCard from './HealingCard';
import { getLocalizedSkillName } from '../i18n/skills';
import { getPlayerDisplayName } from '../utils/playerDisplay';

function toFiniteNumber(value, fallback = null) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toFiniteNumberArray(values) {
    if (!Array.isArray(values)) {
        return [];
    }

    return values
        .map((value) => toFiniteNumber(value, null))
        .filter((value) => value !== null);
}

function isFinitePoint(x, y) {
    return Number.isFinite(Number(x)) && Number.isFinite(Number(y));
}

async function safeJsonArray(response) {
    if (!response.ok) {
        return [];
    }

    try {
        const json = await response.json();
        return Array.isArray(json) ? json : [];
    } catch {
        return [];
    }
}

async function safeJsonNumber(response, fallback = 0) {
    if (!response.ok) {
        return fallback;
    }

    try {
        const json = await response.json();
        const numericValue = Number(json);
        return Number.isFinite(numericValue) ? numericValue : fallback;
    } catch {
        return fallback;
    }
}

function formatTimeStamp(ut) {
    return new Date((ut) * 1000).toLocaleTimeString(
        [],
        { hour: 'numeric', minute: '2-digit', second: '2-digit' }
    );
}

function getPlayerKey(player) {
    if (!player || typeof player !== 'object') {
        return 'unknown';
    }

    if (player.player_id !== null && player.player_id !== undefined) {
        return String(player.player_id);
    }

    if (player.playerId !== null && player.playerId !== undefined) {
        return String(player.playerId);
    }

    if (player.id !== null && player.id !== undefined) {
        return String(player.id);
    }

    return 'unknown';
}

function transformDataPieDamage(apiData, language) {
    return apiData
        .map(item => {
            const value = toFiniteNumber(Array.isArray(item.data) ? item.data.at(-1) : null, null);
            if (value === null) {
                return null;
            }

            return {
                skillId: item.skill_id ?? item.skillId ?? item.id,
                label: getLocalizedSkillName(item.skill_id ?? item.skillId ?? item.id, item.label, language),
                value,
            };
        })
        .filter(Boolean);
}

function transformDataLineChartDamage(apiData, language) {
    return apiData
        .map(item => {
            const data = toFiniteNumberArray(item.data);
            if (data.length === 0) {
                return null;
            }

            return {
                type: 'line',
                id: getPlayerKey(item),
                skillId: item.skill_id ?? item.skillId ?? item.id,
                label: getLocalizedSkillName(item.skill_id ?? item.skillId ?? item.id, item.label, language),
                data,
                area: false,
                showMark: false,
            };
        })
        .filter(Boolean);
}

function sanitizeLargestHits(items) {
    return items
        .map((item) => {
            const damage = toFiniteNumber(item.damage, null);
            const unix_timestamp = toFiniteNumber(item.unix_timestamp, null);

            if (damage === null || unix_timestamp === null) {
                return null;
            }

            return {
                ...item,
                damage,
                unix_timestamp,
                player_key: getPlayerKey(item),
                player_name: getPlayerDisplayName({
                    label: item.player_label,
                    name: item.player_name,
                    id: item.player_id,
                    playerId: item.playerId,
                }),
            };
        })
        .filter(Boolean);
}

function sanitizeBandData(items, label, timeframeSeconds) {
    return items
        .map((item) => {
            const unixTimestamp = toFiniteNumber(item.unix_timestamp, null);
            const damage = toFiniteNumber(item.damage, null);

            if (unixTimestamp === null || damage === null) {
                return null;
            }

            return {
                ...item,
                label,
                unix_timestamp: unixTimestamp,
                damage,
                player_key: getPlayerKey(item),
                player_name: getPlayerDisplayName({
                    label: item.player_label,
                    name: item.player_name,
                    id: item.player_id,
                    playerId: item.playerId,
                }),
                start: formatTimeStamp(unixTimestamp),
                end: formatTimeStamp(unixTimestamp + timeframeSeconds),
            };
        })
        .filter(Boolean);
}

export default function AnalyticsMenu({ start_ut, end_ut }) {
    const { t, i18n } = useTranslation();
    const { burstCount, largestDamageInstanceCount } = useContext(AppContext)
    const [damageOverTimeData, setDamageOverTimeData] = useState([])
    const [damagePieChartData, setDamagePieChartData] = useState([])
    const [combinedDamageOverTimeData, setCombinedDamageOverTimeData] = useState([])
    const [totalDamage, setTotalDamage] = useState(0)
    const [totalHealing, setTotalHealing] = useState(0)
    const [numberOfPlayer, setNumberOfPlayers] = useState(0)
    const [largestDamageInstances, setLargestDamageInstances] = useState([])
    const [graphLargestDamageInstance, setGraphLargestDamageInstance] = useState(null)
    const [bands, setBands] = useState([])
    const [graphBands, setGraphBands] = useState([])
    const [scatterPlotSeries, setScatterPlotSeries] = useState([]);

    useEffect(() => {
        async function loadAnalytics() {
            const aggregatedDamagePromise = fetch(`http://${window.location.hostname}:5004/Home/GetAggregatedDamageSeriesGroupedByPlayers?start_ut=${start_ut}&end_ut=${end_ut}`)
                .then(safeJsonArray);

            const largestHitPromise = fetch(`http://${window.location.hostname}:5004/Home/GetListOfDistinctLargestSingleDamageInstance?start_ut=${start_ut}&end_ut=${end_ut}&count=${largestDamageInstanceCount}`)
                .then(safeJsonArray);

            const totalHealingPromise = fetch(`http://${window.location.hostname}:5004/Home/GetTotalPlayerHealing?start_ut=${start_ut}&end_ut=${end_ut}`)
                .then(response => safeJsonNumber(response, 0));

            const damagesBetweenPromise = fetch(`http://${window.location.hostname}:5004/Home/GetDamagesBetweenUt?start_ut=${start_ut}&end_ut=${end_ut}`)
                .then(safeJsonArray);

            const burst60Promise = fetch(`http://${window.location.hostname}:5004/Home/GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes?start_ut=${start_ut}&end_ut=${end_ut}&burst_timeframe=${60}&count=${burstCount}`)
                .then(safeJsonArray);

            const burst30Promise = fetch(`http://${window.location.hostname}:5004/Home/GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes?start_ut=${start_ut}&end_ut=${end_ut}&burst_timeframe=${30}&count=${burstCount}`)
                .then(safeJsonArray);

            const burst15Promise = fetch(`http://${window.location.hostname}:5004/Home/GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes?start_ut=${start_ut}&end_ut=${end_ut}&burst_timeframe=${15}&count=${burstCount}`)
                .then(safeJsonArray);

            const [
                aggregatedDamage,
                largestHits,
                healingValue,
                damagePoints,
                burst60,
                burst30,
                burst15,
            ] = await Promise.all([
                aggregatedDamagePromise,
                largestHitPromise,
                totalHealingPromise,
                damagesBetweenPromise,
                burst60Promise,
                burst30Promise,
                burst15Promise,
            ]);

            const sortedData = [...aggregatedDamage].sort((a, b) => {
                const damageA = toFiniteNumber(Array.isArray(a.data) ? a.data.at(-1) : null, 0);
                const damageB = toFiniteNumber(Array.isArray(b.data) ? b.data.at(-1) : null, 0);
                return damageB - damageA;
            });

            const newLineChartData = transformDataLineChartDamage(sortedData, i18n.language);
            setDamageOverTimeData(newLineChartData);

            const maxLength = newLineChartData.reduce((max, series) => Math.max(max, series.data.length), 0);
            const newCombinedDamageOverTimeData = Array.from({ length: maxLength }, (_, index) =>
                toFiniteNumber(
                    newLineChartData.reduce((sum, series) => sum + (toFiniteNumber(series.data[index], 0)), 0),
                    0,
                ),
            );
            setCombinedDamageOverTimeData(newCombinedDamageOverTimeData);

            const newPieChartData = transformDataPieDamage(sortedData, i18n.language);
            setDamagePieChartData(newPieChartData);

            setTotalDamage(toFiniteNumber(newCombinedDamageOverTimeData.at(-1), 0));
            setNumberOfPlayers(newLineChartData.length);

            const sanitizedLargestHits = sanitizeLargestHits(largestHits);
            setLargestDamageInstances(sanitizedLargestHits);
            setGraphLargestDamageInstance(sanitizedLargestHits[0] ?? null);

            setTotalHealing(toFiniteNumber(healingValue, 0));

            const dmgMap = new Map();
            const series = damagePoints.reduce((acc, point) => {
                const playerKey = getPlayerKey(point);
                const playerLabel = getPlayerDisplayName({
                    label: point.player_label,
                    name: point.player_name,
                    id: point.player_id,
                    playerId: point.playerId,
                });

                let entry = acc.find((element) => element.id === playerKey);

                if (!entry) {
                    entry = {
                        id: playerKey,
                        label: playerLabel,
                        highlightScope: { highlight: 'series', fade: 'global' },
                        markerSize: 2,
                        data: [],
                    };
                    dmgMap.set(playerKey, 0);
                    acc.push(entry);
                }

                const x = toFiniteNumber(point.unix_timestamp, null);
                const y = toFiniteNumber(point.damage, null);
                if (x === null || y === null || y <= 0 || !isFinitePoint(x, y)) {
                    return acc;
                }

                entry.data.push({
                    x,
                    y,
                    id: entry.data.length,
                });

                dmgMap.set(playerKey, (dmgMap.get(playerKey) ?? 0) + y);
                return acc;
            }, []);

            const sanitizedSeries = series.filter((entry) => entry.data.length > 0);
            sanitizedSeries.sort((a, b) => (dmgMap.get(b.id) ?? 0) - (dmgMap.get(a.id) ?? 0));
            setScatterPlotSeries(sanitizedSeries);

            const burstByWindow = [
                sanitizeBandData(burst60, '60s', 60),
                sanitizeBandData(burst30, '30s', 30),
                sanitizeBandData(burst15, '15s', 15),
            ];

            const newGraphBands = [];
            burstByWindow.forEach((group) => {
                if (group[0]) newGraphBands.push(group[0]);
            });

            setBands(burstByWindow.filter((group) => group.length > 0));
            setGraphBands(newGraphBands);
        }

        loadAnalytics();
    }, [start_ut, end_ut, burstCount, largestDamageInstanceCount, i18n.language]);

    return (
        <Box>
            <Typography variant="h2" sx={{ marginBottom: '8px' }}>{t('analytics.title')}</Typography>
            <Grid container spacing={{ xs: 1, md: 2 }} alignItems="stretch" sx={{ flexGrow: 1 }}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} >
                    {combinedDamageOverTimeData ?
                        <DamageCard chartData={combinedDamageOverTimeData} totalDamage={totalDamage} />
                        :
                        <Skeleton variant="rounded" />
                    }
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} >
                    {numberOfPlayer ?
                        <PlayerCountCard count={numberOfPlayer} />
                        :
                        <Skeleton variant="rounded" />
                    }
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} >
                    <TimeCard length_ut={end_ut - start_ut} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} >
                    {combinedDamageOverTimeData ?
                        <HealingCard totalHealing={totalHealing} />
                        :
                        <Skeleton variant="rounded" />
                    }
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ height: '250px', paddingBottom: '14px' }}>
                    {largestDamageInstances.length ?
                        <LargestHitCard largestDamageInstances={largestDamageInstances} setGraphLargestDamageInstance={setGraphLargestDamageInstance} />
                        :
                        <Skeleton variant="rounded" />
                    }
                </Grid>
                {bands.length ?
                    bands.map((band, index) =>
                        <Grid key={`band_${index}`} size={{ xs: 12, sm: 6, lg: 3 }} sx={{ height: '250px', paddingBottom: '14px' }}>
                            <BurstCard bands={band} graphBands={graphBands} setGraphBands={setGraphBands} />
                        </Grid>
                    )
                    : Array.from(2).map((_, index) => <Skeleton key={`band-skeleton-${index}`} variant="rounded" />)
                }

                <Grid size={{ xs: 12, sm: 12, lg: 8, xl: 4 }} >
                    <PlayerDamagePieChart chartData={damagePieChartData} />
                </Grid>
                <Grid size={{ xs: 12, sm: 12, lg: 12, xl: 8 }} >
                    {(damageOverTimeData && graphLargestDamageInstance && graphBands.length) ?
                        <DecoratedDamageOverTimeLineGraph chartData={damageOverTimeData} bands={graphBands} largestDamageInstance={graphLargestDamageInstance} start_ut={start_ut} />
                        :
                        <Skeleton variant="rounded" />
                    }
                </Grid>
                <Grid size={{ xs: 12, sm: 12, lg: 12, xl: 12 }} >
                    {(damageOverTimeData && graphLargestDamageInstance && graphBands.length) ?
                        <DamageScatterPlot series={scatterPlotSeries} />
                        :
                        <Skeleton variant="rounded" />
                    }
                </Grid>
                <Grid size={12} >
                    {combinedDamageOverTimeData.length !== 0 ? (
                        <TrimLineGraph chartData={combinedDamageOverTimeData} start_ut={start_ut} end_ut={end_ut} />
                    ) : (
                        <Skeleton variant="rounded" />
                    )
                    }
                </Grid>
            </Grid>
        </Box >
    );
}
