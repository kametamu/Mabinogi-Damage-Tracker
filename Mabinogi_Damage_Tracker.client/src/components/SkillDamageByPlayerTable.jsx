import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataGrid } from '@mui/x-data-grid';
import { localizeSkillName } from '../localization/skills';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';

const paginationModel = { page: 0, pageSize: 10 };

export default function SkillDamageByPlayerTable({ start_ut, end_ut }) {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`http://${window.location.hostname}:5004/Home/GetSkillDamageByPlayerAndSkill?start_ut=${start_ut}&end_ut=${end_ut}`)
      .then((response) => response.json())
      .then((data) => {
        setRows((data || []).map((item, index) => ({
          id: `${item.playerId}-${item.skillId}-${item.subSkillId ?? 'x'}-${index}`,
          playerId: item.playerId,
          playerName: item.playerName,
          skillId: item.skillId,
          subSkillId: item.subSkillId,
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
    if (!search) {
      return rows;
    }

    const lowerSearch = search.toLowerCase();
    return rows.filter((row) => {
      const localizedSkill = localizeSkillName(row.skillId, null, i18n.language);
      return row.playerName.toLowerCase().includes(lowerSearch) || localizedSkill.toLowerCase().includes(lowerSearch);
    });
  }, [i18n.language, rows, search]);

  const columns = [
    { field: 'playerName', headerName: t('analytics.player'), flex: 1, minWidth: 140 },
    {
      field: 'skillId',
      headerName: t('analytics.skill'),
      flex: 1,
      minWidth: 180,
      renderCell: (params) => localizeSkillName(params.row.skillId, null, i18n.language),
    },
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
      <Box sx={{ mb: 1 }}>
        <TextField
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label={t('analytics.search')}
        />
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
