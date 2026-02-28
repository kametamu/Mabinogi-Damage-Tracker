import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataGrid } from '@mui/x-data-grid';
import Paper from '@mui/material/Paper';
import { localizeSkillName } from '../localization/skills';

const paginationModel = { page: 0, pageSize: 5 };

export default function LiveSkillDamageTable({ startUT, recording }) {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!recording || !startUT) {
      setRows([]);
      return;
    }

    const loadRows = () => {
      const endUT = Math.floor(Date.now() / 1000);
      fetch(`http://${window.location.hostname}:5004/Home/GetSkillDamageRanking?start_ut=${startUT}&end_ut=${endUT}`)
        .then((response) => response.json())
        .then((data) => {
          setRows((data || []).map((item, index) => ({
            id: `${item.playerId}-${item.skillId}-${index}`,
            playerName: item.playerName,
            skillId: item.skillId,
            totalDamage: item.totalDamage,
          })));
        })
        .catch((error) => {
          console.error('Error:', error);
          setRows([]);
        });
    };

    loadRows();
    const interval = setInterval(loadRows, 3000);
    return () => clearInterval(interval);
  }, [recording, startUT]);

  const columns = useMemo(() => [
    {
      field: 'skillId',
      headerName: t('analytics.skill'),
      minWidth: 180,
      flex: 1,
      renderCell: (params) => localizeSkillName(params.row.skillId, null, i18n.language),
    },
    {
      field: 'playerName',
      headerName: t('analytics.player'),
      minWidth: 130,
      flex: 1,
    },
    {
      field: 'totalDamage',
      headerName: t('analytics.totalDamage'),
      minWidth: 130,
      type: 'number',
      flex: 1,
      valueFormatter: (value) => Number(value || 0).toLocaleString(),
    },
  ], [i18n.language, t]);

  return (
    <Paper sx={{ p: 1 }}>
      <DataGrid
        rows={rows}
        columns={columns}
        pageSizeOptions={[5, 10, 20]}
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
