import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Tooltip from '@mui/material/Tooltip';

export default function UnknownSkillsDebugPanel({ start_ut, end_ut }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (loaded || loading) {
      return;
    }

    setLoading(true);
    fetch(`http://${window.location.hostname}:5004/Home/GetUnknownSkillStats?start_ut=${start_ut}&end_ut=${end_ut}&top=20&minCount=2`)
      .then((response) => response.json())
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        setLoaded(true);
      })
      .catch(() => {
        setRows([]);
        setLoaded(true);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Accordion onChange={(_, expanded) => expanded && load()} sx={{ mt: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2" color="text.secondary">
          {t('analytics.unknownSkillsDebug')}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            {t('analytics.unknownSkillsHelper')}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('analytics.skillId')}</TableCell>
                  <TableCell>{t('analytics.count')}</TableCell>
                  <TableCell align="right">{t('analytics.copy')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.skillId}-${row.count}`}>
                    <TableCell>{row.skillId}</TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('analytics.copy')}>
                        <IconButton size="small" onClick={() => navigator.clipboard?.writeText(String(row.skillId))}>
                          <ContentCopyIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && loaded && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">{t('analytics.noRows')}</TableCell>
                  </TableRow>
                )}
                {loading && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">{t('analytics.loading')}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
