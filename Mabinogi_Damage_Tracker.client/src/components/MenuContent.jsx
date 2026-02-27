import * as React from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../AppContext';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import HelpRoundedIcon from '@mui/icons-material/HelpRounded';
import HistoryIcon from '@mui/icons-material/History';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import PersonIcon from '@mui/icons-material/Person';

const mainListItems = [
  { key: 'Home', labelKey: 'menu.home', icon: <HomeRoundedIcon /> },
  { key: 'Live', labelKey: 'menu.live', icon: <RssFeedIcon /> },
  { key: 'Players', labelKey: 'menu.players', icon: <PersonIcon /> },
  { key: 'Recordings', labelKey: 'menu.recordings', icon: <HistoryIcon /> },
];

const secondaryListItems = [
  { key: 'Settings', labelKey: 'menu.settings', icon: <SettingsRoundedIcon /> },
  { key: 'About', labelKey: 'menu.about', icon: <InfoRoundedIcon /> },
  { key: 'Feedback', labelKey: 'menu.feedback', icon: <HelpRoundedIcon /> },
];

export default function MenuContent() {
  const { t } = useTranslation();
  const { menu, setMenu } = useContext(AppContext);

  return (
    <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
      <List dense>
        {mainListItems.map((item) => (
          <ListItem key={item.key} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              selected={item.key === menu.name}
              onClick={() => {
                setMenu({ name: item.key });
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={t(item.labelKey)} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <List dense>
        {secondaryListItems.map((item) => (
          <ListItem key={item.key} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              onClick={() => {
                if (item.key === 'Feedback') {
                  window.open('https://github.com/KilloPillers/Mabinogi_Damage_Tracker/issues');
                } else {
                  setMenu({ name: item.key });
                }
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={t(item.labelKey)} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
