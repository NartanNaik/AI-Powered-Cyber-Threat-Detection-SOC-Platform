// Shared onboarding / tour state for CyberCube.
//
// Setup completion is stored in localStorage (per user email) so a page refresh,
// a closed tab, or a manual URL change can never skip the setup phase.
// An in-memory fallback is used if the browser blocks storage (private mode, etc.)
// so users are never trapped in onboarding by a storage error.

export const SETUP_EVENT = 'cybercube-setup-complete';

const SETUP_PREFIX = 'cybercube_setup_complete:';
const TOUR_PREFIX = 'cybercube_tour_seen:';

const memoryFlags = {};

export const currentUserEmail = () => {
  try {
    return sessionStorage.getItem('soc_user_email') || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

const readFlag = (key) => {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return memoryFlags[key] === true;
  }
};

const writeFlag = (key, value) => {
  try {
    if (value) localStorage.setItem(key, 'true');
    else localStorage.removeItem(key);
  } catch {
    memoryFlags[key] = !!value;
  }
};

// ---- Setup phase -----------------------------------------------------------

export const isSetupComplete = (email = currentUserEmail()) =>
  readFlag(SETUP_PREFIX + email);

export const markSetupComplete = (email = currentUserEmail()) => {
  writeFlag(SETUP_PREFIX + email, true);
  window.dispatchEvent(new CustomEvent(SETUP_EVENT));
};

// ---- Guided tour -----------------------------------------------------------

export const isTourSeen = (email = currentUserEmail()) =>
  readFlag(TOUR_PREFIX + email);

export const markTourSeen = (email = currentUserEmail()) =>
  writeFlag(TOUR_PREFIX + email, true);