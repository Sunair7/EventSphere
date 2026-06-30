import { useState, useEffect } from 'react';

const TUTORIAL_KEY = (role) => `tutorial_${role}_completed`;
const SKIPPED_KEY = (role) => `tutorial_${role}_skipped`;

export function useTutorial(role) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user has already completed or skipped the tutorial
    const completed = localStorage.getItem(TUTORIAL_KEY(role));
    const skipped = localStorage.getItem(SKIPPED_KEY(role));

    // Show tutorial only if not completed and not skipped
    setShowTutorial(!completed && !skipped);
    setLoading(false);
  }, [role]);

  const completeTutorial = () => {
    localStorage.setItem(TUTORIAL_KEY(role), 'true');
    setShowTutorial(false);
  };

  const skipTutorial = () => {
    localStorage.setItem(SKIPPED_KEY(role), 'true');
    setShowTutorial(false);
  };

  const resetTutorial = () => {
    localStorage.removeItem(TUTORIAL_KEY(role));
    localStorage.removeItem(SKIPPED_KEY(role));
    setShowTutorial(true);
  };

  return {
    showTutorial,
    loading,
    completeTutorial,
    skipTutorial,
    resetTutorial,
  };
}