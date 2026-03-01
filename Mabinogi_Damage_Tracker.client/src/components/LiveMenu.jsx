import { useState, useEffect, useRef, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../AppContext';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import PlayerDamagePieChart from './PlayerDamagePieChart';
import DamangeOverTimeLineGraph from './DamageOverTimeLineGraph';
import LinearProgress from '@mui/material/LinearProgress';
import LogStream from './LogStream';
import PlayerDamageGauge from './PlayerDamageGauge';
import LiveSkillDamageTable from './LiveSkillDamageTable';

const RecordingButtonStyle = {
    width: '100%',
    height: 125,
};

function mapTotalDamageToPie(totalRows) {
    const safeRows = Array.isArray(totalRows) ? totalRows : [];
    return safeRows.map((item) => ({
        label: String(item.playerId),
        value: Number(item.totalDamage ?? 0),
    }));
}

function mapDoTToLine(dotRows) {
    const safeRows = Array.isArray(dotRows) ? dotRows : [];
    return safeRows.map((item) => ({
        id: item.playerId,
        label: String(item.playerId),
        data: Array.isArray(item.points)
            ? item.points.map((p) => Number(p.cumulativeDamage ?? 0))
            : [],
        area: false,
        showMark: false,
    }));
}

export default function LiveMenu() {
    const { t } = useTranslation();
    const { pollingRate } = useContext(AppContext);
    const [recording, setRecording] = useState(false);
    const [damagePieChartData, setDamagePieChartData] = useState([]);
    const [damageOverTimeData, setDamageOverTimeData] = useState([]);
    const [startUT, setStartUT] = useState(0);
    const [averageDPS, setAverageDPS] = useState(0);
    const [DPS, setDPS] = useState(0);
    const [liveSkillRows, setLiveSkillRows] = useState([]);

    const totalEsRef = useRef(null);
    const dotEsRef = useRef(null);
    const meterEsRef = useRef(null);
    const skillEsRef = useRef(null);

    const closeStreams = () => {
        totalEsRef.current?.close();
        dotEsRef.current?.close();
        meterEsRef.current?.close();
        skillEsRef.current?.close();
        totalEsRef.current = null;
        dotEsRef.current = null;
        meterEsRef.current = null;
        skillEsRef.current = null;
    };

    const openStreams = () => {
        closeStreams();

        totalEsRef.current = new EventSource(`http://${window.location.hostname}:5004/api/DataStream/TotalDamage`);
        totalEsRef.current.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                setDamagePieChartData(mapTotalDamageToPie(payload));
            } catch (error) {
                console.error('TotalDamage SSE parse failed', error);
            }
        };

        dotEsRef.current = new EventSource(`http://${window.location.hostname}:5004/api/DataStream/DamageOverTime`);
        dotEsRef.current.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                setDamageOverTimeData(mapDoTToLine(payload));
            } catch (error) {
                console.error('DamageOverTime SSE parse failed', error);
            }
        };

        meterEsRef.current = new EventSource(`http://${window.location.hostname}:5004/api/DataStream/DamageMeter`);
        meterEsRef.current.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                setDPS(Number(payload.currentDps ?? 0));
                setAverageDPS(Number(payload.avgDps ?? 0));
            } catch (error) {
                console.error('DamageMeter SSE parse failed', error);
            }
        };

        skillEsRef.current = new EventSource(`http://${window.location.hostname}:5004/api/DataStream/LiveSkillDamage`);
        skillEsRef.current.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                const rows = Array.isArray(payload) ? payload : [];
                setLiveSkillRows(rows.map((item, index) => ({
                    id: `${item.playerId}-${item.skillId}-${index}`,
                    ...item,
                })));
            } catch (error) {
                console.error('LiveSkillDamage SSE parse failed', error);
            }
        };
    };

    useEffect(() => {
        if (!recording) {
            closeStreams();
            return;
        }

        openStreams();

        return () => closeStreams();
    }, [recording, pollingRate]);

    useEffect(() => () => closeStreams(), []);

    const toggleRecording = async () => {
        if (recording) {
            const endUT = Math.floor(Date.now() / 1000);
            await fetch(`http://${window.location.hostname}:5004/Home/PostRecording`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'unnamed',
                    start_ut: startUT,
                    end_ut: endUT,
                }),
            }).catch((error) => console.error('Error:', error));
        } else {
            const startTime = Math.floor(Date.now() / 1000);
            setStartUT(startTime);

            await fetch(`http://${window.location.hostname}:5004/Home/ResetLiveMetrics`, {
                method: 'POST',
            }).catch((error) => console.error('Error:', error));

            setDamagePieChartData([]);
            setDamageOverTimeData([]);
            setDPS(0);
            setAverageDPS(0);
            setLiveSkillRows([]);

        }

        setRecording(prev => !prev);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h2" sx={{ marginBottom: '24px' }}>{t('menu.live')}</Typography>
            <Paper sx={{ height: '100%', padding: 2 }}>
                <Grid container spacing={2}>
                    <Grid item size={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {recording ?
                            <Button sx={RecordingButtonStyle} variant="outlined" color="error" onClick={toggleRecording}>
                                End Recording
                            </Button>
                            :
                            <Button sx={RecordingButtonStyle} variant="contained" color="error" onClick={toggleRecording}>
                                Start Recording
                            </Button>
                        }
                    </Grid>
                    <Grid item size={10}>
                        <LogStream />
                        <LinearProgress value={0} variant={recording ? 'indeterminate' : 'determinate'} color="error" />
                    </Grid>
                </Grid>
            </Paper>

            <Grid container spacing={2} alignItems="stretch" sx={{ flexGrow: 1 }}>
                <Grid item size={{ xs: 12, sm: 12, lg: 8, xl: 4 }}>
                    <PlayerDamagePieChart chartData={damagePieChartData} />
                </Grid>
                <Grid item size={{ xs: 12, sm: 12, lg: 12, xl: 8 }}>
                    <DamangeOverTimeLineGraph chartData={damageOverTimeData} start_ut={startUT} />
                </Grid>
                <Grid item size={{ xs: 12, sm: 12, lg: 8, xl: 4 }}>
                    <PlayerDamageGauge value={DPS} averageDPS={averageDPS} />
                </Grid>

                <Grid item size={{ xs: 12, sm: 12, lg: 12, xl: 8 }}>
                    <LiveSkillDamageTable rows={liveSkillRows} />
                </Grid>
            </Grid>
        </Box>
    );
}
