import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { localizeSkillName } from '../localization/skills';

export default function LiveSkillDamageTable({ rows = [] }) {
  const { t, i18n } = useTranslation();
  const [playerFilter, setPlayerFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');

  const filteredRows = useMemo(() => {
    const playerKeyword = playerFilter.trim().toLowerCase();
    const skillKeyword = skillFilter.trim().toLowerCase();
    const safeRows = Array.isArray(rows) ? rows : [];

    return safeRows.filter((row) => {
      const localizedSkill = localizeSkillName(row.skillId, null, i18n.language).toLowerCase();
      const playerMatch = playerKeyword === '' || (row.playerName ?? '').toLowerCase().includes(playerKeyword);
      const skillMatch = skillKeyword === '' || localizedSkill.includes(skillKeyword);
      return playerMatch && skillMatch;
    });
  }, [i18n.language, playerFilter, rows, skillFilter]);

  const visibleRows = useMemo(
    () => filteredRows.slice(0, 20),
    [filteredRows],
  );

  return (
    <Paper square={false} sx={{ p: 2, height: '100%' }}>
      <Typography variant="h4" sx={{ mb: 2 }}>{t('analytics.liveSkillDamage')}</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          value={playerFilter}
          onChange={(e) => setPlayerFilter(e.target.value)}
          label={t('analytics.player')}
        />
        <TextField
          size="small"
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          label={t('analytics.skill')}
        />
      </Box>
      <TableContainer>
        <Table size="small" aria-label="live skill damage table">
          <TableHead>
            <TableRow>
              <TableCell>{t('analytics.skill')}</TableCell>
              <TableCell>{t('analytics.player')}</TableCell>
              <TableCell align="right">{t('analytics.totalDamage')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row, index) => (
              <TableRow key={row.id ?? `${row.playerId}-${row.skillId}-${index}`}>
                <TableCell>{localizeSkillName(row.skillId, null, i18n.language)}</TableCell>
                <TableCell>{row.playerName ?? row.playerId}</TableCell>
                <TableCell align="right">{Number(row.totalDamage || 0).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">{t('analytics.noRows')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
