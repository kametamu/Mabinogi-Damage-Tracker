import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataGrid } from '@mui/x-data-grid';
import { localizeSkillName } from '../localization/skills';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

const paginationModel = { page: 0, pageSize: 10 };

export default function SkillDamageRankingTable({ start_ut, end_ut }) {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [topN, setTopN] = useState(100);

  useEffect(() => {
    fetch(`http://${window.location.hostname}:5004/Home/GetSkillDamageRanking?start_ut=${start_ut}&end_ut=${end_ut}`)
      .then((response) => response.json())
      .then((data) => {
        setRows((data || []).map((item, index) => ({
          id: `${item.playerId}-${item.skillId}-${index}`,
          playerName: item.playerName,
          skillId: item.skillId,
          totalDamage: item.totalDamage,
          hitCount: item.hitCount,
        })));
      })
      .catch((error) => {
        console.error('Error:', error);
        setRows([]);
      });
  }, [start_ut, end_ut]);

  const filteredRows = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    let result = rows;

    if (search) {
      result = rows.filter((row) => {
        const localizedSkill = localizeSkillName(row.skillId, null, i18n.language);
        return row.playerName.toLowerCase().includes(lowerSearch) || localizedSkill.toLowerCase().includes(lowerSearch);
      });
    }

    if (topN === 'all') {
      return result;
    }

    return result.slice(0, Number(topN));
  }, [i18n.language, rows, search, topN]);

  const columns = [
    {
      field: 'skillId',
      headerName: t('analytics.skill'),
      flex: 1,
      minWidth: 180,
      renderCell: (params) => localizeSkillName(params.row.skillId, null, i18n.language),
    },
    { field: 'playerName', headerName: t('analytics.player'), flex: 1, minWidth: 140 },
    {
      field: 'totalDamage',
      headerName: t('analytics.totalDamage'),
      flex: 1,
      minWidth: 130,
      type: 'number',
      valueFormatter: (value) => Number(value || 0).toLocaleString(),
    },
    {
      field: 'hitCount',
      headerName: t('analytics.hits'),
      flex: 0.6,
      minWidth: 100,
      type: 'number',
    },
  ];

  return (
    <Paper sx={{ p: 1 }}>
      <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label={t('analytics.search')}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="ranking-top-n-label">Top N</InputLabel>
          <Select
            labelId="ranking-top-n-label"
            value={topN}
            label="Top N"
            onChange={(e) => setTopN(e.target.value)}
          >
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
            <MenuItem value={'all'}>{t('analytics.all')}</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <DataGrid
        rows={filteredRows}
        columns={columns}
        pageSizeOptions={[10, 20, 50]}
        initialState={{
          pagination: { paginationModel },
          sorting: { sortModel: [{ field: 'totalDamage', sort: 'desc' }] },
        }}
        disableRowSelectionOnClick
        sx={{ border: 0 }}
        localeText={{ noRowsLabel: t('analytics.noRows') }}
      />
    </Paper>
  );
}
