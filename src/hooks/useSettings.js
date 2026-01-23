import { useState, useEffect } from 'react';

export function useSettings() {
  const [showProfile, setShowProfile] = useState(false);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
  const [matchesWebhookUrl, setMatchesWebhookUrl] = useState('');
  const [isRatingUpdateEnabled, setIsRatingUpdateEnabled] = useState(true);

  // Load settings from localStorage on initial render
  useEffect(() => {
    const savedTeamsUrl = localStorage.getItem('lol_custom_teams_webhook_url');
    if (savedTeamsUrl) setTeamsWebhookUrl(savedTeamsUrl);
    
    const savedMatchesUrl = localStorage.getItem('lol_custom_matches_webhook_url');
    if (savedMatchesUrl) setMatchesWebhookUrl(savedMatchesUrl);

    const savedRatingUpdateEnabled = localStorage.getItem('lol_custom_rating_update_enabled');
    // Only set to false if the saved value is the string 'false'
    setIsRatingUpdateEnabled(savedRatingUpdateEnabled !== 'false');
  }, []);

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('lol_custom_teams_webhook_url', teamsWebhookUrl);
  }, [teamsWebhookUrl]);

  useEffect(() => {
    localStorage.setItem('lol_custom_matches_webhook_url', matchesWebhookUrl);
  }, [matchesWebhookUrl]);

  useEffect(() => {
    localStorage.setItem('lol_custom_rating_update_enabled', isRatingUpdateEnabled);
  }, [isRatingUpdateEnabled]);

  const handleSaveProfile = (settings) => {
    setTeamsWebhookUrl(settings.teams);
    setMatchesWebhookUrl(settings.matches);
    setIsRatingUpdateEnabled(settings.isRatingUpdateEnabled);
    setShowProfile(false);
  };

  return {
    showProfile,
    setShowProfile,
    teamsWebhookUrl,
    matchesWebhookUrl,
    isRatingUpdateEnabled,
    handleSaveProfile,
    initialSettings: {
        teams: teamsWebhookUrl,
        matches: matchesWebhookUrl,
        isRatingUpdateEnabled: isRatingUpdateEnabled
    }
  };
}
