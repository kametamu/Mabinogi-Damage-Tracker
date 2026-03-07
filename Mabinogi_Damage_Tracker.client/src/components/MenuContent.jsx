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
    { text: 'Home', icon: <HomeRoundedIcon />, labelKey: 'sideMenu.home' },
    { text: 'Live', icon: <RssFeedIcon />, labelKey: 'sideMenu.live' },
    { text: 'Players', icon: <PersonIcon />, labelKey: 'sideMenu.players' },
    { text: 'Recordings', icon: <HistoryIcon />, labelKey: 'sideMenu.recordings' },
];

const secondaryListItems = [
    { text: 'Settings', icon: <SettingsRoundedIcon />, labelKey: 'sideMenu.settings' },
    { text: 'About', icon: <InfoRoundedIcon />, labelKey: 'sideMenu.about' },
    { text: 'Feedback', icon: <HelpRoundedIcon />, labelKey: 'sideMenu.feedback' },
];

export default function MenuContent() {
    const { t } = useTranslation();
    const { menu, setMenu } = useContext(AppContext);

    return (
    <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
        <List dense>
        {mainListItems.map((item, index) => (
            <ListItem key={index} disablePadding sx={{ display: 'block' }}>
            <ListItemButton selected={item.text === menu.name} onClick={() => {
                setMenu({ name: item.text })
                }}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.labelKey ? t(item.labelKey) : item.text} />
            </ListItemButton>
            </ListItem>
        ))}
        </List>
        <List dense>
        {secondaryListItems.map((item, index) => (
            <ListItem key={index} disablePadding sx={{ display: 'block' }} >
                <ListItemButton onClick={() => {
                    if (item.text === "Feedback") {
                        window.open('https://github.com/MabiPrograms/Mabinogi-Damage-Tracker/issues')
                    }
                    else {
                        setMenu({ name: item.text })
                    }
                    }}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.labelKey ? t(item.labelKey) : item.text} />
                </ListItemButton>
            </ListItem>
        ))}
        </List>
    </Stack>
    );
}
