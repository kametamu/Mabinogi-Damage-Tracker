To add a new language the following edits must be made:  
  
a language .json file (like 'en.json', 'ja.json') should be created in Mabinogi_Damage_Tracker.client\src\localization\i18n\ and in .\skills  
the index.js files for both should be updated to include the new langauges:

SettingsMenu.jsx also needs to have the language added to the drop down. search for "//add new langauges here!" to find the location