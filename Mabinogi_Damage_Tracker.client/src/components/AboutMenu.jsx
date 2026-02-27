import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import Box from '@mui/material/Box';

export default function AboutMenu() {
  const { i18n } = useTranslation();
  const [aboutMarkdown, setAboutMarkdown] = useState('');

  useEffect(() => {
    const markdownPath = i18n.language.startsWith('ja') ? '/ABOUTPAGE.ja.md' : '/ABOUTPAGE.md';

    fetch(markdownPath)
      .then((res) => res.text())
      .then((text) => setAboutMarkdown(text))
      .catch((err) => console.error(err));
  }, [i18n.language]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '50vw' }}>
      <Markdown>{aboutMarkdown}</Markdown>
    </Box>
  );
}
