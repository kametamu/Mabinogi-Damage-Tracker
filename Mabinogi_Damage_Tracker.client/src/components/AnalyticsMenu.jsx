import { useState, useEffect, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../AppContext'
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import DamageCard from './DamageCard';
import PlayerCountCard from './PlayerCountCard';
import TimeCard from './TimeCard';
import TrimLineGraph from './TrimLineGraph';
import PlayerDamagePieChart from './PlayerDamagePieChart';
import SkillUsagePieChart from './SkillUsagePieChart';
import DecoratedDamageOverTimeLineGraph from './DecoratedDamageOverTimeLineGraph';
import DamageScatterPlot from './DamageScatterPlot';
import LargestHitCard from './LargestHitCard';
import BurstCard from './BurstCard';
import HealingCard from './HealingCard';
import { getLocalizedSkillName } from '../localization/i18n/skills';

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
        type: 'line',
        id: item.id,
        label: item.label,
        data: item.data,
        area: false,
        showMark: false,
    }));
}

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

    const [skillDamagesRaw, setSkillDamagesRaw] = useState([]);
    const [selectedSkillPlayerId, setSelectedSkillPlayerId] = useState('all');

    useEffect(() => {
        async function getDamageBands() {
            const newBands = []
            const newGraphBands = []
            await fetch(`http://${window.location.hostname}:5004/Home/GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes?start_ut=${start_ut}&end_ut=${end_ut}&burst_timeframe=${60}&count=${burstCount}`)
                .then(response => response.json())
                .then(data => {
                    const bands = data.map((res) => ({
                        label: '60s',
                        start: formatTimeStamp(res.unix_timestamp),
                        end: formatTimeStamp(res.unix_timestamp + 60),
                        ...res,
                    }))
                    if (bands.length > 0) {
                        newGraphBands.push(bands[0])
                        newBands.push(bands)
                    }
                })

            await fetch(`http://${window.location.hostname}:5004/Home/GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes?start_ut=${start_ut}&end_ut=${end_ut}&burst_timeframe=${30}&count=${burstCount}`)
                .then(response => response.json())
                .then(data => {
                    const bands = data.map((res) => ({
                        label: '30s',
                        start: formatTimeStamp(res.unix_timestamp),
                        end: formatTimeStamp(res.unix_timestamp + 30),
                        ...res,
                    }))
                    if (bands.length > 0) {
                        newGraphBands.push(bands[0])
                        newBands.push(bands)
                    }
                })

            await fetch(`http://${window.location.hostname}:5004/Home/GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes?start_ut=${start_ut}&end_ut=${end_ut}&burst_timeframe=${15}&count=${burstCount}`)
                .then(response => response.json())
                .then(data => {
                    const bands = data.map((res) => ({
                        label: '15s',
                        start: formatTimeStamp(res.unix_timestamp),
                        end: formatTimeStamp(res.unix_timestamp + 15),
                        ...res,
                    }))
                    if (bands.length > 0) {
                        newGraphBands.push(bands[0])
                        newBands.push(bands)
                    }
                })
            setGraphBands(newGraphBands)
            setBands(newBands)
        }

        fetch(`http://${window.location.hostname}:5004/Home/GetAggregatedDamageSeriesGroupedByPlayers?start_ut=${start_ut}&end_ut=${end_ut}`)
            .then(response => response.json())
            .then(data => {
                const sortedData = data.sort((a, b) => (b.data.at(-1) ?? 0) - (a.data.at(-1) ?? 0));
                const newLineChartData = transformDataLineChartDamage(sortedData)
                setDamageOverTimeData(newLineChartData);

                const newCombinedDamageOverTimeData = newLineChartData[0]?.data?.map((_, index) =>
                    newLineChartData.reduce((sum, series) => sum + (series.data[index] ?? 0), 0)
                ) ?? [];

                setCombinedDamageOverTimeData(newCombinedDamageOverTimeData)
                setDamagePieChartData(transformDataPieDamage(sortedData));
                setTotalDamage(newCombinedDamageOverTimeData.at(-1));
                setNumberOfPlayers(newLineChartData.length)
            })
            .catch(error => console.error('Error:', error));

        fetch(`http://${window.location.hostname}:5004/Home/GetListOfDistinctLargestSingleDamageInstance?start_ut=${start_ut}&end_ut=${end_ut}&count=${largestDamageInstanceCount}`)
            .then(response => response.json())
            .then(data => {
                setLargestDamageInstances(data)
                setGraphLargestDamageInstance(data[0])
            })

        fetch(`http://${window.location.hostname}:5004/Home/GetTotalPlayerHealing?start_ut=${start_ut}&end_ut=${end_ut}`)
            .then(response => response.json())
            .then(data => {
                setTotalHealing(data)
            })

        fetch(`http://${window.location.hostname}:5004/Home/GetDamagesBetweenUt?start_ut=${start_ut}&end_ut=${end_ut}`)
            .then(response => response.json())
            .then(data => {
                const dmgMap = new Map();

                const series = data.reduce((acc, damageSimple) => {
                    let entry = acc.find((element) => element.label === damageSimple.player_name);

                    if (!entry) {
                        entry = {
                            label: damageSimple.player_name,
                            highlightScope: { highlight: 'series', fade: 'global' },
                            markerSize: 2,
                            data: [],
                        }
                        dmgMap.set(damageSimple.player_name, 0)
                        acc.push(entry)
                    }

                    entry.data.push({
                        x: damageSimple.unix_timestamp,
                        y: damageSimple.damage,
                        id: entry.data.length
                    });

                    dmgMap.set(damageSimple.player_name, dmgMap.get(damageSimple.player_name) + damageSimple.damage);

                    return acc
                }, []);

                series.sort((a, b) => dmgMap.get(b.label) - dmgMap.get(a.label))
                setScatterPlotSeries(series)
            })

        fetch(`http://${window.location.hostname}:5004/Home/GetSkillDamagesBetweenUt?start_ut=${start_ut}&end_ut=${end_ut}`)
            .then(response => response.json())
            .then(data => {
                const nextData = data ?? [];
                setSkillDamagesRaw(nextData);
                setSelectedSkillPlayerId((prevSelectedPlayerId) => {
                    if (prevSelectedPlayerId === 'all') {
                        return 'all';
                    }

                    const availablePlayerIds = new Set(nextData.map((row) => String(row.player_id)));
                    return availablePlayerIds.has(prevSelectedPlayerId) ? prevSelectedPlayerId : 'all';
                });
            })
            .catch(error => {
                console.error('Error:', error);
                setSkillDamagesRaw([]);
            });

        getDamageBands()
    }, [start_ut, end_ut, burstCount, largestDamageInstanceCount]);

    const skillPlayerOptions = useMemo(() => {
        const map = new Map();
        skillDamagesRaw.forEach((row) => {
            map.set(String(row.player_id), row.player_name || String(row.player_id));
        });
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [skillDamagesRaw]);

    const filteredSkillDamages = useMemo(() => {
        if (selectedSkillPlayerId === 'all') return skillDamagesRaw;
        return skillDamagesRaw.filter((row) => String(row.player_id) === selectedSkillPlayerId);
    }, [skillDamagesRaw, selectedSkillPlayerId]);

    const skillUsageRatioData = useMemo(() => {
        const usageMap = new Map();
        filteredSkillDamages.forEach((row) => {
            const skillId = row.skill_id;
            usageMap.set(skillId, (usageMap.get(skillId) || 0) + 1);
        });

        return Array.from(usageMap.entries())
            .map(([skillId, count]) => ({
                label: getLocalizedSkillName(skillId, null, i18n.language),
                value: count,
                skillId,
            }))
            .sort((a, b) => b.value - a.value);
    }, [filteredSkillDamages, i18n.language]);

    const damageBySkillRows = useMemo(() => {
        const damageMap = new Map();

        filteredSkillDamages.forEach((row) => {
            const skillId = row.skill_id;
            damageMap.set(skillId, (damageMap.get(skillId) || 0) + row.damage);
        });

        return Array.from(damageMap.entries())
            .map(([skillId, damage]) => ({
                skillId,
                skillName: getLocalizedSkillName(skillId, null, i18n.language),
                totalDamage: damage,
            }))
            .sort((a, b) => b.totalDamage - a.totalDamage);
    }, [filteredSkillDamages, i18n.language]);

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
                    : Array.from(2).map((_, index) => <Skeleton key={index} variant="rounded" />)
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
                <Grid size={{ xs: 12, md: 12 }}>
                    <Paper sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <FormControl size="small" sx={{ minWidth: 260 }}>
                            <InputLabel id="skill-player-filter-label">{t('analytics.skillPlayerFilter')}</InputLabel>
                            <Select
                                labelId="skill-player-filter-label"
                                value={selectedSkillPlayerId}
                                label={t('analytics.skillPlayerFilter')}
                                onChange={(event) => setSelectedSkillPlayerId(event.target.value)}
                            >
                                <MenuItem value="all">{t('analytics.allPlayers')}</MenuItem>
                                {skillPlayerOptions.map((player) => (
                                    <MenuItem key={player.id} value={player.id}>{`${player.name} (${player.id})`}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, sm: 12, lg: 8, xl: 4 }} >
                    <Paper square={false} sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h4">{t('analytics.skillUsageRatio')}</Typography>
                        <SkillUsagePieChart chartData={skillUsageRatioData} />
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 12, lg: 4, xl: 8 }}>
                    <Paper square={false} sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h4" sx={{ mb: 1 }}>{t('analytics.damageBySkill')}</Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('analytics.skill')}</TableCell>
                                        <TableCell align="right">{t('common.totalDamage')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {damageBySkillRows.map((row) => (
                                        <TableRow key={row.skillId}>
                                            <TableCell>{row.skillName}</TableCell>
                                            <TableCell align="right">{formatLargeNumber(row.totalDamage)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Box >
    );
}
