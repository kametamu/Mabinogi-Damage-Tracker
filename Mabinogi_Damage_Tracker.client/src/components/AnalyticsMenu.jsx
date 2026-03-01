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
import SkillDamageByPlayerTable from './SkillDamageByPlayerTable';
import SkillDamageRankingTable from './SkillDamageRankingTable';
import UnknownSkillsDebugPanel from './UnknownSkillsDebugPanel';

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


async function fetchJsonOrDefault(url, fallback) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return fallback;
        }
        const data = await response.json();
        return data ?? fallback;
    } catch (error) {
        console.error('Error:', error);
        return fallback;
    }
}

export default function AnalyticsMenu({ start_ut, end_ut }) {
    const { t } = useTranslation();
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
    // Scatter Plot
    const [scatterPlotSeries, setScatterPlotSeries] = useState([]);


    useEffect(() => {

        // GetDamangeBands()
        async function getDamageBands() {
            const newBands = [];
            const newGraphBands = [];

            const bands60 = await fetchJsonOrDefault(`http://${window.location.hostname}:5004/Home/GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes?start_ut=${start_ut}&end_ut=${end_ut}&burst_timeframe=${60}&count=${burstCount}`, []);
            const normalized60 = Array.isArray(bands60) ? bands60 : [];
            const mapped60 = normalized60.map((res) => ({
                label: '60s',
                start: formatTimeStamp(res.unix_timestamp),
                end: formatTimeStamp(res.unix_timestamp + 60),
                ...res,
            }));
            if (mapped60.length > 0) {
                newGraphBands.push(mapped60[0]);
            }
            newBands.push(mapped60);

            const bands30 = await fetchJsonOrDefault(`http://${window.location.hostname}:5004/Home/GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes?start_ut=${start_ut}&end_ut=${end_ut}&burst_timeframe=${30}&count=${burstCount}`, []);
            const normalized30 = Array.isArray(bands30) ? bands30 : [];
            const mapped30 = normalized30.map((res) => ({
                label: '30s',
                start: formatTimeStamp(res.unix_timestamp),
                end: formatTimeStamp(res.unix_timestamp + 60),
                ...res,
            }));
            if (mapped30.length > 0) {
                newGraphBands.push(mapped30[0]);
            }
            newBands.push(mapped30);

            const bands15 = await fetchJsonOrDefault(`http://${window.location.hostname}:5004/Home/GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes?start_ut=${start_ut}&end_ut=${end_ut}&burst_timeframe=${15}&count=${burstCount}`, []);
            const normalized15 = Array.isArray(bands15) ? bands15 : [];
            const mapped15 = normalized15.map((res) => ({
                label: '15s',
                start: formatTimeStamp(res.unix_timestamp),
                end: formatTimeStamp(res.unix_timestamp + 60),
                ...res,
            }));
            if (mapped15.length > 0) {
                newGraphBands.push(mapped15[0]);
            }
            newBands.push(mapped15);

            setGraphBands(newGraphBands);
            setBands(newBands);
        }
        // End of GetDamangeBands()


        fetchJsonOrDefault(`http://${window.location.hostname}:5004/Home/GetAggregatedDamageSeriesGroupedByPlayers?start_ut=${start_ut}&end_ut=${end_ut}`, [])
            .then(data => {
                const safeData = Array.isArray(data) ? data : [];
                const sortedData = [...safeData].sort((a, b) => {
                    const damageA = a?.data?.at?.(-1) ?? 0;
                    const damageB = b?.data?.at?.(-1) ?? 0;
                    return damageB - damageA;
                });

                const newLineChartData = transformDataLineChartDamage(sortedData);
                setDamageOverTimeData(newLineChartData);

                const newCombinedDamageOverTimeData = newLineChartData[0]?.data?.map((_, index) =>
                    newLineChartData.reduce((sum, series) => sum + (series.data[index] ?? 0), 0)
                ) ?? [];

                setCombinedDamageOverTimeData(newCombinedDamageOverTimeData);

                const newPieChartData = transformDataPieDamage(sortedData);
                setDamagePieChartData(newPieChartData);

                const newTotalDamage = newCombinedDamageOverTimeData.at(-1) ?? 0;
                setTotalDamage(newTotalDamage);

                const newNumberOfPlayers = newLineChartData.length;
                setNumberOfPlayers(newNumberOfPlayers);
            });

        fetchJsonOrDefault(`http://${window.location.hostname}:5004/Home/GetListOfDistinctLargestSingleDamageInstance?start_ut=${start_ut}&end_ut=${end_ut}&count=${largestDamageInstanceCount}`, [])
            .then(data => {
                const safeData = Array.isArray(data) ? data : [];
                setLargestDamageInstances(safeData);
                setGraphLargestDamageInstance(safeData[0] ?? null);
            });

        fetchJsonOrDefault(`http://${window.location.hostname}:5004/Home/GetTotalPlayerHealing?start_ut=${start_ut}&end_ut=${end_ut}`, 0)
            .then(data => {
                setTotalHealing(typeof data === 'number' ? data : 0);
            });


        fetchJsonOrDefault(`http://${window.location.hostname}:5004/Home/GetDamagesBetweenUt?start_ut=${start_ut}&end_ut=${end_ut}`, [])
            .then(data => {
                const safeData = Array.isArray(data) ? data : [];
                const dmgMap = new Map();

                const series = safeData.reduce((accSeries, damage_simple) => {
                    let entry = accSeries.find((element) => element.label === damage_simple.player_name);

                    if (!entry) {
                        entry = {
                            label: damage_simple.player_name,
                            highlightScope: { highlight: 'series', fade: 'global' },
                            markerSize: 2,
                            data: [],
                        };
                        dmgMap.set(damage_simple.player_name, 0);
                        accSeries.push(entry);
                    }

                    entry.data.push({
                        x: damage_simple.unix_timestamp,
                        y: damage_simple.damage,
                        id: entry.data.length,
                    });

                    dmgMap.set(damage_simple.player_name, (dmgMap.get(damage_simple.player_name) ?? 0) + damage_simple.damage);

                    return accSeries;
                }, []);

                series.sort((a, b) => (dmgMap.get(b.label) ?? 0) - (dmgMap.get(a.label) ?? 0));

                setScatterPlotSeries(series);
            });

        getDamageBands()
    }, [start_ut, end_ut, burstCount, largestDamageInstanceCount]);
    
    return (
        <Box>
            <Typography variant="h2" sx={{ marginBottom: "8px"}}>{t('analytics.title')}</Typography>
            <Grid container spacing={{ xs: 1, md: 2 }} alignItems="stretch" sx={{ flexGrow: 1 }}>
                { /* Total Damage Card */}
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ height: '220px' }} >
                    {combinedDamageOverTimeData ?
                        <DamageCard chartData={combinedDamageOverTimeData} totalDamage={totalDamage} />
                        :
                        <Skeleton variant="rounded" />
                    }
                </Grid>
                { /* Number of Players Card */}
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ height: '220px' }}>
                    {numberOfPlayer ?
                        <PlayerCountCard count={numberOfPlayer} />
                        :
                        <Skeleton variant="rounded" />
                    }
                </Grid> 
                { /* Time Card */}
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ height: '220px' }}>
                    <TimeCard length_ut={end_ut - start_ut} />
                </Grid>
                { /* Largest Damage Instance Card */}
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ height: '220px' }}>
                    {largestDamageInstances.length ?
                        <LargestHitCard largestDamageInstances={largestDamageInstances} setGraphLargestDamageInstance={setGraphLargestDamageInstance} />
                    :
                        <Skeleton variant="rounded" />
                    }
                </Grid>
                { /* Largets Burst Cards */ }
                {bands.length ? 
                    bands.map((band, index) =>
                        <Grid key={`band_${index}`} size={{ xs: 12, sm: 6, lg: 3 }} sx={{ height: '250px' }}>
                            <BurstCard bands={band} graphBands={graphBands} setGraphBands={setGraphBands} />
                        </Grid>
                    )
                    : Array.from(2).map((_) => <Skeleton variant="rounded" />)
                }
                { /* Total Healing Card */}
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ }}>
                    {combinedDamageOverTimeData ?
                        <HealingCard totalHealing={totalHealing} />
                        :
                        <Skeleton variant="rounded" />
                    }
                </Grid>
                { /* Player Damange Pie Chart */}
                <Grid size={{ xs: 12, sm: 12, lg: 8, xl: 4 }} >
                    <PlayerDamagePieChart chartData={damagePieChartData} />
                </Grid>
                { /* Player Damage Line Chart */}
                <Grid size={{ xs: 12, sm: 12, lg: 12, xl: 8 }} >
                    {(damageOverTimeData && graphLargestDamageInstance && graphBands.length) ?
                        <DecoratedDamageOverTimeLineGraph chartData={damageOverTimeData} bands={graphBands} largestDamageInstance={graphLargestDamageInstance} start_ut={start_ut} />
                        :
                        <Skeleton variant="rounded" />
                    }
                </Grid>
                { /* Player Damage Scatter Plot */}
                <Grid size={{ xs: 12, sm: 12, lg: 12, xl: 12 }} >
                    {(damageOverTimeData && graphLargestDamageInstance && graphBands.length) ?
                        <DamageScatterPlot series={scatterPlotSeries}/>
                        :
                        <Skeleton variant="rounded" />
                    }
                </Grid>
                { /* Trim Line Graph */}
                <Grid size={12} > 
                    {combinedDamageOverTimeData.length !== 0 ? (
                        <TrimLineGraph chartData={combinedDamageOverTimeData} start_ut={start_ut} end_ut={end_ut} />
                    ) : (
                        <Skeleton variant="rounded"/>
                        )
                    }
                </Grid>

                <Grid size={{ xs: 12, lg: 6 }}>
                    <Typography variant="h4" sx={{ mb: 1 }}>{t('analytics.skillDamage')}</Typography>
                    <SkillDamageByPlayerTable start_ut={start_ut} end_ut={end_ut} />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Typography variant="h4" sx={{ mb: 1 }}>{t('analytics.skillDamageRanking')}</Typography>
                    <SkillDamageRankingTable start_ut={start_ut} end_ut={end_ut} />
                </Grid>

                <Grid size={12}>
                    <UnknownSkillsDebugPanel start_ut={start_ut} end_ut={end_ut} />
                </Grid>
            </Grid>
       </Box >
  );
}
