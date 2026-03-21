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
import Stack from '@mui/material/Stack';
import { DataGrid } from '@mui/x-data-grid';
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
    const { burstCount, largestDamageInstanceCount, skillUsageTopN, topEnemyCount } = useContext(AppContext)
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
    const [skillUsageTopNLocal, setSkillUsageTopNLocal] = useState(skillUsageTopN);
    const [enemyFilterMode, setEnemyFilterMode] = useState('all');

    const activeTopEnemyCount = enemyFilterMode === 'top1' ? 1 : enemyFilterMode === 'topx' ? topEnemyCount : 0;

    const buildAnalyticsUrl = (path, params = {}, includeEnemyFilter = true) => {
        const searchParams = new URLSearchParams({
            start_ut,
            end_ut,
            ...params,
        });

        if (includeEnemyFilter && activeTopEnemyCount > 0) {
            searchParams.set('top_enemy_count', String(activeTopEnemyCount));
        }

        return `http://${window.location.hostname}:5004/Home/${path}?${searchParams.toString()}`;
    };

    const damageCardTitle = useMemo(() => {
        if (enemyFilterMode === 'top1') return t('analytics.totalDamageTop1');
        if (enemyFilterMode === 'topx') return t('analytics.totalDamageTopX', { count: topEnemyCount });
        return t('common.totalDamage');
    }, [enemyFilterMode, t, topEnemyCount]);

    useEffect(() => {
        async function getDamageBands() {
            const newBands = []
            const newGraphBands = []
            await fetch(buildAnalyticsUrl('GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes', { burst_timeframe: 60, count: burstCount }))
                .then(response => response.json())
                .then(data => {
                    const bands = (data ?? []).map((res) => ({
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

            await fetch(buildAnalyticsUrl('GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes', { burst_timeframe: 30, count: burstCount }))
                .then(response => response.json())
                .then(data => {
                    const bands = (data ?? []).map((res) => ({
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

            await fetch(buildAnalyticsUrl('GetListOfDistinctBiggestBurstofDamageInUTBetweenTimes', { burst_timeframe: 15, count: burstCount }))
                .then(response => response.json())
                .then(data => {
                    const bands = (data ?? []).map((res) => ({
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

        fetch(buildAnalyticsUrl('GetAggregatedDamageSeriesGroupedByPlayers'))
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
                setTotalDamage(newCombinedDamageOverTimeData.at(-1));
                setNumberOfPlayers(newLineChartData.length)
            })
            .catch(error => console.error('Error:', error));

        fetch(buildAnalyticsUrl('GetListOfDistinctLargestSingleDamageInstance', { count: largestDamageInstanceCount }))
            .then(response => response.json())
            .then(data => {
                const nextData = data ?? [];
                setLargestDamageInstances(nextData)
                setGraphLargestDamageInstance(nextData[0] ?? null)
            })

        fetch(buildAnalyticsUrl('GetTotalPlayerHealing', {}, false))
            .then(response => response.json())
            .then(data => {
                setTotalHealing(data)
            })

        fetch(buildAnalyticsUrl('GetDamagesBetweenUt'))
            .then(response => response.json())
            .then(data => {
                const dmgMap = new Map();

                const series = (data ?? []).reduce((acc, damageSimple) => {
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

        fetch(buildAnalyticsUrl('GetSkillDamagesBetweenUt'))
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
    }, [start_ut, end_ut, burstCount, largestDamageInstanceCount, activeTopEnemyCount]);

    useEffect(() => {
        setSkillUsageTopNLocal(skillUsageTopN);
    }, [skillUsageTopN]);

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

        const sortedSkills = Array.from(usageMap.entries())
            .map(([skillId, count]) => ({
                label: getLocalizedSkillName(skillId, null, i18n.language),
                value: count,
                skillId,
            }))
            .sort((a, b) => b.value - a.value);

        if (sortedSkills.length <= skillUsageTopNLocal) {
            return sortedSkills;
        }

        const topSkills = sortedSkills.slice(0, skillUsageTopNLocal);
        const otherValue = sortedSkills
            .slice(skillUsageTopNLocal)
            .reduce((sum, item) => sum + item.value, 0);

        return [
            ...topSkills,
            {
                label: t('analytics.otherSkills'),
                value: otherValue,
                skillId: 'other',
            },
        ];
    }, [filteredSkillDamages, i18n.language, skillUsageTopNLocal, t]);

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

    const paginatedDamageBySkillRows = useMemo(() => damageBySkillRows.map((row) => ({
        id: row.skillId,
        ...row,
    })), [damageBySkillRows]);

    const damageBySkillColumns = useMemo(() => ([
        { field: 'skillName', headerName: t('analytics.skill'), flex: 1, minWidth: 200, sortable: false },
        {
            field: 'totalDamage',
            headerName: t('common.totalDamage'),
            type: 'number',
            width: 200,
            align: 'right',
            headerAlign: 'right',
            valueFormatter: (value) => formatLargeNumber(value),
        },
    ]), [t]);

    return (
        <Box>
            <Typography variant="h2" sx={{ marginBottom: '8px' }}>{t('analytics.title')}</Typography>
            <Paper sx={{ p: 2, mb: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                    <Box>
                        <Typography variant="h6">{t('analytics.enemyFilter')}</Typography>
                        <Typography variant="body2" color="text.secondary">{t('analytics.enemyFilterDescription')}</Typography>
                    </Box>
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel id="enemy-filter-mode-label">{t('analytics.enemyFilter')}</InputLabel>
                        <Select
                            labelId="enemy-filter-mode-label"
                            value={enemyFilterMode}
                            label={t('analytics.enemyFilter')}
                            onChange={(event) => setEnemyFilterMode(event.target.value)}
                        >
                            <MenuItem value="all">{t('analytics.enemyFilterAll')}</MenuItem>
                            <MenuItem value="top1">{t('analytics.enemyFilterTop1')}</MenuItem>
                            <MenuItem value="topx">{t('analytics.enemyFilterTopX', { count: topEnemyCount })}</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </Paper>
            <Grid container spacing={{ xs: 1, md: 2 }} alignItems="stretch" sx={{ flexGrow: 1 }}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} >
                    {combinedDamageOverTimeData ?
                        <DamageCard chartData={combinedDamageOverTimeData} totalDamage={totalDamage} title={damageCardTitle} />
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
                <Grid size={{ xs: 12, md: 12 }}>
                    <Paper sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <FormControl size="small" sx={{ minWidth: 220 }}>
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
                        <FormControl size="small" sx={{ minWidth: 160, ml: 2 }}>
                            <InputLabel id="skill-top-n-filter-label">{t('analytics.skillUsageTopN')}</InputLabel>
                            <Select
                                labelId="skill-top-n-filter-label"
                                value={skillUsageTopNLocal}
                                label={t('analytics.skillUsageTopN')}
                                onChange={(event) => setSkillUsageTopNLocal(Number(event.target.value))}
                            >
                                {[5, 10, 15, 20, 30].map((value) => (
                                    <MenuItem key={value} value={value}>{value}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, sm: 12, lg: 6, xl: 6 }}>
                    <Paper square={false} sx={{ p: 2, height: '100%', minHeight: 420, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h4" sx={{ mb: 1 }}>{t('analytics.skillUsageRatio')}</Typography>
                        <Box sx={{ flex: 1, minHeight: 0 }}>
                            <SkillUsagePieChart chartData={skillUsageRatioData} />
                        </Box>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 12, lg: 6, xl: 6 }}>
                    <Paper square={false} sx={{ p: 2, height: '100%', minHeight: 420, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h4" sx={{ mb: 1 }}>{t('analytics.damageBySkill')}</Typography>
                        <Box sx={{ flex: 1, minHeight: 0 }}>
                            <DataGrid
                                rows={paginatedDamageBySkillRows}
                                columns={damageBySkillColumns}
                                pageSizeOptions={[5, 10, 20, 30, 60]}
                                disableColumnResize
                                disableRowSelectionOnClick
                                initialState={{
                                    pagination: { paginationModel: { page: 0, pageSize: 10 } },
                                    sorting: {
                                        sortModel: [{ field: 'totalDamage', sort: 'desc' }],
                                    },
                                }}
                                sx={{
                                    border: 0,
                                    backgroundColor: 'transparent',
                                    '& .MuiDataGrid-main': { border: 0 },
                                    '& .MuiDataGrid-columnHeaders': { backgroundColor: 'transparent' },
                                    '& .MuiDataGrid-footerContainer': { borderTop: 0 },
                                }}
                            />
                        </Box>
                    </Paper>
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
