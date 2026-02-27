import * as React from 'react';
import { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../AppContext';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import NumberField from './NumberField';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Button from '@mui/material/Button';

export default function SettingsMenu() {
  const { t, i18n } = useTranslation();
  const { mode, setMode } = useContext(AppContext);
  const { pollingRate, setPollingRate } = useContext(AppContext);
  const { burstCount, setBurstCount } = useContext(AppContext);
  const { largestDamageInstanceCount, setLargestDamageInstantCount } = useContext(AppContext);
  const [themeChecked, setThemeChecked] = useState(mode === 'dark');
  const [adapters, setAdapters] = useState([]);
  const [selectedAdapter, setSelectedAdapter] = useState('');
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState('success');
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    fetch(`http://${window.location.hostname}:5004/Home/GetCurrentAdapter`)
      .then((response) => response.json())
      .then((data) => {
        setSelectedAdapter(data);
      })
      .catch((error) => console.error('Error:', error));

    fetch(`http://${window.location.hostname}:5004/Home/GetAllAdapters`)
      .then((response) => response.json())
      .then((data) => {
        setAdapters(data);
      })
      .catch((error) => console.error('Error:', error));
  }, []);

  const handleThemeChange = (event) => {
    const nextMode = event.target.checked ? 'dark' : 'light';
    setMode(nextMode);
    setThemeChecked(event.target.checked);
  };

  const handleLanguageChange = async (event) => {
    const language = event.target.value;
    await i18n.changeLanguage(language);
    localStorage.setItem('language', language);
  };

  const handleAdapterChange = async (event) => {
    if (event.target.value === undefined) return;

    setSelectedAdapter(event.target.value);
    const response = await fetch(`http://${window.location.hostname}:5004/Home/SaveAdapter?adapter=${event.target.value}`);
    setOpen(true);
    if (response.ok) {
      setSeverity('success');
      setAlertMessage(t('alerts.adapterSavedSuccess'));
    } else {
      setSeverity('error');
      setAlertMessage(t('alerts.adapterSavedError'));
    }
  };

  const handleCloseSnackbar = (_, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '40vw', gap: '40px' }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="h4">{t('settings.colorTheme')}</Typography>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="subtitle">{t('settings.colorThemeDescription')}</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', grow: 2, alignSelf: 'flex-end' }}>
          <Typography>{t('settings.light')}</Typography>
          <Switch checked={themeChecked} onChange={handleThemeChange} />
          <Typography>{t('settings.dark')}</Typography>
        </Stack>
      </Box>

      <Divider />
      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="h4">{t('settings.language')}</Typography>
        </Box>
        <FormControl sx={{ m: 1, minWidth: 180 }}>
          <InputLabel id="language-input-label">{t('settings.language')}</InputLabel>
          <Select
            labelId="language-selector"
            id="language-selector"
            value={i18n.language.startsWith('ja') ? 'ja' : 'en'}
            onChange={handleLanguageChange}
            sx={{ minWidth: 120 }}
            label={t('settings.language')}
          >
            <MenuItem value="en">{t('settings.languageEnglish')}</MenuItem>
            <MenuItem value="ja">{t('settings.languageJapanese')}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Divider />
      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="h4">{t('settings.numberOfBurst')}</Typography>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="subtitle">{t('settings.numberOfBurstDescription')}</Typography>
        </Box>
        <NumberField
          label={t('settings.numberOfBurst')}
          min={1}
          max={16}
          value={burstCount}
          onValueChange={(value) => {
            setBurstCount(value);
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="h4">{t('settings.numberOfLargestHits')}</Typography>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="subtitle">{t('settings.numberOfLargestHitsDescription')}</Typography>
        </Box>
        <NumberField
          label={t('settings.numberOfLargestHits')}
          min={1}
          max={16}
          value={largestDamageInstanceCount}
          onValueChange={(value) => {
            setLargestDamageInstantCount(value);
          }}
        />
      </Box>

      <Divider />
      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="h4">{t('settings.pollingRate')}</Typography>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="subtitle">{t('settings.pollingRateDescription')}</Typography>
        </Box>
        <NumberField
          label={t('settings.pollingRate')}
          min={10}
          max={10000}
          units="ms"
          value={pollingRate}
          onValueChange={(value) => {
            setPollingRate(value);
          }}
        />
      </Box>

      <Divider />
      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="h4">{t('settings.selectAdapter')}</Typography>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="subtitle">{t('settings.selectAdapterDescription')}</Typography>
        </Box>
        <FormControl sx={{ m: 1, minWidth: 180 }}>
          <InputLabel id="adapter-input-label">{t('settings.adapter')}</InputLabel>
          <Select
            labelId="adapter-selector"
            id="adapter-selector"
            value={selectedAdapter}
            onChange={handleAdapterChange}
            sx={{ minWidth: 100 }}
            label={t('settings.adapter')}
          >
            {adapters.length ? (
              adapters.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Typography>{t('settings.noAdaptersAvailable')}</Typography>
              </Box>
            )}
          </Select>
          {selectedAdapter === '' ? <Typography variant="caption" color="warning">{t('settings.noAdapterSaved')}</Typography> : <></>}
        </FormControl>
      </Box>

      <Divider />
      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="h4">{t('settings.restartParse')}</Typography>
          <Typography sx={{ alignSelf: 'flex-start' }} variant="subtitle">{t('settings.restartParseDescription')}</Typography>
        </Box>
        <Button
          color="error"
          variant="contained"
          onClick={async () => {
            const response = await fetch(`http://${window.location.hostname}:5004/Home/RestartParser`);
            setOpen(true);
            if (response.ok) {
              setSeverity('success');
              setAlertMessage(t('alerts.adapterRestartedSuccess'));
            } else {
              setSeverity('error');
              setAlertMessage(t('alerts.adapterRestartedError'));
            }
          }}
        >
          {t('settings.restart')}
        </Button>
      </Box>

      <Snackbar open={open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert
          onClose={handleCloseSnackbar}
          severity={severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
