import { useState, useEffect, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../AppContext'
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
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

function formatTimeStamp(ut) {
    return new Date((ut) * 1000).toLocaleTimeString(
        [],
        { hour: 'numeric', minute: '2-digit', second: '2-digit' }
    );
}

function transformDataPieDamage(apiData) {
    return apiData.map(item => ({
        label: item.label,
        value: item.data.at(-1)
    }));
}

function transformDataLineChartDamage(apiData) {
    return apiData.map(item => ({
        type: "line",
        id: item.id,
        label: item.label,
        data: item.data,
        area: false,
        showMark: false,
    }));
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
    const [enemyIds, setEnemyIds] = useState([])
    const [selectedEnemyId, setSelectedEnemyId] = useState('all')

    const getEnemyDisplayName = (enemyId) => {
        const translated = i18n.t(`enemies.${enemyId}`, { defaultValue: enemyId })
        return translated || enemyId
    }

    const enemyOptions = useMemo(() => {
        return enemyIds.map((enemyId) => ({
            id: enemyId,
            label: getEnemyDisplayName(enemyId)
        }))
    }, [enemyIds, i18n.language])

    const getUrl = (path, query = {}) => {
        const params = new URLSearchParams(query)
        if (selectedEnemyId !== 'all') {
            params.set('enemy_id', selectedEnemyId)
        }

        return `http://${window.location.hostname}:5004/Home/${path}?${params.toString()}`
    }

    useEffect(() => {
        fetch(`http://${window.location.hostname}:5004/Home/GetDistinctEnemyIdsBetweenUt?start_ut=${start_ut}&end_ut=${end_ut}`)
            .then(response => response.json())
            .then(data => {
                setEnemyIds(data ?? [])
            })
            .catch(error => console.error('Error:', error));
    }, [start_ut, end_ut]);

    useEffect(() => {
        async function getDamageBands() {
            const newBands = []
            const newGraphBands = []
            for (const timeframe of [60, 30, 15]) {
                await fetch(getUrl('GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes', { start_ut, end_ut, burst_timeframe: timeframe, count: burstCount }))
                    .then(response => response.json())
                    .then(data => {
                        const timeframeBands = (data ?? []).map((res) => ({
                            label: `${timeframe}s`,
                            start: formatTimeStamp(res.unix_timestamp),
                            end: formatTimeStamp(res.unix_timestamp + timeframe),
                            ...res,
                        }))

                        if (timeframeBands.length > 0) {
                            newGraphBands.push(timeframeBands[0])
                            newBands.push(timeframeBands)
                        }
                    })
            }

            setGraphBands(newGraphBands)
            setBands(newBands)
        }

        fetch(getUrl('GetAggregatedDamageSeriesGroupedByPlayers', { start_ut, end_ut }))
            .then(response => response.json())
            .then(data => {
                const sortedData = (data ?? []).sort((a, b) => (b.data.at(-1) ?? 0) - (a.data.at(-1) ?? 0));

                const newLineChartData = transformDataLineChartDamage(sortedData)
                setDamageOverTimeData(newLineChartData);

                const newCombinedDamageOverTimeData = newLineChartData[0]?.data?.map((_, index) =>
                    newLineChartData.reduce((sum, series) => sum + (series.data[index] ?? 0), 0)
                ) ?? [];

                setCombinedDamageOverTimeData(newCombinedDamageOverTimeData)
                setDamagePieChartData(transformDataPieDamage(sortedData));
                setTotalDamage(newCombinedDamageOverTimeData.at(-1) ?? 0)
                setNumberOfPlayers(newLineChartData.length)
            })
            .catch(error => console.error('Error:', error));

        fetch(getUrl('GetListOfDistinctLargestSingleDamageInstance', { start_ut, end_ut, count: largestDamageInstanceCount }))
            .then(response => response.json())
            .then(data => {
                setLargestDamageInstances(data ?? [])
                setGraphLargestDamageInstance(data?.[0] ?? null)
            })

        fetch(`http://${window.location.hostname}:5004/Home/GetTotalPlayerHealing?start_ut=${start_ut}&end_ut=${end_ut}`)
            .then(response => response.json())
            .then(data => {
                setTotalHealing(data)
            })


        fetch(getUrl('GetDamagesBetweenUt', { start_ut, end_ut }))
            .then(response => response.json())
            .then(data => {
                const dmgMap = new Map();

                const series = (data ?? []).reduce((series, damage_simple) => {
                    let entry = series.find((element) => element.label === damage_simple.player_name);

                    if (!entry) {
                        entry = {
                            label: damage_simple.player_name,
                            highlightScope: { highlight: 'series', fade: 'global' },
                            markerSize: 2,
                            data: [],
                        }
                        dmgMap.set(damage_simple.player_name, 0)
                        series.push(entry)
                    }

                    entry.data.push({
                        x: damage_simple.unix_timestamp,
                        y: damage_simple.damage,
                        id: entry.data.length
                    });

                    dmgMap.set(damage_simple.player_name, dmgMap.get(damage_simple.player_name) + damage_simple.damage);

                    return series
                }, []);

                series.sort((a, b) => dmgMap.get(b.label) - dmgMap.get(a.label))

                setScatterPlotSeries(series)
            })

        getDamageBands()
    }, [start_ut, end_ut, burstCount, largestDamageInstanceCount, selectedEnemyId]);

    return (
        <Box>
            <Typography variant="h2" sx={{ marginBottom: "8px" }}>{t('analytics.title')}</Typography>
            <Box sx={{ marginBottom: 2 }}>
                <FormControl size="small" sx={{ minWidth: 280 }}>
                    <InputLabel id="enemy-filter-select-label">{t('analytics.enemyFilter')}</InputLabel>
                    <Select
                        labelId="enemy-filter-select-label"
                        value={selectedEnemyId}
                        label={t('analytics.enemyFilter')}
                        onChange={(event) => setSelectedEnemyId(event.target.value)}
                    >
                        <MenuItem value="all">{t('analytics.enemyFilterAll')}</MenuItem>
                        {enemyOptions.map((enemy) => (
                            <MenuItem key={enemy.id} value={enemy.id}>{enemy.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>
            <Grid container spacing={{ xs: 1, md: 2 }} alignItems="stretch" sx={{ flexGrow: 1 }}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} >
                    {combinedDamageOverTimeData ?
                        <DamageCard
                            chartData={combinedDamageOverTimeData}
                            totalDamage={totalDamage}
                            title={selectedEnemyId === 'all'
                                ? t('common.totalDamage')
                                : t('analytics.totalDamageFiltered', { enemy: getEnemyDisplayName(selectedEnemyId) })}
                        />
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
                    : Array.from(2).map((_, idx) => <Skeleton key={`band-skeleton-${idx}`} variant="rounded" />)
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
